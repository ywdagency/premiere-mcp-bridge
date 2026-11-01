// Pure JSON protocol shared by UXP and Node. Never accept executable code.
export const BRIDGE_VERSION = 1;
export { PLUGIN_VERSION } from './identity';
import { COMMAND_LIST } from './command-catalog';
export const BRIDGE_NAME = 'premiere-mcp-bridge';
export const MARKER_FILE = 'bridge.json';
export const MAX_REQUEST_BYTES = 16384;
export const MAX_RESPONSE_BYTES = 65536;
export const MAX_REQUEST_LIFETIME_MS = 30000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const REQUEST_FILE_PATTERN = /^request-([0-9a-f-]{36})\.json$/;

export type ReadCommand = 'get_project' | 'get_active_sequence' | 'get_sequence_clips';
export interface ReadArgs {
  includePath?: boolean;
  mediaType?: 'all' | 'video' | 'audio';
  trackIndex?: number;
  offset?: number;
  limit?: number;
  sequenceId?: string;
}
export type BridgeArgs = ReadArgs & Record<string, unknown>;
export interface ReadRequest {
  version: 1;
  bridgeId: string;
  id: string;
  command: import('./command-catalog').BridgeCommand;
  args: BridgeArgs;
  expiresAt: number;
}
export interface BridgeMarker {
  version: 1;
  name: string;
  bridgeId: string;
}
export type ReadResponse =
  | {
      version: 1;
      bridgeId: string;
      id: string;
      ok: true;
      result: Record<string, unknown>;
    }
  | {
      version: 1;
      bridgeId: string;
      id: string;
      ok: false;
      error: BridgeFailure;
    };

export interface ImportFailureDiagnostics {
  phase: 'preparation' | 'path_validation' | 'native_import' | 'result_registration';
  step: string;
  nativeCallStarted: boolean;
  originalError: { type: string; code: string | number | null; message: string };
}
export interface BridgeFailure {
  code: string;
  message: string;
  diagnostics?: ImportFailureDiagnostics;
}

export class BridgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly diagnostics?: ImportFailureDiagnostics,
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

export function bridgeFailure(error: BridgeError): BridgeFailure {
  return { code: error.code, message: error.message,
    ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}) };
}

export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BridgeError('INVALID_REQUEST', 'Expected a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function onlyKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new BridgeError('INVALID_REQUEST', 'Unexpected fields are not permitted.');
  }
}

export function validateMarkerParameterPrefix(memberId: unknown, value: unknown): void {
  if (memberId !== 'Markers#createAddMarkerAction') return;
  const args = object(value);
  let omitted = false;
  for (const key of ['name', 'markerType', 'startTime', 'duration', 'comments']) {
    if (args[key] === undefined) omitted = true;
    else if (omitted)
      throw new BridgeError('INVALID_API_ARGUMENT', 'Marker creation requires every preceding argument when a later optional argument is supplied.');
  }
}

export function validateArgs(command: unknown, value: unknown): BridgeArgs {
  const spec = COMMAND_LIST.find((item) => item.command === command);
  if (!spec)
    throw new BridgeError(
      'COMMAND_NOT_ALLOWED',
      'This command is not registered in Premiere MCP Bridge.',
    );
  const args = object(value);
  onlyKeys(args, Object.keys(spec.fields));
  for (const [key, field] of Object.entries(spec.fields)) {
    const entry = args[key];
    if (entry === undefined && !field.required) continue;
    let valid = false;
    if (field.type === 'boolean') valid = typeof entry === 'boolean';
    if (field.type === 'integer')
      valid =
        typeof entry === 'number' &&
        Number.isSafeInteger(entry) &&
        entry >= (field.min ?? 0) &&
        entry <= (field.max ?? Number.MAX_SAFE_INTEGER);
    if (field.type === 'string')
      valid =
        typeof entry === 'string' &&
        entry.length >= (field.min ?? 0) &&
        entry.length <= (field.max ?? 4096) &&
        (!field.enum || field.enum.includes(entry)) &&
        (!field.pattern || new RegExp(field.pattern).test(entry)) &&
        !entry.includes(String.fromCharCode(0));
    if (field.type === 'strings')
      valid =
        Array.isArray(entry) &&
        entry.length >= (field.min ?? 0) &&
        entry.length <= (field.max ?? 10) &&
        entry.every(
          (path) =>
            typeof path === 'string' &&
            path.length > 0 &&
            path.length <= 1024 &&
            !path.includes(String.fromCharCode(0)) &&
            !path.includes(String.fromCharCode(92)) &&
            !path.startsWith('/') &&
            !path
              .split('/')
              .some((part) => !part || part === '.' || part === '..' || part.includes(':')),
        );
    if (field.type === 'ids')
      valid =
        Array.isArray(entry) &&
        entry.length >= (field.min ?? 0) &&
        entry.length <= (field.max ?? 100) &&
        entry.every((id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id));
    if (field.type === 'names')
      valid = Array.isArray(entry) && entry.length >= (field.min ?? 0) &&
        entry.length <= (field.max ?? 50) && entry.every((name) =>
          typeof name === 'string' && name.length > 0 && name.length <= 256 && !name.includes(String.fromCharCode(0)));
    if (field.type === 'json') {
      validateJson(entry);
      valid = true;
    }
    if (field.type === 'binActions') {
      validateBinActions(entry);
      valid = true;
    }
    if (!valid)
      throw new BridgeError(
        'INVALID_REQUEST',
        `Invalid ${key}. Consult this command's input schema.`,
      );
  }
  if (command === 'api_apply_actions' && Array.isArray(args.actions)) {
    for (const action of args.actions) {
      if (action && typeof action === 'object' && !Array.isArray(action))
        validateMarkerParameterPrefix(action.memberId, action.parameters);
    }
  }
  if (
    command === 'get_sequence_clips' &&
    args.trackIndex !== undefined &&
    args.mediaType !== 'video' &&
    args.mediaType !== 'audio'
  ) {
    throw new BridgeError('INVALID_REQUEST', 'trackIndex requires mediaType video or audio.');
  }
  if (['import_ae_comps', 'import_all_ae_comps', 'import_sequences'].includes(command as string)) {
    const extension = command === 'import_sequences' ? '.prproj' : '.aep';
    const path = args.path as string;
    if (!path.toLowerCase().endsWith(extension) || /[\\:\u0000]/.test(path) ||
      path.split('/').some((part) => !part || part === '.' || part === '..'))
      throw new BridgeError('INVALID_API_ARGUMENT', `Use a granted relative ${extension} path.`);
    if (command === 'import_ae_comps' && new Set(args.compNames as string[]).size !== (args.compNames as string[]).length)
      throw new BridgeError('INVALID_API_ARGUMENT', 'Composition names must be distinct.');
    if (command === 'import_sequences') {
      const ids = args.sequenceIds as string[] | undefined;
      if (args.allSequences === true ? ids !== undefined : !ids?.length)
        throw new BridgeError('INVALID_API_ARGUMENT', 'Provide sequenceIds or explicit allSequences=true, exclusively.');
      if (ids && (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length ||
        !ids.every((id) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))))
        throw new BridgeError('INVALID_API_ARGUMENT', 'Source sequence IDs must be distinct GUIDs.');
    }
  }
  if (command === 'project_close' && args.confirm !== true)
    throw new BridgeError('EXPLICIT_AUTHORIZATION_REQUIRED', 'Closing a project must be deliberate (confirm=true).');
  if (command === 'project_open' && args.createNew && args.openOptions !== undefined)
    throw new BridgeError('INVALID_API_ARGUMENT', 'openOptions applies to opening, not creating a project.');
  return args as BridgeArgs;
}

export type BinAction =
  | { type: 'create_bin'; parentBinId: string; name: string }
  | { type: 'move_item'; itemId: string; expectedParentBinId: string; destinationBinId: string }
  | { type: 'rename_bin'; binId: string; expectedName: string; name: string };

// Validated by Node before IPC and independently by the UXP dispatcher/adapter.
export function validateBinActions(value: unknown): asserts value is BinAction[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20)
    throw new BridgeError('INVALID_REQUEST', 'Provide 1–20 bin organization actions.');
  const bounded = (v: unknown, max = 128) => typeof v === 'string' && v.length > 0 && v.length <= max && !v.includes('\u0000');
  for (const raw of value) {
    const a = object(raw);
    const keys = a.type === 'create_bin' ? ['type', 'parentBinId', 'name']
      : a.type === 'move_item' ? ['type', 'itemId', 'expectedParentBinId', 'destinationBinId']
      : a.type === 'rename_bin' ? ['type', 'binId', 'expectedName', 'name'] : [];
    if (!keys.length || keys.some((key) => !bounded(a[key], key === 'expectedName' ? 256 : 128)))
      throw new BridgeError('INVALID_REQUEST', 'Invalid bin organization action.');
    onlyKeys(a, keys);
    if ('name' in a && !(a.name as string).trim())
      throw new BridgeError('INVALID_REQUEST', 'A bin name cannot be blank.');
  }
}

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function parseMarker(value: unknown): BridgeMarker {
  const marker = object(value);
  onlyKeys(marker, ['version', 'name', 'bridgeId']);
  if (
    marker.version !== BRIDGE_VERSION ||
    marker.name !== BRIDGE_NAME ||
    typeof marker.bridgeId !== 'string' ||
    !UUID_PATTERN.test(marker.bridgeId)
  ) {
    throw new BridgeError('INVALID_BRIDGE', 'Select the folder prepared by Premiere MCP Bridge.');
  }
  return marker as unknown as BridgeMarker;
}

export function parseRequest(value: unknown, bridgeId: string, now = Date.now()): ReadRequest {
  const request = object(value);
  onlyKeys(request, ['version', 'bridgeId', 'id', 'command', 'args', 'expiresAt']);
  if (
    request.version !== BRIDGE_VERSION ||
    request.bridgeId !== bridgeId ||
    typeof request.id !== 'string' ||
    !UUID_PATTERN.test(request.id)
  ) {
    throw new BridgeError('INVALID_REQUEST', 'Bridge version or request identity does not match.');
  }
  validateArgs(request.command, request.args);
  if (
    typeof request.expiresAt !== 'number' ||
    !Number.isSafeInteger(request.expiresAt) ||
    request.expiresAt <= now ||
    request.expiresAt > now + MAX_REQUEST_LIFETIME_MS
  ) {
    throw new BridgeError('REQUEST_EXPIRED', 'The request expired or has an invalid deadline.');
  }
  return request as unknown as ReadRequest;
}

export function parseResponse(value: unknown, request: ReadRequest): ReadResponse {
  const response = object(value);
  onlyKeys(response, ['version', 'bridgeId', 'id', 'ok', 'result', 'error']);
  if (
    response.version !== BRIDGE_VERSION ||
    response.bridgeId !== request.bridgeId ||
    response.id !== request.id ||
    typeof response.ok !== 'boolean'
  ) {
    throw new BridgeError('INVALID_RESPONSE', 'Response identity does not match the request.');
  }
  if (response.ok) {
    object(response.result);
    if ('error' in response)
      throw new BridgeError('INVALID_RESPONSE', 'Conflicting result fields.');
  } else {
    const error = object(response.error);
    if (
      typeof error.code !== 'string' ||
      typeof error.message !== 'string' ||
      'result' in response
    ) {
      throw new BridgeError('INVALID_RESPONSE', 'Invalid error response.');
    }
    if (error.diagnostics !== undefined) validateImportDiagnostics(error.diagnostics);
  }
  return response as unknown as ReadResponse;
}

// Validate optional diagnostics independently in UXP receipt recovery and Node IPC.
function validateImportDiagnostics(value: unknown): void {
  const invalid = () => { throw new BridgeError('INVALID_RESPONSE', 'Invalid import diagnostics.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const d = value as Record<string, unknown>;
  if (Object.keys(d).some((k) => !['phase', 'step', 'nativeCallStarted', 'originalError'].includes(k)) ||
      !['preparation', 'path_validation', 'native_import', 'result_registration'].includes(d.phase as string) ||
      typeof d.step !== 'string' || !/^[a-z_]{1,96}$/.test(d.step) ||
      typeof d.nativeCallStarted !== 'boolean') return invalid();
  const original = d.originalError;
  if (!original || typeof original !== 'object' || Array.isArray(original)) return invalid();
  const e = original as Record<string, unknown>;
  const bounded = (v: unknown, max: number) => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  if (Object.keys(e).some((k) => !['type', 'code', 'message'].includes(k)) ||
      !bounded(e.type, 64) || !bounded(e.message, 512) ||
      !(e.code === null || bounded(e.code, 128) || (typeof e.code === 'number' && Number.isFinite(e.code)))) invalid();
}

// Pure bounded JSON validation duplicated at both protocol boundaries.
export function validateJson(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (depth > 10 || ++budget.nodes > 3000)
    throw new BridgeError('INVALID_REQUEST', 'JSON nesting or item limit exceeded.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e15) return;
  if (typeof value === 'string' && value.length <= 8192 && !value.includes(String.fromCharCode(0)))
    return;
  if (Array.isArray(value) && value.length <= 128) {
    for (const item of value) validateJson(item, depth + 1, budget);
    return;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new BridgeError('INVALID_REQUEST', 'Prototype keys are forbidden.');
      validateJson(item, depth + 1, budget);
    }
    return;
  }
  throw new BridgeError('INVALID_REQUEST', 'Expected bounded JSON data.');
}

import {
  ReadRequest,
  parseResponse,
  BridgeError,
  BridgeFailure,
  bridgeFailure,
  BridgeMarker,
  BRIDGE_VERSION,
  MARKER_FILE,
  MAX_REQUEST_BYTES,
  MAX_RESPONSE_BYTES,
  parseMarker,
  parseRequest,
  ReadResponse,
  REQUEST_FILE_PATTERN,
  UUID_PATTERN,
  utf8ByteLength,
} from './bridge-protocol';
import { InspectionHost } from './premiere-inspection';

import { COMMAND_LIST } from './command-catalog';
import { createDispatcher } from './dispatcher';
import { PremiereApi } from './api-runtime';
import { PremiereControl } from './premiere-control';

// Structural subset of Adobe UXP storage. No Node filesystem APIs in the plugin.
export interface UxpFile {
  name: string;
  isFile: boolean;
  read(): Promise<string>;
  write(text: string): Promise<number>;
  delete(): Promise<void>;
}
export interface UxpFolder {
  getEntries(): Promise<UxpFile[]>;
  createFile(name: string, options?: { overwrite: boolean }): Promise<UxpFile>;
  renameEntry(file: UxpFile, name: string, options?: { overwrite: boolean }): Promise<void>;
}

export class UxpBridge {
  private folder?: UxpFolder;
  private marker?: BridgeMarker;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private pending?: Promise<void>;
  private polling = false;
  private activeRequest?: ReadRequest;
  private pathCounter = 0;

  constructor(
    private readonly host: InspectionHost,
    private readonly report: (message: string, failed?: boolean) => void,
    private readonly control?: PremiereControl,
    private readonly api?: PremiereApi,
  ) {}

  async start(folder: UxpFolder): Promise<boolean> {
    const startedAtGeneration = this.generation;
    // Use entries returned by the picker-granted folder. Some host lookups via
    // getEntry resolve through a blob: URL and fail before reading bridge.json.
    const markerFile = (await folder.getEntries()).find(
      (entry) => entry.name === MARKER_FILE && entry.isFile,
    );
    if (!markerFile) {
      throw new BridgeError(
        'INVALID_BRIDGE',
        'Selected folder has no bridge.json. Choose the visible Premiere MCP Bridge folder created by setup, not its parent.',
      );
    }
    const text = await markerFile.read();
    if (utf8ByteLength(text) > MAX_REQUEST_BYTES)
      throw new BridgeError('INVALID_BRIDGE', 'Invalid bridge marker.');
    const marker = parseMarker(JSON.parse(text));
    if (startedAtGeneration !== this.generation) return false;
    this.stop();
    const generation = this.generation;
    // Drain the previous pump before allowing a new connection to process requests.
    await this.pending;
    if (generation !== this.generation) return false;
    this.folder = folder;
    this.marker = marker;
    this.report('Connected. Ready for agent requests.');
    this.schedule(generation);
    return true;
  }

  stop(): void {
    this.generation += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.folder = undefined;
    this.marker = undefined;
  }

  private schedule(generation: number): void {
    if (!this.folder || generation !== this.generation) return;
    this.timer = setTimeout(() => {
      this.pending = this.pollOnce();
      void this.pending.then(
        () => this.schedule(generation),
        () => this.schedule(generation),
      );
    }, 250);
  }

  private async execute(request: ReadRequest, folder: UxpFolder): Promise<Record<string, unknown>> {
    const handler = createDispatcher(this.host, this.control, this.api);
    const dispatch = async (request: ReadRequest) => {
      this.activeRequest = request;
      this.pathCounter = 0;
      try {
        return await handler(request);
      } finally {
        this.activeRequest = undefined;
      }
    };
    const spec = COMMAND_LIST.find((entry) => entry.command === request.command)!;
    if (spec.readOnly) return dispatch(request);
    const operationId = request.args.operationId as string;
    const name = `operation-${operationId}.json`;
    const stable = (value: any): any =>
      Array.isArray(value)
        ? value.map(stable)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, stable(value[key])]),
            )
          : value;
    const args = stable(request.args);
    const payload = JSON.stringify({ command: request.command, args });
    const previous = (await folder.getEntries()).find(
      (entry) => entry.isFile && entry.name === name,
    );
    if (previous) {
      try {
        const text = await previous.read();
        if (utf8ByteLength(text) > MAX_RESPONSE_BYTES) throw new Error('Invalid receipt');
        const receipt = JSON.parse(text);
        if (
          receipt.bridgeId !== request.bridgeId ||
          receipt.operationId !== operationId ||
          receipt.version !== 1
        )
          throw new Error('Invalid receipt');
        if (receipt.payload !== payload)
          throw new BridgeError(
            'OPERATION_ID_CONFLICT',
            'This operationId was used with different arguments.',
          );
        if (receipt.state !== 'completed') throw new Error('Incomplete receipt');
        const response = parseResponse(
          { ...receipt.outcome, version: 1, bridgeId: request.bridgeId, id: request.id },
          request,
        );
        if (!response.ok) throw new BridgeError(response.error.code, response.error.message, response.error.diagnostics);
        return { ...response.result, operationReplayed: true };
      } catch (error) {
        if (error instanceof BridgeError) throw error;
        throw new BridgeError(
          'OPERATION_OUTCOME_UNKNOWN',
          'This operation was started but its outcome is not confirmed. Inspect Premiere; do not repeat it under a new ID.',
        );
      }
    }
    const receipt = {
      version: 1,
      bridgeId: request.bridgeId,
      operationId,
      payload,
      state: 'started',
    };
    // Claim durably BEFORE entering Premiere. Completed receipts are never automatically deleted.
    const claim = await folder.createFile(name, { overwrite: false });
    await claim.write(JSON.stringify(receipt));
    let outcome:
      | { ok: true; result: Record<string, unknown> }
      | { ok: false; error: BridgeFailure };
    try {
      outcome = { ok: true, result: await dispatch(request) };
    } catch (error) {
      outcome = {
        ok: false,
        error:
          error instanceof BridgeError
            ? bridgeFailure(error)
            : {
                code: 'OPERATION_OUTCOME_UNKNOWN',
                message:
                  'The host write did not return a confirmed outcome. Inspect Premiere before another edit.',
              },
      };
    }
    const temporary = await folder.createFile(`operation-${operationId}.tmp`, { overwrite: true });
    await temporary.write(JSON.stringify({ ...receipt, state: 'completed', outcome }));
    await folder.renameEntry(temporary, name, { overwrite: true });
    if (!outcome.ok) throw new BridgeError(outcome.error.code, outcome.error.message, outcome.error.diagnostics);
    return outcome.result;
  }

  async authorizeFile(
    root: string,
    relative: string,
    mode: 'read' | 'write' | 'directory',
  ): Promise<string> {
    const request = this.activeRequest,
      folder = this.folder,
      marker = this.marker;
    if (!request || !folder || !marker)
      throw new BridgeError(
        'FILE_CHECK_UNAVAILABLE',
        'File access requires an active brokered MCP request.',
      );
    const counter = ++this.pathCounter;
    const basename = `${request.id}-${counter}`,
      checkName = `pathcheck-${basename}.json`,
      proofName = `pathproof-${basename}.json`;
    const temporary = await folder.createFile(`pathcheck-${basename}.tmp`, { overwrite: false });
    await temporary.write(
      JSON.stringify({
        version: 1,
        bridgeId: marker.bridgeId,
        requestId: request.id,
        counter,
        root,
        relative,
        mode,
      }),
    );
    await folder.renameEntry(temporary, checkName, { overwrite: false });
    try {
      while (Date.now() < request.expiresAt) {
        const proof = (await folder.getEntries()).find(
          (file) => file.name === proofName && file.isFile,
        );
        if (proof) {
          const raw = await proof.read();
          if (utf8ByteLength(raw) > 4096)
            throw new BridgeError('INVALID_FILE_PROOF', 'Invalid file authorization proof.');
          const result = JSON.parse(raw);
          if (
            result.version !== 1 ||
            result.bridgeId !== marker.bridgeId ||
            result.requestId !== request.id ||
            result.counter !== counter ||
            typeof result.ok !== 'boolean'
          )
            throw new BridgeError(
              'INVALID_FILE_PROOF',
              'File authorization identity does not match.',
            );
          if (!result.ok)
            throw new BridgeError(
              typeof result.error?.code === 'string' ? result.error.code : 'FILE_CHECK_FAILED',
              typeof result.error?.message === 'string'
                ? result.error.message
                : 'Granted file verification failed.',
            );
          if (typeof result.nativePath !== 'string')
            throw new BridgeError('INVALID_FILE_PROOF', 'Missing approved native path.');
          return result.nativePath;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new BridgeError(
        'REQUEST_EXPIRED',
        'The local file authorization broker did not respond before the deadline.',
      );
    } finally {
      for (const name of [checkName, proofName]) {
        const entry = (await folder.getEntries()).find((file) => file.name === name && file.isFile);
        await entry?.delete().catch(() => {});
      }
    }
  }

  // Public to let transport tests exercise the same pump without emulating UXP timers.
  async pollOnce(): Promise<void> {
    const folder = this.folder;
    const marker = this.marker;
    const generation = this.generation;
    if (!folder || !marker || this.polling) return;
    this.polling = true;
    try {
      const entries = await folder.getEntries();
      for (const file of entries
        .filter((entry) => entry.isFile && REQUEST_FILE_PATTERN.test(entry.name))
        .slice(0, 32)) {
        if (generation !== this.generation) return;
        const id = REQUEST_FILE_PATTERN.exec(file.name)![1];
        if (!UUID_PATTERN.test(id)) continue;
        let response: ReadResponse;
        try {
          const text = await file.read();
          if (utf8ByteLength(text) > MAX_REQUEST_BYTES)
            throw new BridgeError('INVALID_REQUEST', 'Request exceeds the size limit.');
          const request = parseRequest(JSON.parse(text), marker.bridgeId);
          if (request.id !== id)
            throw new BridgeError('INVALID_REQUEST', 'Request filename and ID do not match.');
          const result = await this.execute(request, folder);
          if (
            request.expiresAt <= Date.now() &&
            COMMAND_LIST.find((entry) => entry.command === request.command)!.readOnly
          ) {
            throw new BridgeError(
              'REQUEST_EXPIRED',
              'The read did not complete before its deadline.',
            );
          }
          response = { version: BRIDGE_VERSION, bridgeId: marker.bridgeId, id, ok: true, result };
        } catch (error) {
          response = {
            version: BRIDGE_VERSION,
            bridgeId: marker.bridgeId,
            id,
            ok: false,
            error:
              error instanceof BridgeError
                ? bridgeFailure(error)
                : { code: 'INVALID_REQUEST', message: 'The bridge request could not be decoded.' },
          };
        }
        if (generation !== this.generation) return;
        let json = JSON.stringify(response);
        if (utf8ByteLength(json) > MAX_RESPONSE_BYTES) {
          json = JSON.stringify({
            version: BRIDGE_VERSION,
            bridgeId: marker.bridgeId,
            id,
            ok: false,
            error: {
              code: 'RESPONSE_TOO_LARGE',
              message: 'Host metadata exceeds the response limit.',
            },
          });
        }
        // Node only reads the final name after UXP has finished writing the temp file.
        const temporary = await folder.createFile(`response-${id}.tmp`, { overwrite: true });
        await temporary.write(json);
        if (generation !== this.generation) {
          await temporary.delete().catch(() => {});
          return;
        }
        await folder.renameEntry(temporary, `response-${id}.json`, { overwrite: true });
        // The server may already have removed this request after consuming the response.
        await file.delete().catch(() => {});
      }
    } catch {
      this.stop();
      this.report(
        'Premiere MCP Bridge stopped: its folder is unavailable. Connect again to resume.',
        true,
      );
    } finally {
      this.polling = false;
    }
  }
}

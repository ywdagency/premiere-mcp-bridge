import { BridgeError, BridgeArgs, object, onlyKeys } from './bridge-protocol';
import { API_CONTRACTS } from './generated/api-contracts';
import { apiPolicy, VALUE_TYPES, versionSupported } from './api-policy';
import { ApiMember, ApiScope, ApiHandle, ApiType, ClipObservation } from './api-types';
import { boundedJson, parametersFor, referenceIds, resolveValue } from './api-validation';
import { PremiereControl } from './premiere-control';
import { ImportDiagnostics } from './import-diagnostics';
export interface ApiHost {
  module: Record<string, any>;
  version: string;
  writesEnabled(): boolean;
  getActiveProject(): Promise<any>;
  readText?(relative: string): Promise<string>;
  path(relative: string, mode: 'read' | 'write' | 'directory'): Promise<string>;
}
interface Job {
  id: string;
  memberId: string;
  state: 'running' | 'native_succeeded' | 'native_returned_false' | 'failed';
  createdAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: { code: string; message: string };
  scope: ApiScope;
}
interface Prepared {
  member: ApiMember;
  receiver: any;
  target?: ApiHandle;
  raw: Record<string, unknown>;
  args: any[];
  refs: ApiHandle[];
  scope: ApiScope;
}
const DRAFTS = new Set([
  ...VALUE_TYPES,
  'VideoFilterComponent',
  'AudioFilterComponent',
  'VideoTransition',
]);
const CLASS_MAP = new Map(API_CONTRACTS.classes.map((c) => [c.name, c]));
const MEMBER_MAP = new Map(
  [...API_CONTRACTS.classes.flatMap((c) => c.members), ...API_CONTRACTS.constants].map((m) => [
    m.id,
    m,
  ]),
);
function nativeFailure(id: string, write = true): BridgeError {
  return new BridgeError(
    write ? 'OPERATION_OUTCOME_UNKNOWN' : 'HOST_API_ERROR',
    `${id} failed in Premiere. Inspect its documented contract and current host state; do not repeat an uncertain write automatically.`,
  );
}
function baseTypes(schema: ApiType): string[] {
  if (schema.kind === 'ref') return schema.name ? [schema.name] : [];
  if (schema.kind === 'union') return (schema.types ?? []).flatMap(baseTypes);
  return [];
}

export class PremiereApi {
  private readonly handles = new Map<string, ApiHandle>();
  private readonly jobs = new Map<string, Job>();
  private readonly ownedAssets = new Set<string>();
  private readonly subscriptions = new Map<
    string,
    { target?: any; eventName: any; callback: (event?: any) => void; eventId: string }
  >();
  private events: Array<Record<string, unknown>> = [];
  private eventCounter = 0;
  private droppedEvents = 0;
  private readonly sequenceItems = new Map<string, string>();
  private serial = 0;
  private readonly mediaKinds = new Map<string, string>();
  private readonly epoch = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  constructor(
    private readonly host: ApiHost,
    private readonly control: PremiereControl,
  ) {}
  private id(prefix: string): string {
    return `${prefix}-${this.epoch}-${++this.serial}`;
  }
  handle(id: string): ApiHandle {
    const h = this.handles.get(id);
    if (!h || Date.now() - h.lastAccess > 600000) {
      this.handles.delete(id);
      throw new BridgeError(
        'HANDLE_EXPIRED',
        'The native object handle expired. Resolve context and read the object again.',
      );
    }
    h.lastAccess = Date.now();
    return h;
  }
  capabilities(): Record<string, unknown> {
    return {
      apiCatalog: {
        types: API_CONTRACTS.classes.length,
        members: MEMBER_MAP.size,
        constants: API_CONTRACTS.constants.length,
        adobeCommit: API_CONTRACTS.provenance.commit,
        sdkTypes: API_CONTRACTS.provenance.sdkVersion,
      },
      apiHandles: { ttlSeconds: 600, maximum: 2000 },
      fileBrokerVersion: 1,
    };
  }
  member(id: unknown): ApiMember {
    if (typeof id !== 'string' || !MEMBER_MAP.has(id))
      throw new BridgeError(
        'API_MEMBER_NOT_DOCUMENTED',
        'Only members in the pinned official Adobe catalog may be accessed.',
      );
    const m = MEMBER_MAP.get(id)!;
    if (!versionSupported(this.host.version, m.since))
      throw new BridgeError(
        'UNSUPPORTED_HOST',
        `${m.id} requires Premiere ${m.since}; connected host is ${this.host.version}.`,
      );
    return m;
  }
  constant(id: string): unknown {
    const m = this.member(id);
    if (m.kind !== 'constant' || !m.enum)
      throw new BridgeError('INVALID_API_ARGUMENT', 'Expected a documented enum member.');
    const value = this.host.module.Constants?.[m.enum]?.[m.name];
    if (value === undefined)
      throw new BridgeError(
        'HOST_MEMBER_UNAVAILABLE',
        `${id} is not present in this Premiere runtime.`,
      );
    return value;
  }
  private async requireProject(expected?: unknown): Promise<any> {
    const p = await this.host.getActiveProject();
    if (!p || (expected !== undefined && p.guid.toString() !== expected))
      throw new BridgeError(
        'ACTIVE_CONTEXT_CHANGED',
        'The requested project is no longer active. Resolve fresh context.',
      );
    return p;
  }
  private writeGate(expiresAt: number): void {
    if (!this.host.writesEnabled())
      throw new BridgeError('WRITES_DISABLED', 'Launch Premiere MCP Bridge first.');
    if (Date.now() >= expiresAt)
      throw new BridgeError('REQUEST_EXPIRED', 'The operation expired before entering Premiere.');
  }
  private editable(scope: ApiScope): boolean {
    return (
      (!!scope.sequenceId &&
        !!scope.projectId &&
        this.control.mayEdit(scope.projectId, scope.sequenceId)) ||
      (!!scope.assetId &&
        !!scope.projectId &&
        this.ownedAssets.has(`${scope.projectId}:${scope.assetId}`))
    );
  }
  private async observeClip(native: any): Promise<ClipObservation> {
    const [start, end, sourceIn, sourceOut, item] = await Promise.all([
      native.getStartTime(),
      native.getEndTime(),
      native.getInPoint(),
      native.getOutPoint(),
      native.getProjectItem(),
    ]);
    return {
      object: native,
      start: start.ticks,
      end: end.ticks,
      sourceIn: sourceIn.ticks,
      sourceOut: sourceOut.ticks,
      projectItemId: item.getId(),
    };
  }
  private async validateRefs(
    refs: ApiHandle[],
    projectId?: string,
    sequence?: string,
  ): Promise<void> {
    const seen = new Set<unknown>();
    for (const h of refs) {
      if (projectId && h.scope.projectId && projectId !== h.scope.projectId)
        throw new BridgeError(
          'ACTIVE_CONTEXT_CHANGED',
          'Objects from another project cannot be mixed into this operation.',
        );
      if (sequence && h.scope.sequenceId && !h.scope.ownedValue && sequence !== h.scope.sequenceId)
        throw new BridgeError(
          'SOURCE_SEQUENCE_PROTECTED',
          'Timeline object arguments must belong to the same working sequence.',
        );
      if (h.scope.clip && !seen.has(h.scope.clip.object)) {
        seen.add(h.scope.clip.object);
        const old = h.scope.clip,
          current = await this.observeClip(old.object);
        if (
          ['start', 'end', 'sourceIn', 'sourceOut', 'projectItemId'].some(
            (k) => old[k as keyof ClipObservation] !== current[k as keyof ClipObservation],
          )
        )
          throw new BridgeError(
            'CLIP_CHANGED',
            'A referenced clip changed since inspection. Resolve it again before editing.',
          );
      }
    }
  }
  private nativeScope(prepared: Prepared): ApiScope {
    if (prepared.target && prepared.member.id !== 'Project#closeSequence')
      return { ...prepared.target.scope };
    return {
      ...(prepared.refs.find((h) => h.scope.sequenceId)?.scope ??
        prepared.refs.find((h) => h.scope.assetId)?.scope ??
        prepared.refs.find((h) => h.scope.projectId)?.scope ??
        {}),
    };
  }
  private async prepare(args: BridgeArgs, expectedMode: string): Promise<Prepared> {
    const member = this.member(args.memberId);
    const policy = apiPolicy(member);
    if (
      policy.mode !== expectedMode &&
      !(expectedMode === 'mutate' && member.kind === 'property' && member.access?.includes('W'))
    ) {
      throw new BridgeError(
        'API_POLICY_BLOCKED',
        policy.tool
          ? `Use ${policy.tool} for ${member.id}.`
          : (policy.reason ?? `${member.id} belongs to the ${policy.mode} API tool.`),
      );
    }
    const target = args.target === undefined ? undefined : this.handle(args.target as string);
    const compatibleRead =
      expectedMode === 'read' &&
      target?.candidateTypes?.includes(member.className) &&
      target.candidateTypes.every((type) => {
        const candidate = CLASS_MAP.get(type)?.members.find(
          (m) => m.name === member.name && m.kind === member.kind,
        );
        return (
          !!candidate &&
          JSON.stringify(candidate.parameters.map((p) => p.schema)) ===
            JSON.stringify(member.parameters.map((p) => p.schema)) &&
          JSON.stringify(candidate.result) === JSON.stringify(member.result)
        );
      });
    if (
      ['method', 'property'].includes(member.kind) &&
      (!target || (!target.types.includes(member.className) && !compatibleRead))
    )
      throw new BridgeError(
        'INVALID_API_ARGUMENT',
        `A ${member.className} target handle is required.`,
      );
    if (['static', 'constant', 'constructor'].includes(member.kind) && target)
      throw new BridgeError(
        'INVALID_API_ARGUMENT',
        'A static member cannot have an instance target.',
      );
    const receiver = target?.native ?? this.host.module[member.className];
    if (!receiver && member.kind !== 'constant')
      throw new BridgeError(
        'HOST_MEMBER_UNAVAILABLE',
        `${member.className} is not present in this host.`,
      );
    if (['method', 'static'].includes(member.kind) && typeof receiver[member.name] !== 'function')
      throw new BridgeError(
        'HOST_MEMBER_UNAVAILABLE',
        `${member.id} is not callable in this host.`,
      );
    const raw = object(args.parameters ?? {});
    boundedJson(raw);
    const refs = referenceIds(raw).map((id) => this.handle(id));
    if (target) refs.unshift(target);
    const resolved =
      member.kind === 'property' && expectedMode === 'mutate'
        ? [resolveValue(raw.value, member.result ?? { kind: 'unknown' }, this)]
        : parametersFor(member, raw, this);
    if (member.kind === 'property') onlyKeys(raw, expectedMode === 'mutate' ? ['value'] : []);
    const p: Prepared = { member, receiver, target, raw, args: resolved, refs, scope: {} };
    p.scope = this.nativeScope(p);
    for (let i = 0; i < member.parameters.length; i++) {
      const parameter = member.parameters[i];
      if (typeof p.args[i] !== 'string') continue;
      if (
        /path|filename|outputFile|presetFile|folder/i.test(parameter.name) &&
        !/display|format|codec/i.test(parameter.name)
      ) {
        const output =
          /output|filename/i.test(parameter.name) ||
          (expectedMode === 'job' &&
            member.className === 'ProjectConverter' &&
            parameter.name === 'filePath');
        p.args[i] = await this.host.path(
          p.args[i],
          member.className === 'ScratchDiskSettings' ||
            (member.id === 'Exporter.exportSequenceFrame' && parameter.name === 'filepath')
            ? 'directory'
            : output
              ? 'write'
              : /folder/i.test(parameter.name)
                ? 'directory'
                : 'read',
        );
      }
    }
    if (member.id === 'Exporter.exportSequenceFrame') {
      const values = Object.fromEntries(
        member.parameters.map((parameter, i) => [parameter.name, p.args[i]]),
      );
      const filename = String(values.filename).replace(/\\/g, '/'),
        directory = String(values.filepath).replace(/\\/g, '/').replace(/\/$/, '');
      if (filename.slice(0, filename.lastIndexOf('/')) !== directory)
        throw new BridgeError(
          'INVALID_API_ARGUMENT',
          'filename must be inside filepath, so the checked output is the actual native output.',
        );
      if (
        ![values.width, values.height].every(
          (v) => Number.isSafeInteger(v) && v > 0 && v <= 16384,
        ) ||
        values.width * values.height > 64000000
      )
        throw new BridgeError(
          'INVALID_API_ARGUMENT',
          'Frame export dimensions must be positive integers, at most 16384 per side and 64 million pixels.',
        );
    }
    return p;
  }
  private async register(
    native: any,
    types: string[],
    scope: ApiScope,
    member?: ApiMember,
  ): Promise<Record<string, unknown>> {
    let final = { ...scope };
    if (types.includes('VideoClipTrackItem') && types.includes('AudioClipTrackItem')) {
      const media = String(await native.getMediaType());
      const constants = this.host.module.Constants?.MediaType;
      if (constants && media === String(constants.VIDEO)) types = ['VideoClipTrackItem'];
      else if (constants && media === String(constants.AUDIO)) types = ['AudioClipTrackItem'];
      else {
        if (!this.mediaKinds.has(media) && scope.sequenceId) {
          try {
            const project = await this.requireProject(scope.projectId),
              sequence = (await project.getSequences()).find(
                (s: any) => s.guid.toString() === scope.sequenceId,
              );
            if (sequence)
              for (const kind of ['Video', 'Audio']) {
                if ((await sequence[`get${kind}TrackCount`]()) > 0) {
                  const track = await sequence[`get${kind}Track`](0);
                  this.mediaKinds.set(String(await track.getMediaType()), `${kind}ClipTrackItem`);
                }
              }
          } catch {}
        }
        if (this.mediaKinds.has(media)) types = [this.mediaKinds.get(media)!];
      }
    }
    if (types.includes('Project')) final = { projectId: native.guid.toString() };
    if (types.includes('Sequence'))
      final = {
        projectId: scope.projectId ?? (await this.requireProject()).guid.toString(),
        sequenceId: native.guid.toString(),
      };
    if (types.some((t) => ['ProjectItem', 'ClipProjectItem', 'FolderItem'].includes(t))) {
      // Specialized native wrappers do not expose ProjectItem#getId.
      // Cast only for identity; retain `native` as the typed API receiver.
      const item = types.includes('FolderItem') || types.includes('ClipProjectItem')
        ? await this.host.module.ProjectItem.cast(native)
        : native;
      const assetId = item.getId();
      if (member?.id === 'Sequence#getProjectItem' && scope.sequenceId)
        this.sequenceItems.set(`${scope.projectId}:${assetId}`, scope.sequenceId);
      final = {
        projectId: scope.projectId,
        assetId,
        ...(this.sequenceItems.has(`${scope.projectId}:${assetId}`)
          ? { sequenceId: this.sequenceItems.get(`${scope.projectId}:${assetId}`) }
          : {}),
      };
    }
    if (types.some((t) => ['VideoClipTrackItem', 'AudioClipTrackItem'].includes(t)))
      final.clip = await this.observeClip(native);
    if (types.some((t) => DRAFTS.has(t))) final = { ownedValue: true };
    if (this.handles.size >= 2000) {
      const first = this.handles.keys().next().value;
      if (first) this.handles.delete(first);
    }
    const candidates = types.length > 1 ? types.slice() : undefined;
    if (types.length > 1) {
      try {
        if (types.includes('MogrtText') && typeof native.getText === 'function')
          types = [typeof native.setText === 'function' ? 'MogrtText' : 'MogrtComment'];
        else if (
          types.includes('Color') &&
          ['red', 'green', 'blue', 'alpha'].every((k) => typeof native[k] === 'number')
        )
          types = ['Color'];
        else if (types.includes('Keyframe') && native.position !== undefined) {
          const value = native.value?.value;
          types = Array.isArray(value) ? ['PointKeyframe'] : ['Keyframe'];
        } else types = [];
      } catch {
        types = [];
      }
    }
    const id = this.id('h');
    this.handles.set(id, {
      id,
      types,
      candidateTypes: candidates,
      native,
      scope: final,
      lastAccess: Date.now(),
    });
    const summary: Record<string, unknown> = {};
    for (const key of ['name', 'displayName', 'id', 'ticks', 'seconds']) {
      try {
        const v = native[key];
        if (['string', 'number', 'boolean'].includes(typeof v))
          summary[key] = typeof v === 'string' ? v.slice(0, 256) : v;
      } catch {}
    }
    return {
      $ref: id,
      types,
      ...(!types.length && candidates
        ? {
            candidateTypes: candidates,
            typeNotice:
              'Ambiguous native union; only members with an identical documented contract in every candidate may be read. Obtain a concrete object through a typed track/getter for writes.',
          }
        : {}),
      summary,
      scope: {
        projectId: final.projectId,
        sequenceId: final.sequenceId,
        assetId: final.assetId,
        ownedValue: final.ownedValue,
        editable: this.editable(final),
      },
    };
  }
  private async encode(
    value: any,
    schema: ApiType,
    scope: ApiScope,
    member?: ApiMember,
    offset = 0,
    limit = 20,
    depth = 0,
  ): Promise<unknown> {
    if (depth > 6) return { truncated: true, reason: 'Nesting limit' };
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.length <= 2048 && !offset) return value;
      const size = Math.min(limit === 20 ? 2048 : limit, 8192);
      return {
        text: value.slice(offset, offset + size),
        page: {
          offset,
          returned: Math.min(size, Math.max(0, value.length - offset)),
          totalCharacters: value.length,
          nextOffset: offset + size < value.length ? offset + size : null,
        },
      };
    }
    if (Array.isArray(value)) {
      const item =
        schema.kind === 'array' ? (schema.items ?? { kind: 'unknown' }) : { kind: 'unknown' };
      const size = Math.min(limit, 50);
      const items = [];
      for (const child of value.slice(offset, offset + size))
        items.push(await this.encode(child, item, scope, member, 0, 20, depth + 1));
      return {
        items,
        page: {
          offset,
          limit: size,
          returned: items.length,
          total: value.length,
          nextOffset: offset + items.length < value.length ? offset + items.length : null,
        },
      };
    }
    if (schema.kind === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(schema.fields ?? {}))
        result[key] = await this.encode(value[key], field.schema, scope, member, 0, 20, depth + 1);
      return result;
    }
    const types = baseTypes(schema).filter((t) => CLASS_MAP.has(t));
    return this.register(value, types.length ? types : ['UnknownNativeObject'], scope, member);
  }
  private invalidate(scope: ApiScope): void {
    for (const [id, h] of this.handles) {
      if (h.scope.ownedValue) continue;
      if (
        scope.sequenceId
          ? h.scope.sequenceId === scope.sequenceId
          : scope.projectId && h.scope.projectId === scope.projectId
      )
        this.handles.delete(id);
    }
  }
  async loadText(args: BridgeArgs): Promise<Record<string, unknown>> {
    if (!this.host.readText)
      throw new BridgeError('TEXT_READER_UNAVAILABLE', 'This runtime has no granted text reader.');
    const text = await this.host.readText(args.path as string);
    const ref = await this.register(text, ['String'], { ownedValue: true });
    return { readOnly: true, value: ref, characters: text.length };
  }
  async context(args: BridgeArgs): Promise<Record<string, unknown>> {
    const project = await this.host.getActiveProject();
    if (!project) return { project: null, sequence: null };
    if (args.projectId && args.projectId !== project.guid.toString())
      throw new BridgeError('ACTIVE_CONTEXT_CHANGED', 'The requested project is no longer active.');
    const sequence = args.sequenceId
      ? (await project.getSequences()).find((s: any) => s.guid.toString() === args.sequenceId)
      : await project.getActiveSequence();
    if (args.sequenceId && !sequence)
      throw new BridgeError('SEQUENCE_NOT_FOUND', 'The requested sequence is not in this project.');
    const scope = { projectId: project.guid.toString() };
    return {
      readOnly: true,
      epoch: this.epoch,
      project: await this.register(project, ['Project'], scope),
      sequence: sequence ? await this.register(sequence, ['Sequence'], scope) : null,
    };
  }
  async read(args: BridgeArgs): Promise<Record<string, unknown>> {
    const p = await this.prepare(args, 'read');
    if (p.scope.projectId) await this.requireProject(p.scope.projectId);
    let value: any;
    try {
      value =
        p.member.kind === 'constant'
          ? this.constant(p.member.id)
          : p.member.kind === 'property'
            ? await p.receiver[p.member.name]
            : await p.receiver[p.member.name](...p.args);
    } catch (e) {
      if (e instanceof BridgeError) throw e;
      throw nativeFailure(p.member.id, false);
    }
    let result = p.member.result ?? { kind: 'unknown' };
    if (p.member.id === 'ClipProjectItem#getComponentChain') {
      if (p.args[0] === this.host.module.Constants?.MediaType?.VIDEO)
        result = { kind: 'ref', name: 'VideoComponentChain' };
      else if (p.args[0] === this.host.module.Constants?.MediaType?.AUDIO)
        result = { kind: 'ref', name: 'AudioComponentChain' };
    }
    return {
      readOnly: true,
      memberId: p.member.id,
      value: await this.encode(
        value,
        result,
        p.scope,
        p.member,
        args.offset ?? 0,
        (args.limit as number | undefined) ?? 20,
      ),
    };
  }
  async construct(args: BridgeArgs): Promise<Record<string, unknown>> {
    const p = await this.prepare(args, 'construct');
    if (typeof p.receiver !== 'function')
      throw new BridgeError(
        'HOST_MEMBER_UNAVAILABLE',
        'This native constructor is unavailable; use a documented factory method.',
      );
    let value;
    try {
      value = new p.receiver(...p.args);
    } catch {
      throw nativeFailure(p.member.id, false);
    }
    return {
      readOnly: true,
      memberId: p.member.id,
      value: await this.encode(
        value,
        p.member.result ?? { kind: 'ref', name: p.member.className },
        { ownedValue: true },
        p.member,
      ),
    };
  }
  async probe(args: BridgeArgs): Promise<Record<string, unknown>> {
    const m = this.member(args.memberId),
      policy = apiPolicy(m);
    let available: boolean | null = null;
    if (m.kind === 'constant') {
      try {
        this.constant(m.id);
        available = true;
      } catch {
        available = false;
      }
    } else if (m.kind === 'static')
      available = typeof this.host.module[m.className]?.[m.name] === 'function';
    else if (m.kind === 'constructor')
      available = typeof this.host.module[m.className] === 'function';
    else if (args.target) {
      const h = this.handle(args.target as string);
      if (!h.types.includes(m.className))
        throw new BridgeError('INVALID_API_ARGUMENT', 'Target type does not match the member.');
      available =
        m.kind === 'property' ? m.name in h.native : typeof h.native[m.name] === 'function';
    }
    return {
      memberId: m.id,
      minimumVersion: m.since,
      hostVersion: this.host.version,
      policy,
      nativeAvailable: available,
      verification:
        available === null
          ? 'Requires an instance handle'
          : available
            ? 'Member exists; behavior has not been tested by this probe'
            : 'Unavailable in the connected runtime',
    };
  }
  release(args: BridgeArgs): Record<string, unknown> {
    let count = 0;
    for (const id of args.handles as string[]) if (this.handles.delete(id)) count++;
    return { released: count };
  }
  private authorize(p: Prepared): void {
    const policy = apiPolicy(p.member);
    if (p.member.kind === 'property') {
      if (!p.member.access?.includes('W') || !p.target?.scope.ownedValue)
        throw new BridgeError(
          'API_POLICY_BLOCKED',
          'Only owned draft/value properties can be assigned directly.',
        );
      return;
    }
    if (policy.scope === 'value') {
      if (!p.target?.scope.ownedValue)
        throw new BridgeError(
          'API_POLICY_BLOCKED',
          'Only a bridge-owned draft value may be changed.',
        );
      return;
    }
    if (['ui', 'export', 'project'].includes(policy.scope ?? '')) return;
    if (['FolderItem#createBinAction', 'FolderItem#createSmartBinAction'].includes(p.member.id))
      return;
    if (
      ['FolderItem#createRemoveItemAction', 'FolderItem#createMoveItemAction'].includes(p.member.id)
    ) {
      const itemIndex = p.member.parameters.findIndex((parameter) => parameter.name === 'item');
      const item = p.refs.find(
        (h) =>
          h.native === p.args[itemIndex] &&
          h.types.some((t) => ['ProjectItem', 'ClipProjectItem'].includes(t)),
      );
      if (item && this.editable(item.scope)) return;
      throw new BridgeError(
        'SOURCE_SEQUENCE_PROTECTED',
        'The item being removed or moved is not owned by this bridge session.',
      );
    }
    if (!this.editable(p.scope))
      throw new BridgeError(
        'SOURCE_SEQUENCE_PROTECTED',
        'This native object is not in a bridge-created working sequence or a bridge-owned imported asset.',
      );
  }
  private async protectSharedAssets(project: any, p: Prepared): Promise<void> {
    if (['FolderItem#createBinAction', 'FolderItem#createSmartBinAction'].includes(p.member.id))
      return;
    const policy = apiPolicy(p.member);
    if (
      policy.scope === 'value' ||
      policy.scope === 'ui' ||
      policy.scope === 'export' ||
      policy.scope === 'project'
    )
      return;
    const folderItem = [
      'FolderItem#createRemoveItemAction',
      'FolderItem#createMoveItemAction',
    ].includes(p.member.id)
      ? p.refs.find((h) => h !== p.target && h.types.includes('ProjectItem'))
      : undefined;
    const scope = folderItem?.scope ?? p.scope;
    if (!scope.assetId || scope.sequenceId) return;
    const ids = new Set([scope.assetId]);
    if (p.member.id === 'FolderItem#createRemoveItemAction' && folderItem) {
      let folder: any;
      try {
        folder = this.host.module.FolderItem.cast(folderItem.native);
      } catch {}
      if (folder) {
        const visit = async (bin: any): Promise<void> => {
          for (const item of await bin.getItems()) {
            if (ids.size >= 2000)
              throw new BridgeError(
                'ASSET_OWNERSHIP_UNVERIFIABLE',
                'The bin is too large to verify ownership safely.',
              );
            const id = item.getId();
            if (!this.ownedAssets.has(`${scope.projectId}:${id}`))
              throw new BridgeError(
                'SOURCE_ASSET_PROTECTED',
                'This bin contains an item the bridge does not own.',
              );
            ids.add(id);
            let child: any;
            try {
              child = this.host.module.FolderItem.cast(item);
            } catch {}
            if (child) await visit(child);
          }
        };
        await visit(folder);
      }
    }
    for (const sequence of await project.getSequences()) {
      if (this.control.mayEdit(project.guid.toString(), sequence.guid.toString())) continue;
      for (const kind of ['Video', 'Audio']) {
        const count = await sequence[`get${kind}TrackCount`]();
        for (let i = 0; i < count; i++) {
          const track = await sequence[`get${kind}Track`](i);
          const clips = track.getTrackItems(this.host.module.Constants.TrackItemType.CLIP, false);
          for (const clip of clips) {
            const item = await clip.getProjectItem();
            if (ids.has(item.getId()))
              throw new BridgeError(
                'SOURCE_ASSET_PROTECTED',
                'This imported item is now used by a protected source sequence. Shared media cannot be changed or deleted through the working-copy adapter.',
              );
          }
          if (
            track.getTrackItems(this.host.module.Constants.TrackItemType.CLIP, false).length !==
            clips.length
          )
            throw new BridgeError(
              'ACTIVE_CONTEXT_CHANGED',
              'The source inventory changed during asset ownership verification.',
            );
        }
      }
    }
  }
  private withSelections(prepared: Prepared[], run: () => void): void {
    const selections: Array<{ p: Prepared; index: number; items: ApiHandle[] }> = [];
    for (const p of prepared)
      for (let i = 0; i < p.member.parameters.length; i++)
        if (
          p.member.parameters[i].schema?.kind === 'ref' &&
          p.member.parameters[i].schema?.name === 'TrackItemSelection' &&
          p.raw[p.member.parameters[i].name] &&
          typeof p.raw[p.member.parameters[i].name] === 'object'
        ) {
          const raw = p.raw[p.member.parameters[i].name] as Record<string, unknown>;
          if ('$selection' in raw)
            selections.push({
              p,
              index: i,
              items: (raw.$selection as string[]).map((id) => this.handle(id)),
            });
        }
    const next = (index: number) => {
      if (index === selections.length) {
        run();
        return;
      }
      const entry = selections[index];
      let called = false;
      const ok = this.host.module.TrackItemSelection.createEmptySelection((selection: any) => {
        called = true;
        for (const h of entry.items) selection.addItem(h.native, false);
        entry.p.args[entry.index] = selection;
        next(index + 1);
      });
      if (!called || ok === false)
        throw new BridgeError('HOST_API_ERROR', 'Premiere did not create the temporary selection.');
    };
    next(0);
  }
  async actions(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    const specs = args.actions as Array<Record<string, unknown>>;
    if (!Array.isArray(specs) || !specs.length || specs.length > 20)
      throw new BridgeError('INVALID_API_ARGUMENT', 'Provide 1–20 action descriptors.');
    const prepared: Prepared[] = [];
    for (const spec of specs) {
      onlyKeys(spec, ['memberId', 'target', 'parameters']);
      const p = await this.prepare(spec as BridgeArgs, 'action');
      this.authorize(p);
      prepared.push(p);
    }
    const scoped = prepared.map((p) => p.scope.sequenceId).filter(Boolean);
    if (new Set(scoped).size > 1)
      throw new BridgeError(
        'INVALID_API_ARGUMENT',
        'An action batch may target only one working sequence.',
      );
    const scope: ApiScope = {
      projectId: project.guid.toString(),
      ...(scoped[0] ? { sequenceId: scoped[0] } : {}),
    };
    for (const p of prepared) await this.validateRefs(p.refs, scope.projectId, scope.sequenceId);
    for (const p of prepared) await this.protectSharedAssets(project, p);
    const bins = prepared.filter((p) =>
      ['FolderItem#createBinAction', 'FolderItem#createSmartBinAction'].includes(p.member.id),
    );
    const snapshots = await Promise.all(
      bins.map(async (p) => ({
        p,
        before: new Set((await p.receiver.getItems()).map((v: any) => v.getId())),
      })),
    );
    await this.requireProject(args.projectId);
    this.writeGate(expiresAt);
    let accepted = false;
    try {
      project.lockedAccess(() => {
        this.writeGate(expiresAt);
        this.withSelections(prepared, () => {
          accepted = project.executeTransaction((compound: any) => {
            for (const p of prepared) compound.addAction(p.receiver[p.member.name](...p.args));
          }, 'MCP: native API actions');
        });
      });
    } catch (e) {
      if (e instanceof BridgeError) throw e;
      throw nativeFailure('Action batch');
    }
    if (!accepted)
      throw new BridgeError(
        'OPERATION_OUTCOME_UNKNOWN',
        'Premiere did not confirm the action batch. Inspect the working sequence before another edit.',
      );
    for (const snapshot of snapshots) {
      const after = await snapshot.p.receiver.getItems();
      const added = after.filter((v: any) => !snapshot.before.has(v.getId()));
      if (added.length === 1) this.ownedAssets.add(`${scope.projectId}:${added[0].getId()}`);
    }
    this.invalidate(scope);
    return {
      readOnly: false,
      appliedActions: prepared.map((p) => p.member.id),
      invalidatedScope: scope,
      saved: false,
    };
  }
  async mutate(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    const p = await this.prepare(args, 'mutate');
    this.authorize(p);
    await this.validateRefs(p.refs, project.guid.toString(), p.scope.sequenceId);
    await this.protectSharedAssets(project, p);
    await this.requireProject(args.projectId);
    this.writeGate(expiresAt);
    let value;
    try {
      if (p.member.kind === 'property') {
        p.receiver[p.member.name] = p.args[0];
        value = p.args[0];
      } else {
        let promise: any;
        this.withSelections([p], () => {
          promise = p.receiver[p.member.name](...p.args);
        });
        value = await promise;
      }
    } catch {
      throw nativeFailure(p.member.id);
    }
    if (p.member.id === 'Sequence#createSubsequence' && value)
      this.control.markWorking(project, value);
    if (!p.scope.ownedValue) this.invalidate({ ...p.scope, projectId: project.guid.toString() });
    return {
      readOnly: false,
      memberId: p.member.id,
      value: await this.encode(value, p.member.result ?? { kind: 'unknown' }, p.scope, p.member),
      saved: false,
    };
  }
  async startJob(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    const p = await this.prepare(args, 'job');
    this.authorize(p);
    await this.validateRefs(p.refs, project.guid.toString(), p.scope.sequenceId);
    await this.protectSharedAssets(project, p);
    if (
      p.member.className === 'SequenceUtils' &&
      (await project.getActiveSequence())?.guid.toString() !== p.scope.sequenceId
    )
      throw new BridgeError(
        'WORKING_SEQUENCE_NOT_ACTIVE',
        'Scene detection uses selection context. Explicitly activate the working sequence before starting it.',
      );
    const isExport = apiPolicy(p.member).scope === 'export';
    if (
      isExport &&
      !p.member.parameters.some(
        (param, i) => /output|filename|filePath/i.test(param.name) && typeof p.args[i] === 'string',
      )
    )
      throw new BridgeError(
        'INVALID_API_ARGUMENT',
        'Exports require an explicit granted output path.',
      );
    if (this.jobs.size >= 100)
      throw new BridgeError(
        'JOB_LIMIT',
        'Release/restart the plugin after reviewing retained job outcomes.',
      );
    await this.requireProject(args.projectId);
    this.writeGate(expiresAt);
    const id = this.id('job');
    const job: Job = {
      id,
      memberId: p.member.id,
      state: 'running',
      createdAt: new Date().toISOString(),
      scope: { ...p.scope, projectId: project.guid.toString() },
    };
    this.jobs.set(id, job);
    try {
      let promise: any;
      project.lockedAccess(() =>
        this.withSelections([p], () => {
          promise = p.receiver[p.member.name](...p.args);
        }),
      );
      Promise.resolve(promise)
        .then(
          async (result) => {
            job.result = await this.encode(
              result,
              p.member.result ?? { kind: 'unknown' },
              p.scope,
              p.member,
            );
            if (!isExport) this.invalidate(job.scope);
            job.state = result === false ? 'native_returned_false' : 'native_succeeded';
            job.finishedAt = new Date().toISOString();
          },
          () => {
            job.state = 'failed';
            job.error = {
              code: 'HOST_API_ERROR',
              message: 'The native job failed. Inspect Premiere; do not automatically restart it.',
            };
            job.finishedAt = new Date().toISOString();
          },
        )
        .catch(() => {
          job.state = 'failed';
          job.error = {
            code: 'JOB_RESULT_UNAVAILABLE',
            message:
              'Native work settled but its result could not be serialized. Inspect Premiere.',
          };
          job.finishedAt = new Date().toISOString();
        });
    } catch {
      this.jobs.delete(id);
      throw nativeFailure(p.member.id);
    }
    return {
      readOnly: false,
      jobId: id,
      state: job.state,
      completionMeaning:
        'Native Promise settlement; queued AME work may continue after it settles.',
    };
  }
  job(args: BridgeArgs): Record<string, unknown> {
    const job = this.jobs.get(args.jobId as string);
    if (!job)
      throw new BridgeError(
        'JOB_NOT_FOUND',
        'Job is unknown in this plugin session. Native work may continue after reload; inspect Premiere before restarting.',
      );
    return { ...job, scope: { projectId: job.scope.projectId, sequenceId: job.scope.sequenceId } };
  }
  afterLegacyWrite(args: BridgeArgs): void {
    if (typeof args.projectId === 'string')
      this.invalidate({
        projectId: args.projectId,
        ...(typeof args.sequenceId === 'string' ? { sequenceId: args.sequenceId } : {}),
      });
  }
  async importSnapshot(
    paths: string[],
    expectedProjectId?: unknown,
    diagnostics?: ImportDiagnostics,
  ): Promise<{ projectId: string; root: any; ids: Set<string>; files: string[] }> {
    diagnostics?.at('preparation', 'snapshot_project');
    const project = await this.requireProject(expectedProjectId);
    diagnostics?.at('preparation', 'snapshot_root');
    const root = await project.getRootItem();
    diagnostics?.at('preparation', 'snapshot_items');
    const items = await root.getItems();
    diagnostics?.at('preparation', 'snapshot_ids');
    const ids = new Set<string>(items.map((v: any) => v.getId()));
    diagnostics?.at('path_validation', 'snapshot_paths');
    const files = await Promise.all(paths.map((path) => this.host.path(path, 'read')));
    return {
      projectId: project.guid.toString(),
      root,
      ids,
      files,
    };
  }
  async captureImports(before: {
    projectId: string;
    root: any;
    ids: Set<string>;
    files: string[];
  }, diagnostics?: ImportDiagnostics): Promise<void> {
    diagnostics?.at('result_registration', 'capture_project');
    await this.requireProject(before.projectId);
    const candidates = new Map<string, string[]>();
    diagnostics?.at('result_registration', 'capture_items');
    const items = await before.root.getItems();
    for (const item of items) {
      diagnostics?.at('result_registration', 'capture_identity');
      const id = item.getId();
      if (before.ids.has(id)) continue;
      let clip;
      try {
        clip = this.host.module.ClipProjectItem.cast(item);
      } catch {
        // A concurrently added bin/non-clip is not an imported media candidate.
        continue;
      }
      diagnostics?.at('result_registration', 'capture_media_path');
      const path = await clip.getMediaFilePath();
      if (before.files.includes(path))
        candidates.set(path, [...(candidates.get(path) ?? []), id]);
    }
    diagnostics?.at('result_registration', 'register_assets');
    for (const ids of candidates.values())
      if (ids.length === 1) this.ownedAssets.add(`${before.projectId}:${ids[0]}`);
  }
  async sequenceFromMedia(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    const refs = (args.items as string[]).map((id) => this.handle(id));
    if (!refs.every((h) => h.types.includes('ClipProjectItem')))
      throw new BridgeError('INVALID_API_ARGUMENT', 'items must contain ClipProjectItem handles.');
    await this.validateRefs(refs, project.guid.toString());
    this.writeGate(expiresAt);
    let sequence;
    try {
      sequence = await project.createSequenceFromMedia(
        args.name,
        refs.map((h) => h.native),
        await this.host.module.ProjectItem.cast(await project.getRootItem()),
      );
    } catch {
      throw nativeFailure('Project#createSequenceFromMedia');
    }
    this.control.markWorking(project, sequence);
    return {
      readOnly: false,
      sequenceId: sequence.guid.toString(),
      sequence: await this.register(sequence, ['Sequence'], { projectId: project.guid.toString() }),
      saved: false,
    };
  }
  async sequenceFromPreset(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    if (typeof args.path !== 'string' || !args.path.toLowerCase().endsWith('.sqp'))
      throw new BridgeError('INVALID_API_ARGUMENT', 'A relative .sqp preset path is required.');
    const path = await this.host.path(args.path, 'read');
    this.writeGate(expiresAt);
    let sequence;
    try {
      sequence = await project.createSequenceWithPresetPath(args.name, path);
    } catch {
      throw nativeFailure('Project#createSequenceWithPresetPath');
    }
    this.control.markWorking(project, sequence);
    return {
      readOnly: false,
      sequenceId: sequence.guid.toString(),
      sequence: await this.register(sequence, ['Sequence'], { projectId: project.guid.toString() }),
      saved: false,
    };
  }
  async deleteWorking(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId),
      id = args.sequenceId as string;
    if (!this.control.mayEdit(project.guid.toString(), id))
      throw new BridgeError(
        'SOURCE_SEQUENCE_PROTECTED',
        'Only a bridge-created working sequence may be deleted.',
      );
    if ([...this.jobs.values()].some((j) => j.scope.sequenceId === id && j.state === 'running'))
      throw new BridgeError('JOB_IN_PROGRESS', 'A native job still uses this sequence.');
    const seq = (await project.getSequences()).find((v: any) => v.guid.toString() === id);
    if (!seq) throw new BridgeError('SEQUENCE_NOT_FOUND', 'The working sequence no longer exists.');
    this.writeGate(expiresAt);
    let accepted;
    try {
      accepted = await project.deleteSequence(seq);
    } catch {
      throw nativeFailure('Project#deleteSequence');
    }
    if (!accepted)
      throw new BridgeError(
        'OPERATION_OUTCOME_UNKNOWN',
        'Premiere did not confirm sequence deletion. Inspect it before another write.',
      );
    this.control.forgetWorking(project.guid.toString(), id);
    this.invalidate({ projectId: project.guid.toString(), sequenceId: id });
    return { readOnly: false, deletedSequenceId: id, saved: false };
  }
  async save(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    this.writeGate(expiresAt);
    let result;
    try {
      result = await project.save();
    } catch {
      throw nativeFailure('Project#save');
    }
    if (!result)
      throw new BridgeError(
        'OPERATION_OUTCOME_UNKNOWN',
        'Premiere did not confirm saving. Inspect the project file.',
      );
    return { readOnly: false, projectId: project.guid.toString(), saved: true };
  }
  async saveAs(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const project = await this.requireProject(args.projectId);
    if (typeof args.path !== 'string' || !args.path.toLowerCase().endsWith('.prproj'))
      throw new BridgeError('INVALID_API_ARGUMENT', 'A relative .prproj path is required.');
    const path = await this.host.path(args.path, 'write');
    this.writeGate(expiresAt);
    let result;
    try {
      result = await project.saveAs(path);
    } catch {
      throw nativeFailure('Project#saveAs');
    }
    this.invalidate({ projectId: args.projectId as string });
    if (!result)
      throw new BridgeError(
        'OPERATION_OUTCOME_UNKNOWN',
        'Premiere did not confirm Save As. Inspect the destination before any retry.',
      );
    return {
      readOnly: false,
      saved: true,
      projectId: (await this.host.getActiveProject())?.guid.toString() ?? null,
      contextChanged: true,
    };
  }
  async openProject(args: BridgeArgs, expiresAt: number): Promise<Record<string, unknown>> {
    this.writeGate(expiresAt);
    const active = await this.host.getActiveProject();
    if ((active?.guid.toString() ?? 'none') !== args.projectId)
      throw new BridgeError('ACTIVE_CONTEXT_CHANGED', 'The active project changed.');
    if (typeof args.path !== 'string' || !args.path.toLowerCase().endsWith('.prproj'))
      throw new BridgeError('INVALID_API_ARGUMENT', 'A relative .prproj path is required.');
    const path = await this.host.path(args.path, args.createNew ? 'write' : 'read');
    this.writeGate(expiresAt);
    let project;
    try {
      project = args.createNew
        ? await this.host.module.Project.createProject(path)
        : await this.host.module.Project.open(path);
    } catch {
      throw nativeFailure(args.createNew ? 'Project.createProject' : 'Project.open');
    }
    return {
      readOnly: false,
      projectId: project.guid.toString(),
      created: !!args.createNew,
      contextChanged: true,
      project: await this.register(project, ['Project'], {}),
    };
  }

  subscribe(args: BridgeArgs): Record<string, unknown> {
    if (this.subscriptions.size >= 32)
      throw new BridgeError('SUBSCRIPTION_LIMIT', 'At most 32 event subscriptions are allowed.');
    const event = this.member(args.eventId);
    if (event.kind !== 'constant' || !event.enum?.endsWith('Event'))
      throw new BridgeError('INVALID_API_ARGUMENT', 'Use a documented Constants.*Event member ID.');
    const target = args.target ? this.handle(args.target as string) : undefined;
    if (
      target &&
      !target.types.some((t) =>
        ['Project', 'Sequence', 'VideoTrack', 'AudioTrack', 'EncoderManager'].includes(t),
      )
    )
      throw new BridgeError('INVALID_API_ARGUMENT', 'This target does not support native events.');
    const id = this.id('sub'),
      eventName = this.constant(event.id);
    const callback = (data?: any) => {
      const record: Record<string, unknown> = {
        cursor: ++this.eventCounter,
        subscriptionId: id,
        eventId: event.id,
        receivedAt: new Date().toISOString(),
      };
      for (const key of ['id', 'state', 'progress', 'jobId', 'result']) {
        try {
          const value = data?.[key];
          if (['number', 'boolean'].includes(typeof value)) record[key] = value;
          else if (typeof value === 'string' && !/[\\/]/.test(value)) record[key] = value.slice(0, 256);
        } catch {}
      }
      if (this.events.length >= 100) {
        this.events.shift();
        this.droppedEvents++;
      }
      this.events.push(record);
    };
    const manager = this.host.module.EventManager;
    if (!manager) throw new BridgeError('HOST_MEMBER_UNAVAILABLE', 'EventManager is unavailable.');
    try {
      if (target) manager.addEventListener(target.native, eventName, callback, false);
      else manager.addGlobalEventListener(eventName, callback, false);
    } catch {
      throw nativeFailure('EventManager subscription', false);
    }
    this.subscriptions.set(id, { target: target?.native, eventName, callback, eventId: event.id });
    return { readOnly: true, subscriptionId: id, eventId: event.id, bufferLimit: 100 };
  }
  pollEvents(args: BridgeArgs): Record<string, unknown> {
    const cursor = (args.afterCursor as number | undefined) ?? 0,
      limit = args.limit ?? 50;
    const events = this.events.filter((v) => (v.cursor as number) > cursor).slice(0, limit);
    return {
      readOnly: true,
      events,
      nextCursor: events.length
        ? events[events.length - 1].cursor
        : Math.max(cursor, this.eventCounter),
      droppedEvents: this.droppedEvents,
      epoch: this.epoch,
    };
  }
  unsubscribe(args: BridgeArgs): Record<string, unknown> {
    const id = args.subscriptionId as string,
      sub = this.subscriptions.get(id);
    if (!sub) return { readOnly: true, removed: false };
    try {
      if (sub.target)
        this.host.module.EventManager.removeEventListener(
          sub.target,
          sub.eventName,
          sub.callback,
          false,
        );
      else
        this.host.module.EventManager.removeGlobalEventListener(sub.eventName, sub.callback, false);
    } catch {
      throw nativeFailure('EventManager unsubscription', false);
    }
    this.subscriptions.delete(id);
    return { readOnly: true, removed: true };
  }
  dispose(): void {
    for (const id of [...this.subscriptions.keys()])
      try {
        this.unsubscribe({ subscriptionId: id });
      } catch {}
    this.handles.clear();
  }
}

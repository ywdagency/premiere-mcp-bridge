import { BridgeError, UUID_PATTERN, utf8ByteLength } from './bridge-protocol';
import type { UxpFolder } from './uxp-bridge';

type Submission = 'not_submitted' | 'submission_unknown' | 'native_accepted' | 'native_rejected';
interface RenderEntry {
  projectItemId: string;
  outputPath: string;
  nativeOutput: string;
  submission: Submission;
  render: 'unconfirmed' | 'complete_event';
  nativeJobId?: string;
}
interface Batch {
  version: 1;
  operationId: string;
  projectId: string;
  presetPath: string;
  createdAt: string;
  session: string;
  entries: RenderEntry[];
  stopped: boolean;
}
export interface PreparedRender {
  projectItemId: string;
  outputPath: string;
  nativeOutput: string;
  invoke(): unknown;
}
const fileName = (id: string) => `render-batch-${id}.json`;
const pathKey = (path: string) => path.replace(/\\/g, '/');
const relativePath = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && p.length <= 1024 &&
  !/[\\:\u0000]/.test(p) && !p.split('/').some((s) => !s || s === '.' || s === '..');

/** Durable submission evidence, not a replacement/editing authority or an AME queue owner. */
export class RenderBatches {
  private folder?: UxpFolder;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly records = new Map<string, Batch>();
  private storageFault = false;
  constructor(private readonly session: string) {}
  attach(folder: UxpFolder): void { this.folder = folder; }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.pending.then(fn);
    this.pending = result.catch(() => undefined);
    return result;
  }
  private async persist(batch: Batch): Promise<void> {
    if (!this.folder) throw new BridgeError('RENDER_STORAGE_UNAVAILABLE', 'Render batches require connected plugin-owned storage.');
    if (this.storageFault) throw new BridgeError('RENDER_STORAGE_FAILED', 'Render evidence could not be saved. Inspect existing jobs; do not resubmit.');
    try {
      const tmp = await this.folder.createFile(fileName(batch.operationId) + '.tmp', { overwrite: true });
      await tmp.write(JSON.stringify(batch));
      await this.folder.renameEntry(tmp, fileName(batch.operationId), { overwrite: true });
    } catch {
      this.storageFault = true;
      throw new BridgeError('RENDER_STORAGE_FAILED', 'Render evidence could not be saved. Native work may continue; never resubmit blindly.');
    }
  }
  private async load(id: string): Promise<Batch> {
    if (!UUID_PATTERN.test(id)) throw new BridgeError('INVALID_REQUEST', 'Use the batch operation UUID.');
    const cached = this.records.get(id);
    if (cached) return cached;
    if (!this.folder) throw new BridgeError('RENDER_STORAGE_UNAVAILABLE', 'Render storage is unavailable.');
    const file = (await this.folder.getEntries()).find((f) => f.isFile && f.name === fileName(id));
    if (!file) throw new BridgeError('RENDER_BATCH_NOT_FOUND', 'This batch is unknown. Do not infer that native work stopped or resubmit it.');
    try {
      const text = await file.read();
      if (utf8ByteLength(text) > 65536) throw new Error();
      const b = JSON.parse(text) as Batch;
      if (b.version !== 1 || b.operationId !== id || typeof b.projectId !== 'string' || b.projectId.length > 128 ||
          typeof b.session !== 'string' || !relativePath(b.presetPath) || typeof b.createdAt !== 'string' ||
          typeof b.stopped !== 'boolean' || !Array.isArray(b.entries) || b.entries.length < 1 || b.entries.length > 10 ||
          b.entries.some((e) => !e || typeof e.projectItemId !== 'string' || e.projectItemId.length > 128 || !relativePath(e.outputPath) ||
            !e.outputPath.split('/').pop()!.startsWith(`${id}-`) ||
            typeof e.nativeOutput !== 'string' || e.nativeOutput.length > 4096 ||
            !['not_submitted', 'submission_unknown', 'native_accepted', 'native_rejected'].includes(e.submission) ||
            !['unconfirmed', 'complete_event'].includes(e.render) ||
            (e.nativeJobId !== undefined && (typeof e.nativeJobId !== 'string' || e.nativeJobId.length > 256)))) throw new Error();
      this.records.set(id, b);
      return b;
    } catch { throw new BridgeError('RENDER_EVIDENCE_INVALID', 'Saved render evidence is invalid. Inspect native jobs without resubmitting.'); }
  }
  private view(batch: Batch): Record<string, unknown> {
    return {
      operationId: batch.operationId, projectId: batch.projectId, presetPath: batch.presetPath,
      createdAt: batch.createdAt, previousSession: batch.session !== this.session,
      stopped: batch.stopped, evidenceSaved: !this.storageFault,
      queueStartRequested: false, timelineChanged: false, saved: false,
      entries: batch.entries.map((entry) => ({ projectItemId: entry.projectItemId, outputPath: entry.outputPath,
        submission: entry.submission, render: entry.render, ...(entry.nativeJobId ? { nativeJobId: entry.nativeJobId } : {}),
        completion: entry.render === 'complete_event' ? 'render_event_observed' :
          batch.session !== this.session && entry.submission !== 'not_submitted' ? 'unknown_after_restart' : 'unconfirmed',
      })),
      outputSuitability: 'unverified', replacementAllowed: false,
      notice: 'A matched render-complete event is separate from file readability, dimensions, frame rate and alpha preservation. No replacement or native Restore Unrendered is performed. Unknown jobs must not be resubmitted.',
    };
  }
  async get(id: string, projectId: string): Promise<Record<string, unknown>> {
    return this.serial(async () => {
      const b = await this.load(id);
      if (b.projectId !== projectId) throw new BridgeError('ACTIVE_CONTEXT_CHANGED', 'This batch belongs to a different project.');
      return { readOnly: true, ...this.view(b) };
    });
  }
  async assertNoPending(projectId: string): Promise<void> {
    if (!this.folder) return;
    await this.serial(async () => {
      const files = (await this.folder!.getEntries()).filter((f) => /^render-batch-[0-9a-f-]{36}\.json$/.test(f.name));
      if (files.length > 100) throw new BridgeError('RENDER_BATCH_LIMIT', 'Inspect saved render evidence before project lifecycle changes.');
      for (const file of files) await this.load(file.name.slice(13, -5));
      if ([...this.records.values()].some((b) => b.projectId === projectId && b.entries.some((e) =>
        e.submission !== 'not_submitted' && e.submission !== 'native_rejected' && e.render !== 'complete_event')))
        throw new BridgeError('RENDER_BATCH_IN_PROGRESS', 'Render outputs remain unconfirmed. Inspect their saved batch evidence before closing the project or deleting working sequences; do not resubmit them.');
    });
  }
  async start(operationId: string, projectId: string, presetPath: string, entries: PreparedRender[],
    beforeInvoke: () => Promise<void>): Promise<Record<string, unknown>> {
    if (!this.folder) throw new BridgeError('RENDER_STORAGE_UNAVAILABLE', 'Connect plugin-owned storage before submitting renders.');
    // The ordinary operation journal also prevents replays. Check here for fail-closed recovery
    // if a caller reaches this adapter directly or its transport receipt was lost.
    const files = await this.folder.getEntries();
    if (this.records.has(operationId) || files.some((f) => f.name === fileName(operationId) || f.name === fileName(operationId) + '.tmp'))
      throw new BridgeError('RENDER_BATCH_EXISTS', 'Inspect the existing batch; never submit it again.');
    if (files.filter((f) => /^render-batch-.*\.json(?:\.tmp)?$/.test(f.name)).length >= 100)
      throw new BridgeError('RENDER_BATCH_LIMIT', 'Render evidence storage is full. Preserve existing jobs; no automatic cleanup is performed.');
    const b: Batch = { version: 1, operationId, projectId, presetPath, session: this.session,
      createdAt: new Date().toISOString(), stopped: false,
      entries: entries.map(({ projectItemId, outputPath, nativeOutput }) => ({ projectItemId, outputPath, nativeOutput,
        submission: 'not_submitted', render: 'unconfirmed' })) };
    this.records.set(operationId, b);
    await this.serial(() => this.persist(b));
    for (let i = 0; i < entries.length; i++) {
      if (b.stopped || this.storageFault || b.entries.some((e) => e.submission === 'native_rejected')) {
        b.stopped = true;
        await this.serial(() => this.persist(b));
        break;
      }
      try {
        await beforeInvoke();
        await this.serial(async () => { b.entries[i].submission = 'submission_unknown'; await this.persist(b); });
        // Recheck after durable I/O; no Action or native callback escapes a lock.
        await beforeInvoke();
        if (b.stopped || b.entries.some((e) => e.submission === 'native_rejected')) {
          // An earlier Promise settled during storage I/O. This item has not been invoked.
          b.entries[i].submission = 'not_submitted';
          b.stopped = true;
          await this.serial(() => this.persist(b));
          break;
        }
      } catch {
        if (!this.storageFault) b.entries[i].submission = 'not_submitted';
        b.stopped = true;
        await this.serial(() => this.persist(b));
        break;
      }
      let promise: unknown;
      try { promise = entries[i].invoke(); }
      catch {
        b.stopped = true;
        await this.serial(() => this.persist(b));
        break;
      }
      // Never await the native encoder Promise inside IPC. It may settle before rendering
      // or remain pending until completion. An indeterminate item is never retried.
      void Promise.resolve(promise).then((result) => this.serial(async () => {
        b.entries[i].submission = result === true ? 'native_accepted' : result === false ? 'native_rejected' : 'submission_unknown';
        if (typeof result !== 'boolean') b.stopped = true;
        await this.persist(b);
      }), () => this.serial(async () => { b.stopped = true; await this.persist(b); })).catch(() => { this.storageFault = true; });
      if (this.storageFault) { b.stopped = true; break; }
    }
    return this.serial(async () => ({ readOnly: false, ...this.view(b) }));
  }
  /** Only outputFiles can bind a native completion to a boolean-returning encode call.
   * Queue/progress/error job IDs cannot be attributed by timing or queue order. */
  complete(event: unknown): void {
    try {
      const e = event as { jobID?: unknown; outputFiles?: unknown };
      if (!Array.isArray(e?.outputFiles) || e.outputFiles.length < 1 || e.outputFiles.length > 20 ||
          !e.outputFiles.every((p) => typeof p === 'string' && p.length <= 4096)) return;
      const paths = new Set((e.outputFiles as string[]).map(pathKey));
      const jobID = e.jobID;
      void this.serial(async () => {
        for (const b of this.records.values()) {
          // Never update a prior plugin session from uncorrelated live events.
          if (b.session !== this.session) continue;
          let changed = false;
          for (const entry of b.entries) {
            if (entry.submission !== 'not_submitted' && paths.has(pathKey(entry.nativeOutput)) && entry.render !== 'complete_event') {
              entry.render = 'complete_event'; changed = true;
              if (typeof jobID === 'string' && jobID.length > 0 && jobID.length <= 256 && !/[\\/\u0000]/.test(jobID)) entry.nativeJobId = jobID;
            }
          }
          if (changed) await this.persist(b);
        }
      }).catch(() => { this.storageFault = true; });
    } catch { /* Malformed native payload is not completion evidence. */ }
  }
}

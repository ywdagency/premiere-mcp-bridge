// Public release metadata only. Never send host/project data or accept arbitrary URLs.
export const REPOSITORY_URL = 'https://github.com/ywdagency/premiere-mcp-bridge';
export const UPDATES_URL = 'https://raw.githubusercontent.com/ywdagency/premiere-mcp-bridge/main/updates.json';
export const UPDATE_CACHE_KEY = 'premiere-mcp-updates-v1';
export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_TIMEOUT_MS = 8000;
const MAX_MANIFEST_LENGTH = 8192;

export interface UpdateManifest {
  schemaVersion: 1;
  latest: { version: string; minimumPremiereVersion: string; releaseUrl: string };
  criticalBelow: string | null;
}
export interface VersionIndicator {
  state: 'neutral' | 'update' | 'critical';
  url: string;
  title: string;
}
interface Cache { checkedAt: number; manifest: UpdateManifest | null }
interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface UpdateOptions {
  installedVersion: string;
  hostVersion: string;
  storage?: Store;
  fetcher?: typeof fetch;
  onChange(): void;
  now?: () => number;
  schedule?: typeof setTimeout;
  unschedule?: typeof clearTimeout;
}

function versionParts(value: unknown): number[] | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)) return null;
  return value.split('.').map(Number);
}
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a), right = versionParts(b);
  if (!left || !right) throw new Error('Expected a numeric major.minor.patch version.');
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  return 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}
export function parseUpdateManifest(value: unknown): UpdateManifest {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'latest', 'criticalBelow']) || value.schemaVersion !== 1 ||
      !record(value.latest) || !exactKeys(value.latest, ['version', 'minimumPremiereVersion', 'releaseUrl']))
    throw new Error('Invalid update manifest.');
  const latest = value.latest;
  if (!versionParts(latest.version) || !versionParts(latest.minimumPremiereVersion) ||
      latest.releaseUrl !== `${REPOSITORY_URL}/releases/tag/v${latest.version}` ||
      (value.criticalBelow !== null && (!versionParts(value.criticalBelow) ||
        compareVersions(value.criticalBelow as string, latest.version as string) > 0)))
    throw new Error('Invalid release version, compatibility or URL.');
  return {
    schemaVersion: 1,
    latest: { version: latest.version as string, minimumPremiereVersion: latest.minimumPremiereVersion as string, releaseUrl: latest.releaseUrl as string },
    criticalBelow: value.criticalBelow as string | null,
  };
}
export function versionIndicator(installed: string, host: string, manifest: UpdateManifest | null): VersionIndicator {
  const neutral: VersionIndicator = { state: 'neutral', url: REPOSITORY_URL, title: 'Open GitHub' };
  if (!manifest || !versionParts(installed) || !versionParts(host) || compareVersions(installed, manifest.latest.version) >= 0) return neutral;
  if (compareVersions(host, manifest.latest.minimumPremiereVersion) < 0)
    return { ...neutral, title: `Version ${manifest.latest.version} requires Premiere ${manifest.latest.minimumPremiereVersion}. Open GitHub` };
  const critical = manifest.criticalBelow !== null && compareVersions(installed, manifest.criticalBelow) < 0;
  return {
    state: critical ? 'critical' : 'update',
    url: manifest.latest.releaseUrl,
    title: `${critical ? 'Critical update' : 'Update'} available: v${manifest.latest.version}. Open release on GitHub`,
  };
}

export class UpdateChecker {
  private cache: Cache = { checkedAt: 0, manifest: null };
  private active = false;
  private inFlight?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private cancelRequest?: () => void;
  private generation = 0;
  private lastResult = 'unchecked';
  private source: 'cache' | 'network' | null = null;
  private failureCode: string | null = null;
  private requestsStarted = 0;
  private readonly now: () => number;
  private readonly schedule: typeof setTimeout;
  private readonly unschedule: typeof clearTimeout;

  constructor(private readonly options: UpdateOptions) {
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? setTimeout;
    this.unschedule = options.unschedule ?? clearTimeout;
    try {
      const text = options.storage?.getItem(UPDATE_CACHE_KEY);
      if (!text || text.length > MAX_MANIFEST_LENGTH) return;
      const saved = JSON.parse(text);
      if (!record(saved) || saved.schemaVersion !== 1 || !Number.isSafeInteger(saved.checkedAt) || (saved.checkedAt as number) <= 0) return;
      // Clock rollback must not postpone checks indefinitely.
      this.cache.checkedAt = Math.min(saved.checkedAt as number, this.now());
      try { if (saved.manifest !== null) this.cache.manifest = parseUpdateManifest(saved.manifest); } catch { /* Keep attempt timestamp, discard invalid metadata. */ }
      this.lastResult = this.cache.manifest ? 'cached' : 'cached-failure';
      this.source = this.cache.manifest ? 'cache' : null;
      if (saved.checkedAt !== this.cache.checkedAt) this.save();
    } catch { /* Unavailable or corrupt local storage must never break the bridge. */ }
  }
  get indicator(): VersionIndicator {
    // Old/offline results are not evidence of a currently available release.
    const manifest = this.now() - this.cache.checkedAt < UPDATE_INTERVAL_MS ? this.cache.manifest : null;
    return versionIndicator(this.options.installedVersion, this.options.hostVersion, manifest);
  }
  // Snapshot only: diagnostics never fetch, clear cache, open a browser or alter UI.
  get diagnostics(): Record<string, unknown> {
    return {
      installedVersion: this.options.installedVersion,
      manifestUrl: UPDATES_URL,
      indicator: this.indicator,
      lastResult: this.lastResult,
      source: this.source,
      failureCode: this.failureCode,
      requestsStarted: this.requestsStarted,
      lastAttemptAtMs: this.cache.checkedAt || null,
      nextAttemptAtMs: this.cache.checkedAt ? this.cache.checkedAt + UPDATE_INTERVAL_MS : null,
      latestVersion: this.cache.manifest?.latest.version ?? null,
      minimumPremiereVersion: this.cache.manifest?.latest.minimumPremiereVersion ?? null,
      criticalBelow: this.cache.manifest?.criticalBelow ?? null,
      runtimeAvailable: !!this.options.fetcher && !!this.options.storage,
    };
  }
  start(): void {
    if (this.active || !this.options.fetcher || !this.options.storage) return;
    this.active = true;
    void this.refresh();
  }
  stop(): void {
    this.active = false;
    this.generation++;
    if (this.timer !== undefined) this.unschedule(this.timer);
    this.cancelRequest?.();
    this.cancelRequest = undefined;
    this.timer = undefined;
    this.inFlight = undefined;
  }
  refresh(): Promise<void> {
    if (!this.active) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const pending: Promise<void> = this.check().finally(() => { if (this.inFlight === pending) this.inFlight = undefined; });
    this.inFlight = pending;
    return pending;
  }
  private save(): boolean {
    try {
      this.options.storage!.setItem(UPDATE_CACHE_KEY, JSON.stringify({ schemaVersion: 1, ...this.cache }));
      return true;
    } catch { return false; }
  }
  private plan(): void {
    if (!this.active) return;
    if (this.timer !== undefined) this.unschedule(this.timer);
    this.timer = this.schedule(() => { this.timer = undefined; void this.refresh(); },
      Math.max(1, this.cache.checkedAt + UPDATE_INTERVAL_MS - this.now()));
  }
  private async check(): Promise<void> {
    const generation = this.generation;
    if (this.cache.checkedAt && this.now() - this.cache.checkedAt < UPDATE_INTERVAL_MS) { this.plan(); return; }
    // Persist the attempt BEFORE network access, so offline reloads cannot cause retries.
    this.cache = { checkedAt: this.now(), manifest: null };
    this.lastResult = 'checking';
    this.source = null;
    this.failureCode = null;
    this.options.onChange();
    if (!this.save()) { this.lastResult = 'cache-write-failed'; this.plan(); return; }
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelRequest: (() => void) | undefined;
    let failureCode = 'request-failed';
    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
      const request = async () => {
        this.requestsStarted++;
        const response = await this.options.fetcher!(UPDATES_URL, {
          method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
          ...(controller ? { signal: controller.signal } : {}),
        });
        failureCode = 'http-error';
        if (!response.ok) throw new Error('Update check unavailable.');
        failureCode = 'invalid-response';
        const length = response.headers.get('content-length');
        if (length && Number(length) > MAX_MANIFEST_LENGTH) throw new Error('Update manifest too large.');
        const text = await response.text();
        if (text.length > MAX_MANIFEST_LENGTH) throw new Error('Update manifest too large.');
        failureCode = 'invalid-manifest';
        return parseUpdateManifest(JSON.parse(text));
      };
      const timeout = new Promise<never>((_, reject) => {
        cancelRequest = () => {
          failureCode = 'timeout-or-cancelled';
          controller?.abort();
          reject(new Error('Update check timed out.'));
        };
        this.cancelRequest = cancelRequest;
        requestTimer = this.schedule(cancelRequest, UPDATE_TIMEOUT_MS);
      });
      const manifest = await Promise.race([request(), timeout]);
      if (this.active && generation === this.generation) {
        this.cache.manifest = manifest;
        this.lastResult = 'success';
        this.source = 'network';
        this.save();
      }
    } catch {
      if (this.active && generation === this.generation) { this.lastResult = 'failed'; this.failureCode = failureCode; }
    }
    finally {
      if (requestTimer !== undefined) this.unschedule(requestTimer);
      if (this.cancelRequest === cancelRequest) this.cancelRequest = undefined;
      if (this.active && generation === this.generation) { this.options.onChange(); this.plan(); }
    }
  }
}

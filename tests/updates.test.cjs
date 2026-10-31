const test = require('node:test');
const assert = require('node:assert/strict');
const { UpdateChecker, compareVersions, parseUpdateManifest, versionIndicator,
  REPOSITORY_URL, UPDATES_URL, UPDATE_CACHE_KEY, UPDATE_INTERVAL_MS, UPDATE_TIMEOUT_MS } = require('../build/lib/updates.cjs');

const manifest = (overrides = {}) => ({ schemaVersion: 1,
  latest: { version: '0.3.10', minimumPremiereVersion: '25.6.0', releaseUrl: REPOSITORY_URL + '/releases/tag/v0.3.10' },
  criticalBelow: null, ...overrides });
const response = (value) => ({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify(value) });
function fixture(t, options = {}) {
  let now = 1793420000000, calls = 0, changes = 0, serial = 0;
  const saved = options.saved ?? new Map(), timers = new Map();
  const storage = options.storage ?? { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const checker = new UpdateChecker({ installedVersion: '0.3.8', hostVersion: '26.5.0', storage,
    now: () => now, schedule: (fn, ms) => { const id = ++serial; timers.set(id, { fn, ms }); return id; },
    unschedule: id => timers.delete(id), onChange: () => changes++,
    fetcher: async (url, init) => { calls++; assert.equal(url, UPDATES_URL);
      assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error'); assert.equal('body' in init, false);
      return options.fetcher ? options.fetcher(url, init) : response(manifest()); },
  });
  t.after(() => checker.stop());
  return { checker, saved, timers, calls: () => calls, changes: () => changes,
    advance(ms) { now += ms; }, fire(ms) { const found = [...timers].find(([, timer]) => timer.ms === ms);
      assert.ok(found, `Expected timer ${ms}`); timers.delete(found[0]); found[1].fn(); } };
}

test('update versions are ordered numerically; critical status has an explicit threshold and host compatibility', () => {
  assert.equal(compareVersions('0.3.10', '0.3.9'), 1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareVersions('0.3.8', '0.3.8'), 0);
  assert.throws(() => compareVersions('0.03.8', '0.3.8'));
  const latest = parseUpdateManifest(manifest());
  assert.equal(versionIndicator('0.3.8', '26.5.0', latest).state, 'update');
  assert.equal(versionIndicator('0.3.10', '26.5.0', latest).state, 'neutral');
  assert.equal(versionIndicator('0.3.11', '26.5.0', latest).url, REPOSITORY_URL);
  const critical = parseUpdateManifest(manifest({ criticalBelow: '0.3.9' }));
  assert.equal(versionIndicator('0.3.8', '26.5.0', critical).state, 'critical');
  assert.equal(versionIndicator('0.3.9', '26.5.0', critical).state, 'update');
  assert.equal(versionIndicator('0.3.10', '26.5.0', critical).state, 'neutral');
  assert.match(versionIndicator('0.3.8', '26.5.0', critical).title, /Critical update/);
  const incompatible = parseUpdateManifest(manifest({ latest: { ...latest.latest, minimumPremiereVersion: '27.0.0' }, criticalBelow: '0.3.9' }));
  const indicator = versionIndicator('0.3.8', '26.5.0', incompatible);
  assert.equal(indicator.state, 'neutral'); assert.equal(indicator.url, REPOSITORY_URL);
  assert.match(indicator.title, /requires Premiere 27.0.0/);
});

test('remote and cached metadata cannot inject arbitrary URLs, versions or severity', () => {
  const latest = manifest().latest;
  const bad = [null, [], {}, { ...manifest(), schemaVersion: 2 }, { ...manifest(), critical: true },
    manifest({ criticalBelow: '0.3.11' }), manifest({ criticalBelow: '999999999999999999999.0.0' }),
    manifest({ latest: { ...latest, version: 'latest' } }),
    manifest({ latest: { ...latest, releaseUrl: 'https://example.com/' } }),
    manifest({ latest: { ...latest, releaseUrl: 'javascript:alert(1)' } }),
    manifest({ latest: { ...latest, releaseUrl: latest.releaseUrl + '?redirect=elsewhere' } }),
    manifest({ latest: { ...latest, releaseUrl: latest.releaseUrl.replace('v0.3.10', 'v0.3.9') } }),
    manifest({ latest: { ...latest, minimumPremiereVersion: '25.6' } })];
  for (const value of bad) assert.throws(() => parseUpdateManifest(value));
  assert.deepEqual(parseUpdateManifest(require('../updates.json')), require('../updates.json'));
});

test('one request per 24 hours survives reloads and upgrade while an open panel schedules the next check', async t => {
  const f = fixture(t);
  f.checker.start(); await f.checker.refresh();
  assert.equal(f.calls(), 1); assert.equal(f.checker.indicator.state, 'update');
  assert.equal(f.checker.indicator.url, manifest().latest.releaseUrl);
  f.checker.start(); await Promise.all([f.checker.refresh(), f.checker.refresh()]);
  assert.equal(f.calls(), 1);
  const reloaded = fixture(t, { saved: f.saved });
  assert.equal(reloaded.checker.indicator.state, 'update');
  reloaded.checker.start(); await reloaded.checker.refresh(); assert.equal(reloaded.calls(), 0);
  f.advance(UPDATE_INTERVAL_MS - 1); await f.checker.refresh(); assert.equal(f.calls(), 1);
  f.advance(1); assert.equal(f.checker.indicator.state, 'neutral');
  // refresh above rescheduled the timer to the one remaining millisecond.
  f.fire(1); await f.checker.refresh(); assert.equal(f.calls(), 2);
  const upgraded = new UpdateChecker({ installedVersion: '0.3.10', hostVersion: '26.5.0', storage: {
    getItem: key => f.saved.get(key), setItem() {} }, now: () => 1793420000000 + UPDATE_INTERVAL_MS, onChange() {} });
  assert.equal(upgraded.indicator.state, 'neutral');
});

test('offline, HTTP, oversized, malformed and foreign-release responses stay neutral and persist the failed attempt', async t => {
  const cases = [async () => { throw new Error('offline'); },
    async () => ({ ...response(manifest()), ok: false }),
    async () => ({ ...response(manifest()), text: async () => '{bad' }),
    async () => ({ ...response(manifest()), headers: { get: () => '99999' } }),
    async () => ({ ...response(manifest()), text: async () => ' '.repeat(8193) }),
    async () => response(manifest({ latest: { ...manifest().latest, releaseUrl: 'https://evil.test' } }))];
  for (const fetcher of cases) {
    const f = fixture(t, { fetcher }); f.checker.start(); await f.checker.refresh();
    assert.equal(f.calls(), 1); assert.equal(f.checker.indicator.state, 'neutral');
    assert.equal(f.checker.indicator.url, REPOSITORY_URL);
    assert.equal(JSON.parse(f.saved.get(UPDATE_CACHE_KEY)).manifest, null);
    const again = fixture(t, { saved: f.saved }); again.checker.start(); await again.checker.refresh();
    assert.equal(again.calls(), 0);
    f.advance(UPDATE_INTERVAL_MS); await f.checker.refresh(); assert.equal(f.calls(), 2);
  }
});

test('a failed attempt is persisted before awaiting a request and concurrent calls share that request', async t => {
  let complete;
  const f = fixture(t, { fetcher: () => new Promise(resolve => { complete = resolve; }) });
  f.checker.start(); const pending = f.checker.refresh();
  assert.equal(f.calls(), 1); assert.equal(JSON.parse(f.saved.get(UPDATE_CACHE_KEY)).manifest, null);
  const afterReload = fixture(t, { saved: f.saved }); afterReload.checker.start(); await afterReload.checker.refresh();
  assert.equal(afterReload.calls(), 0);
  complete(response(manifest())); await pending; assert.equal(f.checker.indicator.state, 'update');
});

test('timeout and disposal cannot apply a late update or restart polling', async t => {
  let complete, signal;
  const f = fixture(t, { fetcher: (_, init) => { signal = init.signal; return new Promise(resolve => { complete = resolve; }); } });
  f.checker.start(); const pending = f.checker.refresh(); f.fire(UPDATE_TIMEOUT_MS); await pending;
  assert.equal(signal.aborted, true); assert.equal(f.checker.indicator.state, 'neutral');
  complete(response(manifest())); await Promise.resolve(); assert.equal(f.checker.indicator.state, 'neutral');
  let finish;
  const disposed = fixture(t, { fetcher: () => new Promise(resolve => { finish = resolve; }) });
  disposed.checker.start(); const stopped = disposed.checker.refresh(); const changes = disposed.changes();
  disposed.checker.stop(); finish(response(manifest())); await stopped;
  assert.equal(disposed.changes(), changes); assert.equal(disposed.checker.indicator.state, 'neutral');
  assert.equal(disposed.timers.size, 0);
});

test('unavailable persistence cannot cause a network request on every plugin reload', async t => {
  const f = fixture(t, { storage: { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } } });
  f.checker.start(); await f.checker.refresh(); assert.equal(f.calls(), 0); assert.equal(f.checker.indicator.state, 'neutral');
});

test('corrupt cached metadata is neutral, and future timestamps are repaired durably after clock rollback', async t => {
  const saved = new Map([[UPDATE_CACHE_KEY, JSON.stringify({ schemaVersion: 1, checkedAt: 1793420000000,
    manifest: manifest({ latest: { ...manifest().latest, releaseUrl: 'https://evil.test' } }) })]]);
  const corrupted = fixture(t, { saved }); corrupted.checker.start(); await corrupted.checker.refresh();
  assert.equal(corrupted.checker.indicator.state, 'neutral'); assert.equal(corrupted.calls(), 0);
  const future = new Map([[UPDATE_CACHE_KEY, JSON.stringify({ schemaVersion: 1, checkedAt: 1793420000000 + UPDATE_INTERVAL_MS * 30, manifest: manifest() })]]);
  const rollback = fixture(t, { saved: future });
  assert.equal(JSON.parse(future.get(UPDATE_CACHE_KEY)).checkedAt, 1793420000000);
  rollback.checker.start(); await rollback.checker.refresh(); assert.equal(rollback.calls(), 0);
  rollback.advance(UPDATE_INTERVAL_MS); await rollback.checker.refresh(); assert.equal(rollback.calls(), 1);
});

test('stop cancels a hanging request and restart keeps the daily attempt without stale timers', async t => {
  const f = fixture(t, { fetcher: () => new Promise(() => {}) });
  f.checker.start(); const pending = f.checker.refresh();
  f.checker.stop(); f.checker.start(); await Promise.all([pending, f.checker.refresh()]);
  assert.equal(f.calls(), 1); assert.equal(f.checker.indicator.state, 'neutral');
  assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].ms, UPDATE_INTERVAL_MS);
});

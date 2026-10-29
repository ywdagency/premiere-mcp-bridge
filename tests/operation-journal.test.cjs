const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { UxpBridge } = require('../build/lib/runtime.cjs');
const { PremiereControl } = require('../build/lib/runtime.cjs');
const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
const { controlFixture } = require('./helpers/control-fixture.cjs');
async function setup(t, timeoutMs = 1500) {
  const { FileBridge, prepareBridge } = await import('../mcp/file-bridge.mjs');
  const directory = await fs.mkdtemp(join(tmpdir(), 'premiere-journal-'));
  const { marker } = await prepareBridge(directory);
  const f = controlFixture();
  const uxp = new UxpBridge(f.inspectHost, () => {}, new PremiereControl(f.host));
  await uxp.start(folderAdapter(directory));
  t.after(async () => { uxp.stop(); await fs.rm(directory, { recursive: true, force: true }); });
  return { f, uxp, marker, directory, bridge: new FileBridge(directory, { timeoutMs, pollMs: 5 }),
    args: { projectId: f.project.guid, operationId: randomUUID(), name: 'Working' } };
}

test('same operationId replays a durable result without duplicating the host mutation; conflicts reject', async (t) => {
  const { f, bridge, directory, args } = await setup(t);
  const first = await bridge.call('create_sequence', args);
  const replay = await bridge.call('create_sequence', { name: args.name, operationId: args.operationId, projectId: args.projectId });
  assert.equal(replay.sequence.id, first.sequence.id);
  assert.equal(f.sequences.length, 2);
  assert.equal(JSON.parse(await fs.readFile(join(directory, `operation-${args.operationId}.json`), 'utf8')).state, 'completed');
  await assert.rejects(bridge.call('create_sequence', { ...args, name: 'Changed' }), { code: 'OPERATION_ID_CONFLICT' });
  assert.equal(f.sequences.length, 2);
});

test('incomplete write receipt prevents all automatic retries, including after plugin restart', async (t) => {
  const { f, bridge, marker, directory, args, uxp } = await setup(t);
  uxp.stop();
  const restarted = new UxpBridge(f.inspectHost, () => {}, new PremiereControl(f.host));
  await restarted.start(folderAdapter(directory));
  t.after(() => restarted.stop());
  const canonical = Object.fromEntries(Object.keys(args).sort().map((key) => [key, args[key]]));
  await fs.writeFile(join(directory, `operation-${args.operationId}.json`), JSON.stringify({ version: 1,
    bridgeId: marker.bridgeId, operationId: args.operationId, payload: JSON.stringify({ command: 'create_sequence', args: canonical }), state: 'started' }));
  await assert.rejects(bridge.call('create_sequence', args), { code: 'OPERATION_OUTCOME_UNKNOWN' });
  assert.equal(f.sequences.length, 1);
});

test('caller timeout remains uncertain; same-ID recovery returns a late host result', { timeout: 8000 }, async (t) => {
  const { f, bridge, args, uxp, directory } = await setup(t, 2000);
  let entered, release;
  const started = new Promise((resolve) => { entered = resolve; });
  t.after(() => release?.());
  const original = f.project.createSequence;
  f.project.createSequence = async (name) => { entered(); await new Promise((resolve) => { release = resolve; }); return original(name); };
  const running = bridge.call('create_sequence', args);
  const rejection = assert.rejects(running, { code: 'OPERATION_OUTCOME_UNKNOWN' });
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await fs.readdir(directory)).some((name) => name.startsWith('request-'))) break;
    await delay(10);
  }
  const pump = uxp.pollOnce();
  await started;
  await rejection;
  release();
  await pump;
  bridge.timeoutMs = 1500;
  const result = await bridge.call('create_sequence', args);
  assert.equal(result.sequence.name, 'Working');
  assert.equal(f.sequences.length, 2);
});

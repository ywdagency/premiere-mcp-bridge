const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { apiFixture } = require('./helpers/api-fixture.cjs');
const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
const { PremiereApi, validateArgs, createDispatcher, UxpBridge } = require('../build/lib/runtime.cjs');
const deadline = () => Date.now() + 30000;

async function setup(t, count = 1) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'premiere-render-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const f = apiFixture(), callbacks = new Set(), calls = [], checked = [], pending = [];
  const manager = { isAMEInstalled: true, encodeProjectItem(...args) {
    calls.push(args);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  }, startBatchEncode() { assert.fail('Owner queue must not be started'); } };
  f.module.EncoderManager = { getManager: () => manager, EVENT_RENDER_COMPLETE: 'render-complete' };
  f.module.EventManager.addEventListener = (target, name, callback) => {
    assert.equal(target, manager); assert.equal(name, 'render-complete'); callbacks.add(callback);
  };
  f.module.EventManager.removeEventListener = (target, name, callback) => callbacks.delete(callback);
  f.apiHost.path = async (path, mode) => { checked.push({ path, mode }); return '/private/granted/' + path; };
  const folder = folderAdapter(directory);
  f.api.setRenderStorage(folder);
  const operationId = randomUUID(), items = [];
  for (let i = 0; i < count; i++) {
    const media = { ...f.media, getId: () => 'media-' + i };
    f.root.items.push(media);
    // Use the public context/bin/cast route rather than manufacturing handles.
    const c = await f.context(), root = await f.read('Project#getRootItem', c.project);
    const children = await f.read('FolderItem#getItems', root);
    const child = children.items.at(-1);
    const clip = await f.read('ClipProjectItem.cast', null, { projectItem: { $ref: child.$ref } });
    items.push({ item: clip.$ref, outputPath: `renders/${operationId}-${i}.mov` });
  }
  const args = { projectId: f.project.guid, operationId, presetPath: 'presets/alpha.epr', items };
  const get = () => f.api.getRenderBatch({ projectId: f.project.guid, batchId: operationId });
  const complete = (outputFiles, jobID = 'ame-1') => { for (const cb of callbacks) cb({ outputFiles, jobID }); };
  return { ...f, args, directory, folder, calls, checked, pending, callbacks, get, complete };
}

test('batch validates all files, journals each invocation and never starts queue or changes timeline', async t => {
  const f = await setup(t, 2), source = JSON.stringify(f.source.items.map(c => c.state));
  const original = f.module.EncoderManager.getManager().encodeProjectItem;
  f.module.EncoderManager.getManager().encodeProjectItem = function(...args) {
    assert.equal(f.checked.length, 4); // All outputs and presets checked before any submission.
    const record = JSON.parse(readFileSync(join(f.directory, `render-batch-${f.args.operationId}.json`)));
    assert.equal(record.entries[f.calls.length].submission, 'submission_unknown');
    return original.apply(this, args);
  };
  const result = await f.api.renderBatch(f.args, deadline());
  assert.equal(f.calls.length, 2);
  for (const call of f.calls) assert.deepEqual(call.slice(3), [0, false, false]);
  assert.equal(result.queueStartRequested, false);
  assert.equal(result.timelineChanged, false);
  assert.equal(result.replacementAllowed, false);
  assert.equal(result.outputSuitability, 'unverified');
  const disk = JSON.parse(await fs.readFile(join(f.directory, `render-batch-${f.args.operationId}.json`)));
  assert.ok(disk.entries.every(e => e.submission === 'submission_unknown'));
  f.pending[0].resolve(true); f.pending[1].resolve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok((await f.get()).entries.every(e => e.submission === 'native_accepted' && e.completion === 'unconfirmed'));
  assert.equal(JSON.stringify(f.source.items.map(c => c.state)), source);
  await assert.rejects(f.api.renderBatch(f.args, deadline()), { code: 'RENDER_BATCH_EXISTS' });
  assert.equal(f.calls.length, 2);
});

test('completion matches exact private output, handles event-before-Promise and omits output paths', async t => {
  const f = await setup(t, 2);
  await f.api.renderBatch(f.args, deadline());
  f.complete(['/private/granted/unrelated.mov']);
  assert.ok((await f.get()).entries.every(e => e.completion === 'unconfirmed'));
  f.complete(['/private/granted/' + f.args.items[1].outputPath]);
  f.pending[1].resolve(true);
  const result = await f.get();
  assert.equal(result.entries[0].completion, 'unconfirmed');
  assert.equal(result.entries[1].completion, 'render_event_observed');
  assert.equal(result.entries[1].nativeJobId, 'ame-1');
  assert.equal(JSON.stringify(result).includes('/private/'), false);
  assert.equal(result.replacementAllowed, false);
  assert.equal(result.outputSuitability, 'unverified');
  f.api.dispose(); assert.equal(f.callbacks.size, 0);
});

test('native false, rejected Promise and synchronous failure remain distinct with no blind retries', async t => {
  for (const kind of ['false', 'reject', 'throw', 'invalid-result']) {
    const f = await setup(t, 3);
    let invoked = 0;
    f.module.EncoderManager.getManager().encodeProjectItem = () => {
      invoked++;
      if (kind === 'throw') throw new Error('unknown native result');
      if (kind === 'reject') return Promise.reject(new Error('native may have partially queued'));
      if (kind === 'invalid-result') return Promise.resolve('not-a-boolean');
      return Promise.resolve(false);
    };
    await f.api.renderBatch(f.args, deadline());
    const result = await f.get();
    assert.equal(invoked, 1);
    assert.equal(result.stopped, true);
    assert.equal(result.entries[0].submission, kind === 'false' ? 'native_rejected' : 'submission_unknown');
    assert.ok(result.entries.slice(1).every(e => e.submission === 'not_submitted'));
    assert.equal(result.replacementAllowed, false);
  }
});

test('plugin restart recovers evidence without handles/requeue and does not infer completion from acceptance', async t => {
  const f = await setup(t, 2);
  await f.api.renderBatch(f.args, deadline());
  f.complete(['/private/granted/' + f.args.items[1].outputPath]);
  await f.get();
  f.api.dispose();
  const restarted = new PremiereApi(f.apiHost, f.control);
  restarted.setRenderStorage(f.folder);
  const result = await restarted.getRenderBatch({ projectId: f.project.guid, batchId: f.args.operationId });
  assert.equal(result.previousSession, true);
  assert.equal(result.entries[0].completion, 'unknown_after_restart');
  assert.equal(result.entries[1].completion, 'render_event_observed');
  await assert.rejects(restarted.renderBatch(f.args, deadline()), { code: 'HANDLE_EXPIRED' });
  assert.equal(f.calls.length, 2);
});

test('unconfirmed renders protect project close and working deletion, including after actual API restart', async t => {
  const f = await setup(t), seq = await f.working();
  await f.api.renderBatch(f.args, deadline());
  f.pending[0].resolve(true); await f.get();
  for (const api of [f.api, new PremiereApi(f.apiHost, f.control)]) {
    api.setRenderStorage(f.folder);
    await assert.rejects(api.closeProject({ projectId: f.project.guid, confirm: true }, deadline()), { code: 'RENDER_BATCH_IN_PROGRESS' });
    await assert.rejects(api.deleteWorking({ projectId: f.project.guid, sequenceId: seq.guid }, deadline()), { code: 'RENDER_BATCH_IN_PROGRESS' });
  }
  f.complete(['/private/granted/' + f.args.items[0].outputPath]); await f.get();
  await f.api.deleteWorking({ projectId: f.project.guid, sequenceId: seq.guid }, deadline());
  assert.equal(f.sequences.includes(seq), false);
});

test('file denial, invalid preset, duplicate sources, unavailable encoder and expired context submit nothing', async t => {
  for (const kind of ['file', 'preset', 'source', 'encoder', 'project', 'expired', 'disabled']) {
    const f = await setup(t, 2), args = structuredClone(f.args);
    if (kind === 'file') f.apiHost.path = async () => { throw Object.assign(new Error(), { code: 'LINK_NOT_ALLOWED' }); };
    if (kind === 'preset') args.presetPath = '../alpha.epr';
    if (kind === 'source') args.items[1].item = args.items[0].item;
    if (kind === 'encoder') f.module.EncoderManager.getManager().isAMEInstalled = false;
    if (kind === 'project') args.projectId = 'other-project';
    if (kind === 'disabled') f.setEnabled(false);
    await assert.rejects(f.api.renderBatch(args, kind === 'expired' ? Date.now() - 1 : deadline()));
    assert.equal(f.calls.length, 0, kind);
  }
});

test('journal failure prevents native submission; corruption and wrong project fail closed', async t => {
  const f = await setup(t);
  f.api.setRenderStorage({ ...f.folder, createFile: async () => { throw new Error('disk full'); } });
  await assert.rejects(f.api.renderBatch(f.args, deadline()), { code: 'RENDER_STORAGE_FAILED' });
  assert.equal(f.calls.length, 0);
  const other = new PremiereApi(f.apiHost, f.control); other.setRenderStorage(f.folder);
  await fs.writeFile(join(f.directory, `render-batch-${f.args.operationId}.json`), '{invalid');
  await assert.rejects(other.getRenderBatch({ projectId: f.project.guid, batchId: f.args.operationId }), { code: 'RENDER_EVIDENCE_INVALID' });
});

test('context change between per-item writes stops subsequent native calls and preserves unknown work', async t => {
  const f = await setup(t, 2);
  const original = f.module.EncoderManager.getManager().encodeProjectItem;
  f.module.EncoderManager.getManager().encodeProjectItem = function(...args) {
    const value = original.apply(this, args);
    f.apiHost.getActiveProject = async () => ({ guid: 'different-project' });
    return value;
  };
  const result = await f.api.renderBatch(f.args, deadline());
  assert.equal(f.calls.length, 1);
  assert.equal(result.stopped, true);
  assert.equal(result.entries[0].submission, 'submission_unknown');
  assert.equal(result.entries[1].submission, 'not_submitted');
});

test('both public contract and UXP reject malformed batch plans before any native calls', async t => {
  const f = await setup(t);
  const bad = { ...f.args, items: [{ ...f.args.items[0], script: 'arbitrary' }] };
  assert.throws(() => validateArgs('render_batch', bad));
  await assert.rejects(createDispatcher(f.host, f.control, f.api)({ command: 'render_batch', args: bad, expiresAt: deadline() }));
  assert.equal(f.calls.length, 0);
});

test('transport stop/start preserves batch evidence and receipt replay submits exactly once', async t => {
  const f = await setup(t);
  const { FileBridge, prepareBridge } = await import('../mcp/file-bridge.mjs');
  await prepareBridge(f.directory);
  const uxp = new UxpBridge({ ...f.host, version: '26.5.0' }, () => {}, f.control, f.api);
  await uxp.start(f.folder); t.after(() => uxp.stop());
  const bridge = new FileBridge(f.directory, { timeoutMs: 10000, pollMs: 5 });
  const first = await bridge.call('render_batch', f.args);
  uxp.stop(); await uxp.start(f.folder);
  assert.deepEqual(await bridge.call('render_batch', f.args), { ...first, operationReplayed: true });
  assert.equal(f.calls.length, 1);
  f.complete(['/private/granted/' + f.args.items[0].outputPath]);
  const status = await bridge.call('get_render_batch', { projectId: f.project.guid, batchId: f.args.operationId });
  assert.equal(status.entries[0].completion, 'render_event_observed');
});

test('class event subscription forwards official scalar payload names without private files', async t => {
  const f = await setup(t), manager = await f.read('EncoderManager.getManager');
  assert.throws(() => f.api.subscribe({ eventId: 'EncoderManager!EVENT_RENDER_COMPLETE' }), { code: 'INVALID_API_ARGUMENT' });
  const sub = f.api.subscribe({ eventId: 'EncoderManager!EVENT_RENDER_COMPLETE', target: manager.$ref });
  f.complete(['/private/owner-project.mov']);
  const event = f.api.pollEvents({}).events[0];
  assert.equal(event.jobID, 'ame-1'); assert.equal(event.outputFileCount, 1);
  assert.equal(JSON.stringify(event).includes('/private/'), false);
  assert.equal(f.api.unsubscribe({ subscriptionId: sub.subscriptionId }).removed, true);
});

test('MCP discovers typed batch/status contracts, blocks extra fields and omits batch writes in read-only mode', async t => {
  const { Client, InMemoryTransport } = await import('@modelcontextprotocol/client');
  const { createAdapter } = await import('../mcp/adapter.mjs');
  for (const readOnly of [false, true]) {
    let calls = 0;
    const server = createAdapter({ readOnly, bridge: { async call() { calls++; return {}; } } }).createServer();
    const client = new Client({ name: 'render-contract-test', version: '1' });
    t.after(async () => { await client.close(); await server.close(); });
    const [a,b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
    const tools = (await client.listTools()).tools;
    assert.ok(tools.some(x => x.name === 'premiere_get_render_batch'));
    assert.equal(tools.some(x => x.name === 'premiere_render_batch'), !readOnly);
    if (readOnly) continue;
    const spec = tools.find(x => x.name === 'premiere_render_batch');
    assert.equal(spec.inputSchema.properties.items.maxItems, 10);
    assert.equal(spec.inputSchema.properties.items.items.additionalProperties, false);
    const id = randomUUID();
    const args = { projectId: 'p', operationId: id, presetPath: 'alpha.epr', items: [{ item: 'h', outputPath: `${id}-clip.mov` }] };
    for (const bad of [
      { ...args, items: [{ ...args.items[0], execute: 'arbitrary' }] },
      { ...args, items: [{ item: 'h', outputPath: '../outside.mov' }] },
      { ...args, items: [args.items[0], args.items[0]] },
      { ...args, startQueueImmediately: true },
      { ...args, presetPath: '/outside.epr' },
    ]) assert.equal((await client.callTool({ name: 'premiere_render_batch', arguments: bad })).isError, true);
    assert.equal(calls, 0);
    assert.equal((await client.callTool({ name: 'premiere_render_batch', arguments: args })).isError, undefined);
    assert.equal(calls, 1);
  }
});

test('all 27 documented class events resolve exact static IDs with explicit instance/global scopes', async () => {
  const f = apiFixture();
  const { API_CONTRACTS } = require('../build/lib/runtime.cjs');
  const members = API_CONTRACTS.classes.flatMap(c => c.members).filter(m => m.kind === 'event');
  assert.equal(members.length, 27);
  const targets = {};
  const context = await f.context();
  targets.VideoTrack = (await f.read('Sequence#getVideoTrack', context.sequence, { trackIndex: 0 })).$ref;
  f.source.getAudioTrack = async () => ({});
  targets.AudioTrack = (await f.read('Sequence#getAudioTrack', context.sequence, { trackIndex: 0 })).$ref;
  f.module.EncoderManager = { getManager: () => ({}) };
  targets.EncoderManager = (await f.read('EncoderManager.getManager')).$ref;
  const observed = [];
  f.module.EventManager.addEventListener = (target, name) => observed.push({ target, name });
  f.module.EventManager.addGlobalEventListener = name => observed.push({ name });
  for (const member of members) {
    f.module[member.className] ??= {};
    f.module[member.className][member.name] = member.id;
    const target = targets[member.className];
    f.api.subscribe({ eventId: member.id, ...(target ? { target } : {}) });
    assert.equal(observed.at(-1).name, member.id);
    assert.equal(!!observed.at(-1).target, !!target);
    assert.throws(() => f.api.subscribe({ eventId: member.id, ...(target ? {} : { target: context.project.$ref }) }), { code: 'INVALID_API_ARGUMENT' });
  }
  assert.equal(observed.length, 27);
});

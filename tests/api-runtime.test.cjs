const test = require('node:test'),
  assert = require('node:assert/strict');
const { apiFixture } = require('./helpers/api-fixture.cjs');
const { validateArgs, resolveValue, API_CONTRACTS } = require('../build/lib/runtime.cjs');
const deadline = () => Date.now() + 5000;
const edit = (f, memberId, target, parameters) => ({
  projectId: f.project.guid,
  memberId,
  target: target.$ref,
  parameters,
});
test('native handles preserve source scope, paging, type validation and opaque-value constructors', async () => {
  const f = apiFixture(),
    { c, clip } = await f.clipRef();
  assert.equal(clip.scope.editable, false);
  assert.equal((await f.read('VideoClipTrackItem#getStartTime', clip)).types[0], 'TickTime');
  await assert.rejects(
    f.api.actions(
      {
        projectId: f.project.guid,
        actions: [
          {
            memberId: 'VideoClipTrackItem#createSetDisabledAction',
            target: clip.$ref,
            parameters: { disabled: true },
          },
        ],
      },
      deadline(),
    ),
    { code: 'SOURCE_SEQUENCE_PROTECTED' },
  );
  await assert.rejects(f.read('VideoClipTrackItem#evilMethod', clip), {
    code: 'API_MEMBER_NOT_DOCUMENTED',
  });
  await assert.rejects(f.read('Sequence#getVideoTrack', clip, { trackIndex: 0 }), {
    code: 'INVALID_API_ARGUMENT',
  });
  await assert.rejects(f.read('VideoTrack#getTrackItems', c.sequence), {
    code: 'INVALID_API_ARGUMENT',
  });
  const color = await f.api.construct({
    memberId: 'new Color',
    parameters: { red: 1, green: 0, blue: 0, alpha: 1 },
  });
  await f.api.mutate(edit(f, 'Color@red', color.value, { value: 0.5 }), deadline());
  assert.equal(await f.read('Color@red', color.value), 0.5);
});
test('actions are constructed only inside the lock, invalidate affected handles and leave source untouched', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    { clip } = await f.clipRef(seq);
  const result = await f.api.actions(
    {
      projectId: f.project.guid,
      actions: [
        {
          memberId: 'VideoClipTrackItem#createSetDisabledAction',
          target: clip.$ref,
          parameters: { disabled: true },
        },
      ],
    },
    deadline(),
  );
  assert.equal(result.appliedActions.length, 1);
  assert.equal(seq.items[0].state.disabled, true);
  assert.equal(f.source.items[0].state.disabled, undefined);
  await assert.rejects(f.read('VideoClipTrackItem#isDisabled', clip), { code: 'HANDLE_EXPIRED' });
});
test('a media item reached through a working clip never inherits timeline edit permission', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    { clip } = await f.clipRef(seq);
  const item = await f.read('VideoClipTrackItem#getProjectItem', clip);
  assert.equal(item.scope.sequenceId, undefined);
  assert.equal(item.scope.editable, false);
  await assert.rejects(
    f.api.actions(
      {
        projectId: f.project.guid,
        actions: [
          {
            memberId: 'ProjectItem#createSetNameAction',
            target: item.$ref,
            parameters: { inName: 'Bad' },
          },
        ],
      },
      deadline(),
    ),
    { code: 'SOURCE_SEQUENCE_PROTECTED' },
  );
  assert.equal(f.media.name, 'Source media');
});
test('clip casts use ProjectItem identity while preserving the native transcript receiver and source protection', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    { clip } = await f.clipRef(seq),
    item = await f.read('VideoClipTrackItem#getProjectItem', clip);
  // Native ClipProjectItem exposes clip APIs, not ProjectItem#getId.
  const nativeClip = {
    name: f.media.name,
    createSetNameAction: f.media.createSetNameAction,
  };
  f.module.ClipProjectItem.cast = (native) => {
    assert.equal(native, f.media);
    return nativeClip;
  };
  f.module.ProjectItem.cast = (native) => {
    assert.equal(native, nativeClip);
    return f.media;
  };
  f.module.Transcript.hasTranscript = (native) => {
    assert.equal(native, nativeClip);
    return true;
  };
  f.module.Transcript.exportToJSON = async (native) => {
    assert.equal(native, nativeClip);
    return JSON.stringify({ segments: [{ text: 'Fixture speech', start: 1, duration: 2 }] });
  };
  const cast = await f.read('ClipProjectItem.cast', null, { projectItem: { $ref: item.$ref } });
  assert.deepEqual(cast.types, ['ClipProjectItem']);
  assert.equal(cast.scope.assetId, item.scope.assetId);
  assert.equal(cast.scope.sequenceId, undefined);
  assert.equal(cast.scope.editable, false);
  assert.equal(await f.read('Transcript.hasTranscript', null, { clipProjectItem: { $ref: cast.$ref } }), true);
  const transcript = await f.read('Transcript.exportToJSON', null, { clipProjectItem: { $ref: cast.$ref } });
  assert.equal(JSON.parse(transcript).segments[0].text, 'Fixture speech');
  await assert.rejects(
    f.api.actions({
      projectId: f.project.guid,
      actions: [{ memberId: 'ClipProjectItem#createSetNameAction', target: cast.$ref,
        parameters: { inName: 'Must stay protected' } }],
    }, deadline()),
    { code: 'SOURCE_SEQUENCE_PROTECTED' },
  );
  assert.equal(f.media.name, 'Source media');
});
test('source clip timing changes, cross-sequence refs, disabled editing and version mismatch reject', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    { clip } = await f.clipRef(seq);
  seq.items[0].state.start = f.tick('1');
  await assert.rejects(
    f.api.actions(
      {
        projectId: f.project.guid,
        actions: [
          {
            memberId: 'VideoClipTrackItem#createSetDisabledAction',
            target: clip.$ref,
            parameters: { disabled: true },
          },
        ],
      },
      deadline(),
    ),
    { code: 'CLIP_CHANGED' },
  );
  f.setEnabled(false);
  await assert.rejects(
    f.api.mutate(
      edit(f, 'VideoClipTrackItem#createSetDisabledAction', clip, { disabled: true }),
      deadline(),
    ),
    { code: 'WRITES_DISABLED' },
  );
  await assert.rejects(f.api.probe({ memberId: 'FolderItem@type' }), { code: 'UNSUPPORTED_HOST' });
  await assert.rejects(f.api.actions({ projectId: f.project.guid, actions: [] }, Date.now() - 1), {
    code: 'WRITES_DISABLED',
  });
});
test('temporary selections live through native transaction callbacks and cannot select source clips for a working action', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    { c, clip } = await f.clipRef(seq),
    editor = await f.read('SequenceEditor.getEditor', null, {
      sequenceObject: { $ref: c.sequence.$ref },
    });
  const source = await f.clipRef(f.source);
  const args = (handle) => ({
    projectId: f.project.guid,
    actions: [
      {
        memberId: 'SequenceEditor#createRemoveItemsAction',
        target: editor.$ref,
        parameters: {
          trackItemSelection: { $selection: [handle] },
          ripple: false,
          mediaType: { $enum: 'Constants.MediaType.ANY' },
        },
      },
    ],
  });
  await assert.rejects(f.api.actions(args(source.clip.$ref), deadline()), {
    code: 'SOURCE_SEQUENCE_PROTECTED',
  });
  await f.api.actions(args(clip.$ref), deadline());
  assert.equal(seq.items.length, 0);
  assert.equal(f.source.items.length, 1);
});
test('jobs return immediately, retain outcomes, refuse deleting a running target and survive handle expiry', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    c = await f.context(seq);
  const time = await f.read('TickTime.createWithTicks', null, { ticks: '0' });
  const job = await f.api.startJob(
    {
      projectId: f.project.guid,
      memberId: 'Exporter.exportSequenceFrame',
      parameters: {
        sequence: { $ref: c.sequence.$ref },
        time: { $ref: time.$ref },
        filename: 'exports/out.png',
        filepath: 'exports',
        width: 1920,
        height: 1080,
      },
    },
    deadline(),
  );
  assert.equal(job.state, 'running');
  await assert.rejects(
    f.api.deleteWorking({ projectId: f.project.guid, sequenceId: seq.guid }, deadline()),
    { code: 'JOB_IN_PROGRESS' },
  );
  f.finishJob();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.api.job({ jobId: job.jobId }).state, 'native_succeeded');
  await f.api.deleteWorking({ projectId: f.project.guid, sequenceId: seq.guid }, deadline());
  assert.equal(f.sequences.includes(seq), false);
  await assert.rejects(
    f.api.deleteWorking({ projectId: f.project.guid, sequenceId: f.source.guid }, deadline()),
    { code: 'SOURCE_SEQUENCE_PROTECTED' },
  );
});
test('event ring is bounded, counts drops, omits native objects/paths and removes exact callback identity', () => {
  const f = apiFixture(),
    s = f.api.subscribe({ eventId: 'Constants.ProjectEvent.DIRTY' });
  const callback = [...f.callbacks][0];
  for (let i = 0; i < 105; i++)
    callback({
      id: String(i),
      progress: 0.2,
      path: '/secret',
      result: '/private/media.mov',
      project: {
        getSecret() {
          throw new Error();
        },
      },
    });
  const page = f.api.pollEvents({ limit: 50 });
  assert.equal(page.events.length, 50);
  assert.equal(page.droppedEvents, 5);
  assert.equal(page.events[0].id, '5');
  assert.equal('path' in page.events[0], false);
  assert.equal('result' in page.events[0], false);
  f.api.unsubscribe({ subscriptionId: s.subscriptionId });
  assert.equal(f.callbacks.size, 0);
  assert.deepEqual(f.emitted, ['add', 'remove']);
});
test('native pointer forgery, executable/prototype payloads, bad enum, callback, malformed ticks and arbitrary members reject', async () => {
  const f = apiFixture();
  for (const value of [
    JSON.parse('{"constructor":{}}'),
    { script: () => true },
    new Array(129).fill(0),
  ])
    assert.throws(() =>
      validateArgs('api_mutate', {
        projectId: 'p',
        operationId: '12345678-1234-4234-8234-123456789abc',
        memberId: 'Color@red',
        parameters: value,
      }),
    );
  assert.throws(() => resolveValue({ $ref: 'forged' }, { kind: 'ref', name: 'Color' }, f.api), {
    code: 'HANDLE_EXPIRED',
  });
  await assert.rejects(f.read('TickTime.createWithTicks', null, { ticks: '1e2' }), {
    code: 'INVALID_API_ARGUMENT',
  });
  await assert.rejects(f.read('TickTime.createWithTicks', null, { ticks: '9999999999999999999' }), {
    code: 'INVALID_API_ARGUMENT',
  });
  await assert.rejects(f.read('FrameRate.createWithValue', null, { value: 0 }), {
    code: 'INVALID_API_ARGUMENT',
  });
  await assert.rejects(
    f.read('EventManager.addGlobalEventListener', null, { eventHandler: 'evil()' }),
    { code: 'API_POLICY_BLOCKED' },
  );
});
test('large text files become typed string handles; source imports/paths require explicit grants', async () => {
  const f = apiFixture();
  const text = await f.api.loadText({ path: 'transcript.json' });
  assert.equal(text.characters, 20000);
  assert.equal(resolveValue({ $ref: text.value.$ref }, { kind: 'string' }, f.api).length, 20000);
  const root = await f.read('Project#getRootItem', (await f.context()).project);
  await f.api.actions(
    {
      projectId: f.project.guid,
      actions: [
        {
          memberId: 'FolderItem#createBinAction',
          target: root.$ref,
          parameters: { name: 'New', makeUnique: true },
        },
      ],
    },
    deadline(),
  );
  assert.equal(f.root.items.length, 2);
});
test('actual IPC journals nested native action plans canonically and replays before resolving expired handles', async (t) => {
  const fs = require('node:fs/promises'),
    { join } = require('node:path'),
    { tmpdir } = require('node:os'),
    { randomUUID } = require('node:crypto');
  const { prepareBridge, FileBridge } = await import('../mcp/file-bridge.mjs');
  const { UxpBridge } = require('../build/lib/runtime.cjs');
  const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
  const f = apiFixture(),
    seq = await f.working(),
    directory = await fs.mkdtemp(join(tmpdir(), 'premiere-native-test-'));
  await prepareBridge(directory);
  const uxp = new UxpBridge(f.inspectHost, () => {}, f.control, f.api);
  await uxp.start(folderAdapter(directory));
  t.after(async () => {
    uxp.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const bridge = new FileBridge(directory, { timeoutMs: 2000, pollMs: 5 });
  const { clip } = await f.clipRef(seq),
    operationId = randomUUID();
  const args = {
    projectId: f.project.guid,
    operationId,
    actions: [
      {
        memberId: 'VideoClipTrackItem#createSetDisabledAction',
        target: clip.$ref,
        parameters: { disabled: true },
      },
    ],
  };
  const first = await bridge.call('api_apply_actions', args);
  assert.equal(first.appliedActions.length, 1);
  const replay = await bridge.call('api_apply_actions', {
    actions: [
      {
        parameters: { disabled: true },
        target: clip.$ref,
        memberId: 'VideoClipTrackItem#createSetDisabledAction',
      },
    ],
    operationId,
    projectId: f.project.guid,
  });
  assert.equal(replay.operationReplayed, true);
  assert.equal(f.transactions.length, 1);
});
test('an imported asset used in a protected source sequence loses mutation permission even if the bridge imported it', async () => {
  const f = apiFixture(),
    before = await f.api.importSnapshot(['source.mov']);
  f.root.items = [];
  before.ids.clear();
  f.root.items.push(f.media);
  await f.api.captureImports(before);
  const { clip } = await f.clipRef(f.source),
    item = await f.read('VideoClipTrackItem#getProjectItem', clip);
  assert.equal(item.scope.editable, true);
  await assert.rejects(
    f.api.actions(
      {
        projectId: f.project.guid,
        actions: [
          {
            memberId: 'ProjectItem#createSetNameAction',
            target: item.$ref,
            parameters: { inName: 'Blocked' },
          },
        ],
      },
      deadline(),
    ),
    { code: 'SOURCE_ASSET_PROTECTED' },
  );
  assert.equal(f.media.name, 'Source media');
});
test('frame export rejects mismatched output directories and excessive dimensions before native execution', async () => {
  const f = apiFixture(),
    seq = await f.working(),
    c = await f.context(seq),
    time = await f.read('TickTime.createWithTicks', null, { ticks: '0' });
  const args = {
    projectId: f.project.guid,
    memberId: 'Exporter.exportSequenceFrame',
    parameters: {
      sequence: { $ref: c.sequence.$ref },
      time: { $ref: time.$ref },
      filename: 'elsewhere/out.png',
      filepath: 'exports',
      width: 320,
      height: 180,
    },
  };
  await assert.rejects(f.api.startJob(args, deadline()), { code: 'INVALID_API_ARGUMENT' });
  args.parameters.filename = 'exports/out.png';
  args.parameters.width = 1000000000;
  await assert.rejects(f.api.startJob(args, deadline()), { code: 'INVALID_API_ARGUMENT' });
  f.module.Exporter.exportSequenceFrame = async () => false;
  args.parameters.width = 320;
  const job = await f.api.startJob(args, deadline());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.api.job({ jobId: job.jobId }).state, 'native_returned_false');
});
test('an ambiguous native union does not grant every candidate type for mutation arguments', async () => {
  const f = apiFixture();
  const c = await f.context(),
    item = await f.read('VideoClipTrackItem#getProjectItem', (await f.clipRef()).clip),
    asset = await f.read('ClipProjectItem.cast', null, { projectItem: { $ref: item.$ref } });
  f.media.getComponentChain = async () => ({ getComponentCount: () => 0 });
  const chain = await f.read('ClipProjectItem#getComponentChain', asset, {
    mediaType: { $enum: 'Constants.MediaType.ANY' },
  });
  assert.deepEqual(chain.types, []);
  assert.equal(chain.candidateTypes.length, 2);
  assert.equal(await f.read('VideoComponentChain#getComponentCount', chain), 0);
  assert.throws(
    () => resolveValue({ $ref: chain.$ref }, { kind: 'ref', name: 'VideoComponentChain' }, f.api),
    { code: 'INVALID_API_ARGUMENT' },
  );
});

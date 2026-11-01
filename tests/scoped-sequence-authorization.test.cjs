const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validateArgs } = require('../build/lib/runtime.cjs');
const { apiFixture } = require('./helpers/api-fixture.cjs');
const deadline = () => Date.now() + 10000;
const args = (f, extra = {}) => ({ projectId: f.project.guid, operationId: randomUUID(), ...extra });

async function fixture() {
  const f = apiFixture(), track = await f.source.getVideoTrack(0);
  track.id = 11;
  for (const c of f.source.items) c.getTrackIndex = async () => 0;
  const r = await f.control.execute('duplicate_sequence', args(f, { sequenceId: f.source.guid, name: 'Scoped backup' }), deadline());
  const backup = f.sequences.find(s => s.guid === r.sequence.id);
  let audioReads = 0;
  for (const s of [f.source, backup]) {
    s.getAudioTrackCount = async () => 3;
    s.getAudioTrack = async () => { audioReads++; throw Error('Unrelated audio getter unavailable'); };
  }
  const grant = extra => f.control.execute('authorize_sequence', args(f, {
    sequenceId: f.source.guid, backupSequenceId: backup.guid, confirm: true, backupVerified: true,
    videoTrackIndex: 0, ...extra,
  }), deadline());
  return { ...f, track, backup, grant, audioReads: () => audioReads };
}

test('video-track grant verifies only the selected track and never reads broken unrelated audio', async () => {
  const f = await fixture(), r = await f.grant();
  assert.equal(r.trackEditable, true);
  assert.equal(f.audioReads(), 0);
  assert.equal(f.control.mayEdit(f.project.guid, f.source.guid), false);
  assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'video', 0), true);
  assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'video', 1), false);
  assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'audio', 0), false);
  assert.equal(f.control.mayEdit(f.project.guid, f.backup.guid), false);
  const { clip } = await f.clipRef();
  assert.equal(clip.scope.editable, true);
  await f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'VideoClipTrackItem#createSetDisabledAction', target: clip.$ref, parameters: { disabled: true } }] }, deadline());
  assert.equal(f.source.items[0].state.disabled, true);
  assert.equal(f.backup.items[0].state.disabled, undefined);
  assert.equal(f.audioReads(), 0);
});

test('scoped grant rejects consent/backup failures and target mismatches before granting', async t => {
  for (const mode of ['consent', 'unverified', 'timing', 'wrong-track']) await t.test(mode, async () => {
    const f = await fixture();
    const extra = mode === 'consent' ? { confirm: false } : mode === 'unverified' ? { backupVerified: false } : mode === 'wrong-track' ? { videoTrackIndex: 1 } : {};
    if (mode === 'timing') f.backup.items[0].state.end = f.tick('1');
    await assert.rejects(f.grant(extra));
    assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'video', 0), false);
  });
});

test('full-sequence authorization still verifies audio and reports a confirmed preflight failure', async () => {
  const f = await fixture();
  await assert.rejects(f.grant({ videoTrackIndex: undefined }), { code: 'BACKUP_VERIFICATION_FAILED' });
  assert(f.audioReads() > 0);
  assert.equal(f.control.mayEdit(f.project.guid, f.source.guid), false);
});

test('scoped native writes reject sequence-wide edits and changed track identity', async () => {
  const f = await fixture(); await f.grant();
  f.source.createSetInPointAction = () => f.action(() => { throw Error('Must not run'); });
  const ctx = await f.context(), tick = await f.read('TickTime.createWithTicks', null, { ticks: '0' });
  await assert.rejects(f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'Sequence#createSetInPointAction', target: ctx.sequence.$ref, parameters: { tickTime: { $ref: tick.$ref } } }] }, deadline()), { code: 'VIDEO_TRACK_SCOPE_PROTECTED' });
  const { clip } = await f.clipRef(); f.track.id = 12;
  await assert.rejects(f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'VideoClipTrackItem#createSetDisabledAction', target: clip.$ref, parameters: { disabled: true } }] }, deadline()), { code: 'ACTIVE_CONTEXT_CHANGED' });
  assert.equal(f.source.items[0].state.disabled, undefined);
});

test('scoped native writes reject stale clips moved to another track', async () => {
  const f = await fixture(); await f.grant(); const { clip } = await f.clipRef();
  f.source.items[0].getTrackIndex = async () => 1;
  await assert.rejects(f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'VideoClipTrackItem#createSetDisabledAction', target: clip.$ref, parameters: { disabled: true } }] }, deadline()), { code: 'CLIP_CHANGED' });
});

test('scoped overwrite permits only its selected video track with audio suppressed', async () => {
  const f = await fixture(); await f.grant(); const calls = [];
  f.module.SequenceEditor.getEditor = () => ({ createOverwriteItemAction: (...a) => f.action(() => calls.push(a)) });
  const ctx = await f.context(), ed = await f.read('SequenceEditor.getEditor', null, { sequenceObject: { $ref: ctx.sequence.$ref } }), root = await f.read('Project#getRootItem', ctx.project), items = await f.read('FolderItem#getItems', root), time = await f.read('TickTime.createWithTicks', null, { ticks: '0' });
  const params = { projectItem: { $ref: items.items[0].$ref }, time: { $ref: time.$ref }, videoTrackIndex: 0, audioTrackIndex: -1 };
  const run = parameters => f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'SequenceEditor#createOverwriteItemAction', target: ed.$ref, parameters }] }, deadline());
  for (const wrong of [{ ...params, audioTrackIndex: 0 }, { ...params, videoTrackIndex: 1 }]) await assert.rejects(run(wrong), { code: 'VIDEO_TRACK_SCOPE_PROTECTED' });
  await run(params); assert.equal(calls.length, 1); assert.equal(calls[0][2], 0); assert.equal(calls[0][3], -1);
});

test('scoped removal rejects ripple and audio removal, accepts exact-track non-ripple video selection', async () => {
  const f = await fixture(); await f.grant(); const { c, clip } = await f.clipRef(), ed = await f.read('SequenceEditor.getEditor', null, { sequenceObject: { $ref: c.sequence.$ref } });
  const parameters = { trackItemSelection: { $selection: [clip.$ref] }, ripple: false, mediaType: { $enum: 'Constants.MediaType.VIDEO' }, shiftOverLapping: false };
  const run = p => f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'SequenceEditor#createRemoveItemsAction', target: ed.$ref, parameters: p }] }, deadline());
  for (const p of [{ ...parameters, ripple: true }, { ...parameters, shiftOverLapping: true }, { ...parameters, mediaType: { $enum: 'Constants.MediaType.AUDIO' } }]) await assert.rejects(run(p), { code: 'VIDEO_TRACK_SCOPE_PROTECTED' });
  await run(parameters); assert.equal(f.source.items.length, 0); assert.equal(f.backup.items.length, 1);
});

test('video-track scope is bounded in both command validation and runtime ownership', async () => {
  const f = await fixture();
  for (const index of [-1, 128, 1.5, '0']) assert.throws(() => validateArgs('authorize_sequence', args(f, { sequenceId: f.source.guid, backupSequenceId: f.backup.guid, confirm: true, backupVerified: true, videoTrackIndex: index })));
  await f.grant();
  await f.control.execute('revoke_sequence_authorization', args(f, { sequenceId: f.source.guid }), deadline());
  assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'video', 0), false);
  assert.equal(f.control.mayEdit(f.project.guid, f.backup.guid), false);
});

test('a scoped grant narrows previously working ownership and cannot expose source deletion', async () => {
  const f = await fixture(); f.control.markWorking(f.project, f.source);
  assert.equal(f.control.isWorking(f.project.guid, f.source.guid), true);
  await f.grant();
  assert.equal(f.control.isWorking(f.project.guid, f.source.guid), false);
  assert.equal(f.control.mayEdit(f.project.guid, f.source.guid), false);
  assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'video', 0), true);
  await assert.rejects(f.api.deleteWorking({ projectId: f.project.guid, sequenceId: f.source.guid }, deadline()), { code: 'SOURCE_SEQUENCE_PROTECTED' });
  await f.control.execute('revoke_sequence_authorization', args(f, { sequenceId: f.source.guid }), deadline());
  assert.equal(f.control.mayEditTrack(f.project.guid, f.source.guid, 'video', 0), false);
});

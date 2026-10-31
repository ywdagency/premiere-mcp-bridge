const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PremiereControl, validateArgs } = require('../build/lib/runtime.cjs');
const { controlFixture, TPS } = require('./helpers/control-fixture.cjs');
const { apiFixture } = require('./helpers/api-fixture.cjs');
const deadline = () => Date.now() + 5000;
const args = (f, extra = {}) => ({ projectId: f.project.guid, operationId: randomUUID(), ...extra });
async function backup(f, control = f.control, source = f.source) {
  const receipt = await control.execute('duplicate_sequence', args(f, { sequenceId: source.guid, name: 'Retained backup' }), deadline());
  return f.sequences.find(s => s.guid === receipt.sequence.id);
}
const grant = (f, b) => args(f, { sequenceId: f.source.guid, backupSequenceId: b.guid, confirm: true, backupVerified: true });

test('explicit verified source authorization permits timeline edits, protects backup and can be revoked', async () => {
  const f = controlFixture(), c = new PremiereControl(f.host), b = await backup(f, c);
  const receipt = await c.execute('authorize_sequence', grant(f, b), deadline());
  assert.equal(receipt.editable, true);
  assert.equal(receipt.saved, false);
  assert.equal(c.isWorking(f.project.guid, f.source.guid), false);
  assert.equal(c.mayEdit(f.project.guid, b.guid), false);
  assert.equal(c.capabilities().workingSequences.some(s => s.id === b.guid), false);
  assert.equal(c.capabilities().authorizedSequences[0].backupSequenceId, b.guid);
  const state = f.source.items[0].state;
  await c.execute('move_clip', args(f, { sequenceId: f.source.guid, trackType: 'video', trackIndex: 0, clipIndex: 0,
    expectedProjectItemId: 'media-1', expectedStartTicks: state.start.ticks, expectedEndTicks: state.end.ticks,
    expectedInTicks: state.sourceIn.ticks, expectedOutTicks: state.sourceOut.ticks, newStartTicks: String(6n * TPS) }), deadline());
  assert.equal(f.source.items[0].state.start.ticks, String(6n * TPS));
  assert.equal(b.items[0].state.start.ticks, '0');
  await c.execute('revoke_sequence_authorization', args(f, { sequenceId: f.source.guid }), deadline());
  assert.equal(c.mayEdit(f.project.guid, f.source.guid), false);
  assert.equal(c.mayEdit(f.project.guid, b.guid), false);
  assert.equal(new PremiereControl(f.host).mayEdit(f.project.guid, f.source.guid), false);
});

test('false consent, unverified backup, same ID, unrelated clone and changed source reject without a grant', async t => {
  for (const mode of ['consent', 'verified', 'same', 'unrelated', 'timing', 'media', 'speed', 'reverse', 'timebase', 'project', 'disabled', 'expired']) {
    await t.test(mode, async () => {
      const f = controlFixture(), c = new PremiereControl(f.host), b = await backup(f, c), a = grant(f, b);
      let code = 'INVALID_SEQUENCE_BACKUP';
      if (mode === 'consent') { a.confirm = false; code = 'EXPLICIT_AUTHORIZATION_REQUIRED'; }
      if (mode === 'verified') { a.backupVerified = false; code = 'EXPLICIT_AUTHORIZATION_REQUIRED'; }
      if (mode === 'same') a.backupSequenceId = f.source.guid;
      if (mode === 'unrelated') a.backupSequenceId = (await backup(f, c, f.sequence('Other source'))).guid;
      if (mode === 'timing') { f.source.items[0].state.end = f.tick(String(3n * TPS)); code = 'BACKUP_MISMATCH'; }
      if (mode === 'media') { f.source.items[0].getProjectItem = async () => ({ getId: () => 'different' }); code = 'BACKUP_MISMATCH'; }
      if (mode === 'speed') { f.source.items[0].state.speed = 2; code = 'BACKUP_MISMATCH'; }
      if (mode === 'reverse') { f.source.items[0].state.reversed = true; code = 'BACKUP_MISMATCH'; }
      if (mode === 'timebase') { f.source.getTimebase = async () => '1'; code = 'BACKUP_MISMATCH'; }
      if (mode === 'project') { a.projectId = 'wrong'; code = 'ACTIVE_CONTEXT_CHANGED'; }
      if (mode === 'disabled') { f.setEnabled(false); code = 'WRITES_DISABLED'; }
      if (mode === 'expired') code = 'REQUEST_EXPIRED';
      const transactions = f.transactions.length;
      await assert.rejects(c.execute('authorize_sequence', a, mode === 'expired' ? Date.now() - 1 : deadline()), { code });
      assert.equal(c.mayEdit(f.project.guid, f.source.guid), false);
      assert.equal(f.transactions.length, transactions);
    });
  }
});

test('retained backup cannot itself be authorized; consent fields are mandatory at both boundaries', async () => {
  const f = controlFixture(), c = new PremiereControl(f.host), b = await backup(f, c);
  await c.execute('authorize_sequence', grant(f, b), deadline());
  const second = await backup(f, c, b);
  await assert.rejects(c.execute('authorize_sequence', args(f, { sequenceId: b.guid, backupSequenceId: second.guid,
    confirm: true, backupVerified: true }), deadline()), { code: 'INVALID_SEQUENCE_BACKUP' });
  assert.throws(() => validateArgs('authorize_sequence', args(f, { sequenceId: f.source.guid, backupSequenceId: b.guid })), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateArgs('authorize_sequence', { ...grant(f, b), code: 'arbitrary()' }), { code: 'INVALID_REQUEST' });
});

test('source changes during verification do not grant permission', async () => {
  const f = controlFixture(), c = new PremiereControl(f.host), b = await backup(f, c);
  const original = f.source.getTimebase; let reads = 0;
  f.source.getTimebase = async () => { if (++reads === 3) f.source.items[0].state.speed = 2; return original(); };
  await assert.rejects(c.execute('authorize_sequence', grant(f, b), deadline()), { code: 'ACTIVE_CONTEXT_CHANGED' });
  assert.equal(c.mayEdit(f.project.guid, f.source.guid), false);
});

test('native source timeline gets permission without granting source-media mutations or deletion', async () => {
  const f = apiFixture(), b = await backup(f);
  await f.control.execute('authorize_sequence', grant(f, b), deadline());
  const { clip } = await f.clipRef();
  assert.equal(clip.scope.editable, true);
  const item = await f.read('VideoClipTrackItem#getProjectItem', clip);
  assert.equal(item.scope.editable, false);
  await f.api.actions({ projectId: f.project.guid, actions: [{ memberId: 'VideoClipTrackItem#createSetDisabledAction',
    target: clip.$ref, parameters: { disabled: true } }] }, deadline());
  assert.equal(f.source.items[0].state.disabled, true);
  assert.equal(b.items[0].state.disabled, undefined);
  await assert.rejects(f.api.deleteWorking({ projectId: f.project.guid, sequenceId: f.source.guid }, deadline()), { code: 'SOURCE_SEQUENCE_PROTECTED' });
  await assert.rejects(f.api.deleteWorking({ projectId: f.project.guid, sequenceId: b.guid }, deadline()), { code: 'SOURCE_SEQUENCE_PROTECTED' });
});

test('owned imported media used by an authorized original stays protected from asset changes', async () => {
  const f = apiFixture(), before = await f.api.importSnapshot(['source.mov']);
  before.ids.clear();
  await f.api.captureImports(before);
  const b = await backup(f);
  await f.control.execute('authorize_sequence', grant(f, b), deadline());
  const { clip } = await f.clipRef();
  const item = await f.read('VideoClipTrackItem#getProjectItem', clip);
  assert.equal(item.scope.editable, true); // Imported ownership is necessary, never sufficient.
  await assert.rejects(f.api.actions({ projectId: f.project.guid, actions: [{
    memberId: 'ProjectItem#createSetNameAction', target: item.$ref, parameters: { inName: 'Must not change' },
  }] }, deadline()), { code: 'SOURCE_ASSET_PROTECTED' });
  assert.equal(f.media.name, 'Source media');
});

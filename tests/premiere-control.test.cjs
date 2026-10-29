const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PremiereControl } = require('../build/lib/runtime.cjs');
const { validateArgs } = require('../build/lib/bridge-protocol.cjs');
const { controlFixture, TPS } = require('./helpers/control-fixture.cjs');
const deadline = () => Date.now() + 5000;
function args(fixture, extra = {}) { return { projectId: fixture.project.guid, operationId: randomUUID(), ...extra }; }
async function working(f, control) {
  const result = await control.execute('duplicate_sequence', args(f, { sequenceId: f.source.guid, name: 'Working copy' }), deadline());
  return f.sequences.find((seq) => seq.guid === result.sequence.id);
}
function target(f, sequence) {
  const s = sequence.items[0].state;
  return args(f, { sequenceId: sequence.guid, trackType: 'video', trackIndex: 0, clipIndex: 0, expectedProjectItemId: 'media-1',
    expectedStartTicks: s.start.ticks, expectedEndTicks: s.end.ticks, expectedInTicks: s.sourceIn.ticks, expectedOutTicks: s.sourceOut.ticks });
}

test('creation and duplication grant only new sequence IDs; source edits stay protected', async () => {
  const f = controlFixture(), control = new PremiereControl(f.host);
  await assert.rejects(control.execute('move_clip', { ...target(f, f.source), newStartTicks: String(5n * TPS) }, deadline()), { code: 'SOURCE_SEQUENCE_PROTECTED' });
  const copy = await working(f, control);
  assert.equal(copy.name, 'Working copy');
  assert.equal(control.mayEdit(f.project.guid, copy.guid), true);
  assert.equal(control.mayEdit(f.project.guid, f.source.guid), false);
  const created = await control.execute('create_sequence', args(f, { name: 'Empty sequence' }), deadline());
  assert.equal(created.editable, true);
  assert.equal(created.saved, false);
  assert.equal(f.source.name, 'Source');
});

test('move preserves source offsets, duration and the original timeline', async () => {
  const f = controlFixture(), control = new PremiereControl(f.host), copy = await working(f, control);
  const result = await control.execute('move_clip', { ...target(f, copy), newStartTicks: String(6n * TPS) }, deadline());
  assert.equal(result.timelineStartTicks, String(6n * TPS));
  assert.equal(result.timelineEndTicks, String(10n * TPS));
  assert.equal(result.sourceInTicks, String(20n * TPS));
  assert.equal(f.source.items[0].state.start.ticks, '0');
  assert.equal(f.transactions.at(-1).actions, 1);
});

test('inward trim retains matching source content in a single transaction', async () => {
  const f = controlFixture(), control = new PremiereControl(f.host), copy = await working(f, control);
  const result = await control.execute('trim_clip', { ...target(f, copy), newStartTicks: String(TPS), newEndTicks: String(3n * TPS) }, deadline());
  assert.equal(result.sourceInTicks, String(21n * TPS));
  assert.equal(result.sourceOutTicks, String(23n * TPS));
  assert.equal(result.timelineStartTicks, String(TPS));
  assert.equal(result.timelineEndTicks, String(3n * TPS));
  assert.equal(f.transactions.at(-1).actions, 2);
  assert.equal(f.source.items[0].state.sourceIn.ticks, String(20n * TPS));
});

test('stale clip and project, overlap, invalid trim, disabled writes and expired requests reject before transactions', async () => {
  const f = controlFixture(), control = new PremiereControl(f.host), copy = await working(f, control);
  const count = f.transactions.length;
  await assert.rejects(control.execute('move_clip', { ...target(f, copy), expectedInTicks: '0', newStartTicks: '0' }, deadline()), { code: 'CLIP_CHANGED' });
  await assert.rejects(control.execute('move_clip', { ...target(f, copy), projectId: 'another', newStartTicks: '0' }, deadline()), { code: 'ACTIVE_CONTEXT_CHANGED' });
  copy.items.push(f.clip({ start: 5, end: 8 }));
  await assert.rejects(control.execute('move_clip', { ...target(f, copy), newStartTicks: String(3n * TPS) }, deadline()), { code: 'CLIP_OVERLAP' });
  await assert.rejects(control.execute('trim_clip', { ...target(f, copy), newStartTicks: '0', newEndTicks: String(5n * TPS) }, deadline()), { code: 'INVALID_TRIM' });
  copy.items[0].state.speed = 2;
  await assert.rejects(control.execute('trim_clip', { ...target(f, copy), newStartTicks: '0', newEndTicks: String(TPS) }, deadline()), { code: 'UNSUPPORTED_CLIP_SPEED' });
  f.setEnabled(false);
  await assert.rejects(control.execute('create_sequence', args(f, { name: 'Denied' }), deadline()), { code: 'WRITES_DISABLED' });
  f.setEnabled(true);
  await assert.rejects(control.execute('create_sequence', args(f, { name: 'Expired' }), Date.now() - 1), { code: 'REQUEST_EXPIRED' });
  assert.equal(f.transactions.length, count);
});

test('imports use granted media resolution and a cast root bin; opening changes only active context', async () => {
  const f = controlFixture(), control = new PremiereControl(f.host);
  const result = await control.execute('import_media', args(f, { paths: ['shots/clip.mov'] }), deadline());
  assert.equal(result.saved, false);
  assert.deepEqual(f.imports[0], [['/granted/shots/clip.mov'], true, { name: 'Root' }, false]);
  const copy = await working(f, control);
  await control.execute('open_sequence', args(f, { sequenceId: copy.guid }), deadline());
  assert.equal((await f.project.getActiveSequence()).guid, copy.guid);
  assert.equal(f.source.name, 'Source');
});

test('contracts reject missing operation IDs, traversal, executable fields and malformed exact ticks', () => {
  assert.throws(() => validateArgs('create_sequence', { projectId: 'p', name: 'test' }), { code: 'INVALID_REQUEST' });
  for (const path of ['../secret.mov', '/absolute.mov', 'a/../b.mov', 'a//b.mov', 'C:/x.mov', 'file.mov\0']) {
    assert.throws(() => validateArgs('import_media', { projectId: 'p', operationId: randomUUID(), paths: [path] }), { code: 'INVALID_REQUEST' });
  }
  assert.throws(() => validateArgs('create_sequence', { projectId: 'p', operationId: randomUUID(), name: 'test', script: 'save()' }), { code: 'INVALID_REQUEST' });
  const f = controlFixture();
  assert.throws(() => validateArgs('move_clip', { ...target(f, f.source), newStartTicks: '1.1' }), { code: 'INVALID_REQUEST' });
});

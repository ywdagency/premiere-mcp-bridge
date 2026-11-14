const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PremiereControl } = require('../build/lib/runtime.cjs');
const { controlFixture, TPS } = require('./helpers/control-fixture.cjs');

async function fixture() {
  const f = controlFixture();
  f.source.items.push(f.clip({ name: 'Later', start: 8, end: 12, sourceIn: 30 }));
  const c = new PremiereControl(f.host);
  const receipt = await c.execute('duplicate_sequence', {
    projectId: f.project.guid, operationId: randomUUID(),
    sequenceId: f.source.guid, name: 'Retained backup',
  }, Date.now() + 5000);
  const backup = f.sequences.find(s => s.guid === receipt.sequence.id);
  backup.items.reverse();
  for (const sequence of [f.source, backup]) {
    (await sequence.getVideoTrack(0)).id = 11;
    for (const clip of sequence.items) clip.getTrackIndex = async () => 0;
  }
  const authorize = (videoTrackIndex) => c.execute('authorize_sequence', {
    projectId: f.project.guid, operationId: randomUUID(),
    sequenceId: f.source.guid, backupSequenceId: backup.guid,
    confirm: true, backupVerified: true,
    ...(videoTrackIndex === undefined ? {} : { videoTrackIndex }),
  }, Date.now() + 5000);
  return { ...f, c, backup, authorize };
}

test('matching backup with reordered native enumeration authorizes full or scoped edits', async t => {
  for (const videoTrackIndex of [undefined, 0]) {
    await t.test(videoTrackIndex === undefined ? 'full' : 'video track', async () => {
      const f = await fixture();
      const receipt = await f.authorize(videoTrackIndex);
      assert.equal(receipt.saved, false);
      assert.equal(f.c.capabilities().authorizedSequences.length, 1);
      assert.equal(f.c.mayEdit(f.project.guid, f.backup.guid), false);
      assert.equal(f.source.items[0].state.start.ticks, '0');
    });
  }
});

test('ignoring enumeration still rejects changes to content and occurrence multiplicity', async t => {
  const cases = {
    media: f => { f.backup.items[0].getProjectItem = async () => ({ getId: () => 'different' }); },
    timeline: f => { f.backup.items[0].state.end = f.tick(13n * TPS); },
    sourceIn: f => { f.backup.items[0].state.sourceIn = f.tick(31n * TPS); },
    sourceOut: f => { f.backup.items[0].state.sourceOut = f.tick(35n * TPS); },
    speed: f => { f.backup.items[0].state.speed = 2; },
    reverse: f => { f.backup.items[0].state.reversed = true; },
    missing: f => { f.backup.items.pop(); },
    extra: f => { f.backup.items.push(f.backup.items[0]); },
    multiplicity: f => { f.backup.items[1] = f.backup.items[0]; },
    timebase: f => { f.backup.getTimebase = async () => '1'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    await t.test(name, async () => {
      const f = await fixture();
      mutate(f);
      const before = f.transactions.length;
      await assert.rejects(f.authorize(0), { code: 'BACKUP_MISMATCH' });
      assert.equal(f.c.capabilities().authorizedSequences.length, 0);
      assert.equal(f.transactions.length, before);
    });
  }
});

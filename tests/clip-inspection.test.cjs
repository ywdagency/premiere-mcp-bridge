const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectPremiere } = require("../build/lib/premiere-inspection.cjs");
const { validateArgs, utf8ByteLength } = require("../build/lib/bridge-protocol.cjs");
const { hostFixture } = require("./helpers/bridge-fixture.cjs");

test("reads clips from every video/audio track with timeline and source-relative boundaries", async () => {
  const result = await inspectPremiere(hostFixture(), "get_sequence_clips", {});
  assert.equal(result.readOnly, true);
  assert.equal(result.page.totalClips, 3);
  assert.deepEqual(result.tracks.map((t) => [t.label, t.clipCount]), [["V1", 2], ["A1", 1], ["A2", 0]]);
  assert.deepEqual(result.clips.map((c) => c.name), ["Shot A", "Shot B", "Voice take"]);
  const shot = result.clips[0];
  assert.equal(shot.timelineStart.seconds, 0);
  assert.equal(shot.timelineEnd.seconds, 4);
  assert.equal(shot.sourceIn.seconds, 20);
  assert.equal(shot.sourceOut.seconds, 24);
  assert.equal(shot.duration.seconds, 4);
  assert.deepEqual(shot.locator, { trackType: "video", trackIndex: 0, clipIndex: 0 });
  assert.equal(JSON.stringify(result).includes("/test/private.prproj"), false);
});

test("filters audio/video tracks, pages across track boundaries and preserves empty tracks", async () => {
  const host = hostFixture();
  const first = await inspectPremiere(host, "get_sequence_clips", { limit: 2 });
  const last = await inspectPremiere(host, "get_sequence_clips", { offset: first.page.nextOffset, sequenceId: first.activeSequence.id });
  assert.equal(last.clips[0].name, "Voice take");
  assert.equal(last.page.nextOffset, null);
  const empty = await inspectPremiere(host, "get_sequence_clips", { mediaType: "audio", trackIndex: 1 });
  assert.equal(empty.clips.length, 0);
  assert.equal(empty.tracks[0].label, "A2");
  const past = await inspectPremiere(host, "get_sequence_clips", { offset: 50 });
  assert.equal(past.clips.length, 0);
  assert.equal(past.page.nextOffset, null);
  await assert.rejects(inspectPremiere(host, "get_sequence_clips", { mediaType: "video", trackIndex: 1 }), { code: "TRACK_NOT_FOUND" });
});

test("rejects stale sequence identity and changing track inventory without mutations", async () => {
  const host = hostFixture();
  await assert.rejects(inspectPremiere(host, "get_sequence_clips", { sequenceId: "other-sequence" }), { code: "ACTIVE_CONTEXT_CHANGED" });
  const sequence = await (await host.getActiveProject()).getActiveSequence();
  const track = await sequence.getVideoTrack(0);
  const original = track.getTrackItems;
  let calls = 0;
  track.getTrackItems = (...args) => (++calls === 1 ? original(...args) : []);
  await assert.rejects(inspectPremiere(host, "get_sequence_clips", {}), { code: "ACTIVE_CONTEXT_CHANGED" });
});

test("missing active sequence returns an empty page and never activates a sequence", async () => {
  const host = hostFixture();
  host.getActiveProject = async () => null;
  const result = await inspectPremiere(host, "get_sequence_clips", {});
  assert.equal(result.activeSequence, null);
  assert.equal(result.clips.length, 0);
  await assert.rejects(inspectPremiere(host, "get_sequence_clips", { sequenceId: "previous" }), { code: "ACTIVE_CONTEXT_CHANGED" });
});

test("clip dispatcher rejects unknown args and unbounded or ambiguous reads", () => {
  for (const args of [{ limit: 0 }, { limit: 21 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 },
    { trackIndex: 0 }, { mediaType: "all", trackIndex: 0 }, { mediaType: "caption" },
    { mediaType: "video", trackIndex: 128 }, { sequenceId: "" }, { includePath: true }, { code: "save()" }]) {
    assert.throws(() => validateArgs("get_sequence_clips", args));
  }
  assert.doesNotThrow(() => validateArgs("get_sequence_clips", { mediaType: "audio", trackIndex: 0, limit: 20 }));
});

test("UTF-8 payload limits count multibyte text, astral characters and escaped lone surrogates", () => {
  for (const value of ["ascii", "clip\u0301", "🎞️", "\ud800", "音声".repeat(10000)]) {
    const json = JSON.stringify({ value });
    assert.equal(utf8ByteLength(json), Buffer.byteLength(json));
  }
});

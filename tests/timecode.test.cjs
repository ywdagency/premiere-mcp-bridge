const test = require("node:test");
const assert = require("node:assert/strict");

function page({ base = "10594584000", type = 110, name = "FPS_23_976", frames = 24n, zero = "0", subframe = 0n } = {}) {
  const ticks = (frames * BigInt(base) + subframe).toString();
  const time = { ticks, seconds: Number(ticks) / 254016000000 };
  return { readOnly: true, activeSequence: { timebaseTicksPerFrame: base,
    zeroPoint: { ticks: zero, seconds: Number(zero) / 254016000000 }, videoTimeDisplay: { type, name } },
    clips: [{ timelineStart: time, timelineEnd: time, duration: time, sourceIn: time, sourceOut: time }] };
}

test("exact 23.976 timecodes keep source offsets separate from sequence display start", async () => {
  const { formatClipPage } = await import("../mcp/timecode.mjs");
  const result = formatClipPage(page({ zero: (3600n * 254016000000n).toString() }));
  // A time offset of 3600 real seconds at 23.976 is 86313 whole frames, not 86400.
  assert.equal(result.clips[0].timelineStart.timecode, "00:59:57:09");
  assert.equal(result.clips[0].sourceIn.timecodeAtSequenceRate, "00:00:01:00");
  assert.equal(result.clips[0].sourceIn.ticks, "254270016000");
  assert.match(result.activeSequence.timecodeFormat.sourceBasis, /not embedded/);
});

test("29.97 and 59.94 drop-frame handle minute and ten-minute boundaries", async () => {
  const { formatFrameTimecode, formatClipPage } = await import("../mcp/timecode.mjs");
  assert.equal(formatFrameTimecode(1799n, 30, 2), "00:00:59;29");
  assert.equal(formatFrameTimecode(1800n, 30, 2), "00:01:00;02");
  assert.equal(formatFrameTimecode(17982n, 30, 2), "00:10:00;00");
  assert.equal(formatFrameTimecode(107892n, 30, 2), "01:00:00;00");
  assert.equal(formatFrameTimecode(3600n, 60, 4), "00:01:00;04");
  assert.equal(formatFrameTimecode(35964n, 60, 4), "00:10:00;00");
  const result = formatClipPage(page({ base: "4237833600", type: 106, name: null, frames: 3600n }));
  assert.equal(result.clips[0].timelineStart.timecode, "00:01:00;04");
  assert.equal(result.clips[0].sourceIn.timecodeAtSequenceRate, "00:01:00:00");
});

test("subframe audio, negative time, long exact ticks and frames display remain explicit", async () => {
  const { formatClipPage } = await import("../mcp/timecode.mjs");
  const sub = formatClipPage(page({ frames: 1n, subframe: 55n }));
  assert.equal(sub.clips[0].timelineStart.subframeTicks, "55");
  assert.equal(sub.clips[0].timelineStart.timecode, "00:00:00:01");
  const negative = formatClipPage(page({ frames: 0n, subframe: -1n }));
  assert.equal(negative.clips[0].timelineStart.frameIndexAtSequenceRate, "-1");
  const huge = formatClipPage(page({ frames: 9007199254740993n }));
  assert.equal(huge.clips[0].timelineStart.frameIndexAtSequenceRate, "9007199254740993");
  const frames = formatClipPage(page({ type: 109, name: "FRAMES" }));
  assert.equal(frames.clips[0].timelineStart.timecode, null);
  assert.equal(frames.clips[0].timelineStart.displayValue, "24");
});

test("unknown display formats and mismatched DF rates never invent a displayed timecode", async () => {
  const { formatClipPage } = await import("../mcp/timecode.mjs");
  for (const options of [{ type: 111, name: "FEET_FRAME_16mm" }, { type: 999, name: null },
    { type: 102, name: "FPS_29_97", base: "8467200000" }]) {
    const result = formatClipPage(page(options));
    assert.equal(result.activeSequence.timecodeFormat.supported, false);
    assert.equal(result.clips[0].timelineStart.timecode, null);
    assert.ok(result.clips[0].timelineStart.ticks);
  }
});

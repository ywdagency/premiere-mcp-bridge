// Node-side exact formatting. The UXP bundle never needs BigInt or Premiere 27 APIs.
// Tick scale: AdobeDocs/uxp-premiere-pro-samples, premiere-api/src/sequence.ts.
const TICKS_PER_SECOND = 254016000000n;

const DISPLAY_TYPES = new Map([
  [100, { nominal: 24, drop: 0 }], [101, { nominal: 25, drop: 0 }],
  [102, { nominal: 30, drop: 2 }], [103, { nominal: 30, drop: 0 }],
  [104, { nominal: 30, drop: 0 }], [105, { nominal: 50, drop: 0 }],
  [106, { nominal: 60, drop: 4 }], [107, { nominal: 60, drop: 0 }],
  [108, { nominal: 60, drop: 0 }], [110, { nominal: 24, drop: 0 }],
  [113, { nominal: 48, drop: 0 }]
]);
// Numeric display codes are from Adobe-CEP/Samples/PProPanel/jsx/PPRO/Premiere.jsx.
// Host enum names take precedence for UXP hosts returning different numeric values.
const DISPLAY_NAMES = {
  FPS_23_976: { nominal: 24, drop: 0 }, FPS_25: { nominal: 25, drop: 0 },
  FPS_29_97: { nominal: 30, drop: 2 }, FPS_29_97_NON_DROP: { nominal: 30, drop: 0 }
};

function tickInteger(value) {
  if (typeof value !== "string" || !/^-?\d{1,40}$/.test(value)) throw new Error("Invalid exact tick value.");
  return BigInt(value);
}

function framesAt(ticks, base) {
  let frame = ticks / base;
  let remainder = ticks % base;
  if (remainder < 0n) { frame--; remainder += base; }
  return { frame, remainder };
}

export function formatFrameTimecode(frameNumber, nominal, drop = 0) {
  const negative = frameNumber < 0n;
  let frames = negative ? -frameNumber : frameNumber;
  const fps = BigInt(nominal);
  if (drop) {
    const skipped = BigInt(drop);
    const tenMinutes = fps * 600n - skipped * 9n;
    const minute = fps * 60n - skipped;
    const blocks = frames / tenMinutes;
    const remainder = frames % tenMinutes;
    frames += skipped * 9n * blocks + (remainder >= skipped ? skipped * ((remainder - skipped) / minute) : 0n);
  }
  const pad = (value) => value.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${pad(frames / (fps * 3600n))}:${pad(frames / (fps * 60n) % 60n)}:${pad(frames / fps % 60n)}${drop ? ";" : ":"}${pad(frames % fps)}`;
}

export function formatClipPage(result) {
  if (!result.activeSequence) return result;
  const sequence = result.activeSequence;
  const base = tickInteger(sequence.timebaseTicksPerFrame);
  if (base <= 0n) throw new Error("Invalid sequence timebase.");
  const zero = tickInteger(sequence.zeroPoint.ticks);
  const actualFps = Number(TICKS_PER_SECOND) / Number(base);
  const nominal = Math.round(actualFps);
  const knownRate = nominal >= 1 && nominal <= 240 &&
    (base * BigInt(nominal) === TICKS_PER_SECOND || base * BigInt(nominal * 1000) === TICKS_PER_SECOND * 1001n);
  const display = sequence.videoTimeDisplay;
  const spec = DISPLAY_NAMES[display.name] ?? DISPLAY_TYPES.get(display.type);
  const frameDisplay = display.name === "FRAMES" || (!display.name && display.type === 109);
  const unsupportedNamed = display.name?.startsWith("FEET_FRAME");
  const correctDropRate = spec?.drop ? base * BigInt(spec.nominal * 1000) === TICKS_PER_SECOND * 1001n : true;
  const supported = !unsupportedNamed && knownRate && spec?.nominal === nominal && correctDropRate;

  function formatTime(value, timeline) {
    const ticks = tickInteger(value.ticks);
    const { frame, remainder } = framesAt(ticks, base);
    const timing = { ...value, frameIndexAtSequenceRate: frame.toString(), subframeTicks: remainder.toString() };
    if (timeline) {
      const displayed = framesAt(ticks + zero, base).frame;
      return { ...timing,
        timecode: supported ? formatFrameTimecode(displayed, nominal, spec.drop) : null,
        displayFrameIndex: displayed.toString(),
        ...(frameDisplay ? { displayValue: displayed.toString() } : {})
      };
    }
    return { ...timing, timecodeAtSequenceRate: knownRate ? formatFrameTimecode(frame, nominal) : null };
  }
  return {
    ...result,
    activeSequence: { ...sequence, timecodeFormat: {
      supported: Boolean(supported), type: supported ? (spec.drop ? "drop-frame" : "non-drop-frame") : frameDisplay ? "frames" : "unsupported",
      nominalFps: knownRate ? nominal : null, actualFps,
      timelineBasis: "sequence-start-offset-applied", sourceBasis: "project-item-relative, sequence-rate non-drop-frame; not embedded media timecode",
      rounding: "floor to frame; exact subframe ticks retained", hours: "unwrapped; no 24-hour rollover"
    } },
    clips: result.clips.map((clip) => ({ ...clip,
      timelineStart: formatTime(clip.timelineStart, true), timelineEnd: formatTime(clip.timelineEnd, true),
      duration: formatTime(clip.duration, false), sourceIn: formatTime(clip.sourceIn, false), sourceOut: formatTime(clip.sourceOut, false)
    }))
  };
}

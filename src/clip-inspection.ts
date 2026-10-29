import type { AudioClipTrackItem, Sequence, VideoClipTrackItem } from "@adobe/premierepro";
import { BridgeError, ReadArgs } from "./bridge-protocol";

type Clip = AudioClipTrackItem | VideoClipTrackItem;
export interface ClipConstants {
  clipType: number;
  displayFormats: Record<string, number | string>;
}

function nameOf(name: string): { name: string; nameTruncated: boolean } {
  if (typeof name !== "string") throw new BridgeError("INVALID_HOST_DATA", "Premiere returned an invalid display name.");
  return { name: name.slice(0, 256), nameTruncated: name.length > 256 };
}

function timeOf(time: { ticks: string; seconds: number }): { ticks: string; seconds: number } {
  if (typeof time.ticks !== "string" || !/^-?\d{1,40}$/.test(time.ticks) || !Number.isFinite(time.seconds)) {
    throw new BridgeError("INVALID_HOST_DATA", "Premiere returned invalid clip timing.");
  }
  return { ticks: time.ticks, seconds: time.seconds };
}

export async function readSequenceClips(sequence: Sequence, args: ReadArgs, constants: ClipConstants): Promise<Record<string, unknown>> {
  const id = sequence.guid.toString();
  if (args.sequenceId !== undefined && args.sequenceId !== id) {
    throw new BridgeError("ACTIVE_CONTEXT_CHANGED", "The requested sequence is no longer active. Read the new sequence before continuing.");
  }
  if (!Number.isInteger(constants.clipType)) throw new BridgeError("UNSUPPORTED_HOST", "The host did not provide its clip enumeration constant.");
  const [videoCount, audioCount, timebase, zeroPoint, format] = await Promise.all([
    sequence.getVideoTrackCount(), sequence.getAudioTrackCount(), sequence.getTimebase(),
    sequence.getZeroPoint(), sequence.getSequenceVideoTimeDisplayFormat()
  ]);
  if (![videoCount, audioCount].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    !/^\d{1,15}$/.test(timebase) || Number(timebase) <= 0 || !Number.isInteger(format.type)) {
    throw new BridgeError("INVALID_HOST_DATA", "Premiere returned invalid sequence timing or track counts.");
  }
  const mediaType = args.mediaType ?? "all";
  const selectedCount = mediaType === "all" ? videoCount + audioCount : mediaType === "video" ? videoCount : audioCount;
  if (args.trackIndex !== undefined && args.trackIndex >= selectedCount) {
    throw new BridgeError("TRACK_NOT_FOUND", "The requested zero-based track index does not exist.");
  }
  if (args.trackIndex === undefined && selectedCount > 128) {
    throw new BridgeError("INSPECTION_LIMIT", "More than 128 tracks. Filter by mediaType and trackIndex.");
  }
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 10;
  const tracks: Record<string, unknown>[] = [];
  const page: Array<{ clip: Clip; trackType: "video" | "audio"; trackIndex: number; clipIndex: number }> = [];
  let totalClips = 0;
  const enumerated: Array<{ track: Awaited<ReturnType<Sequence["getVideoTrack"]>> | Awaited<ReturnType<Sequence["getAudioTrack"]>>; count: number }> = [];
  // Native track order, video then audio; clipIndex is an observation, never a stable clip ID.
  for (const trackType of ["video", "audio"] as const) {
    if (mediaType !== "all" && mediaType !== trackType) continue;
    const count = trackType === "video" ? videoCount : audioCount;
    const indices = args.trackIndex !== undefined ? [args.trackIndex] : Array.from({ length: count }, (_, index) => index);
    for (const trackIndex of indices) {
      const track = trackType === "video" ? await sequence.getVideoTrack(trackIndex) : await sequence.getAudioTrack(trackIndex);
      const clips = track.getTrackItems(constants.clipType, false);
      if (!Array.isArray(clips) || clips.length > 100000) {
        throw new BridgeError("INSPECTION_LIMIT", "A track exceeded the clip inventory limit.");
      }
      enumerated.push({ track, count: clips.length });
      tracks.push({ type: trackType, index: trackIndex, label: `${trackType === "video" ? "V" : "A"}${trackIndex + 1}`,
        ...nameOf(track.name), clipCount: clips.length });
      const from = Math.max(0, offset - totalClips);
      const to = Math.min(clips.length, offset + limit - totalClips);
      for (let clipIndex = from; clipIndex < to; clipIndex++) page.push({ clip: clips[clipIndex], trackType, trackIndex, clipIndex });
      totalClips += clips.length;
      if (totalClips > 100000) throw new BridgeError("INSPECTION_LIMIT", "More than 100000 clips. Filter the read to one track.");
    }
  }
  const clips = [];
  for (const { clip, trackType, trackIndex, clipIndex } of page) {
    const [name, start, end, duration, sourceIn, sourceOut, speed, reversed, projectItem] = await Promise.all([
      clip.getName(), clip.getStartTime(), clip.getEndTime(), clip.getDuration(),
      clip.getInPoint(), clip.getOutPoint(), clip.getSpeed(), clip.isSpeedReversed(), clip.getProjectItem()
    ]);
    if (!Number.isFinite(speed) || (typeof reversed !== "number" && typeof reversed !== "boolean")) {
      throw new BridgeError("INVALID_HOST_DATA", "Premiere returned invalid clip speed metadata.");
    }
    clips.push({ projectItemId: projectItem.getId(), locator: { trackType, trackIndex, clipIndex }, ...nameOf(name),
      timelineStart: timeOf(start), timelineEnd: timeOf(end), duration: timeOf(duration),
      sourceIn: timeOf(sourceIn), sourceOut: timeOf(sourceOut), speed, reversed: Boolean(reversed) });
  }
  // Detect structural changes while reading. Same-count trims can still occur: this is not an atomic snapshot.
  if (await sequence.getVideoTrackCount() !== videoCount || await sequence.getAudioTrackCount() !== audioCount ||
      await sequence.getTimebase() !== timebase || (await sequence.getZeroPoint()).ticks !== zeroPoint.ticks ||
      (await sequence.getSequenceVideoTimeDisplayFormat()).type !== format.type ||
      enumerated.some(({ track, count }) => track.getTrackItems(constants.clipType, false).length !== count)) {
    throw new BridgeError("ACTIVE_CONTEXT_CHANGED", "Track structure or time display changed during the read. Retry with Premiere idle.");
  }
  return {
    activeSequence: { id, ...nameOf(sequence.name), timebaseTicksPerFrame: timebase,
      zeroPoint: timeOf(zeroPoint), videoTimeDisplay: { type: format.type,
        name: Object.keys(constants.displayFormats).find((key) => constants.displayFormats[key] === format.type) ?? null },
      videoTrackCount: videoCount, audioTrackCount: audioCount },
    tracks, clips,
    page: { offset, limit, returned: clips.length, totalClips, nextOffset: offset + clips.length < totalClips ? offset + clips.length : null },
    scope: { mediaType, trackIndex: args.trackIndex ?? null, items: "clips-only", sourceTimes: "relative-to-project-item-start",
      locators: "observation-only", consistency: "best-effort; same-count edits may occur between reads" }
  };
}

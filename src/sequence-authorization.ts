import type { Sequence } from '@adobe/premierepro';
import { readSequenceClips } from './clip-inspection';

// Supplemental structural check. The caller must also verify the backup's
// settings, markers, captions and relevant effects before asserting backupVerified.
export async function authorizationSnapshot(sequence: Sequence, clipType: number): Promise<string> {
  const value = await readSequenceClips(sequence, { sequenceId: sequence.guid.toString(), limit: 100000 },
    { clipType, displayFormats: {} });
  const metadata = value.activeSequence as Record<string, unknown>;
  const clips = value.clips as Array<Record<string, unknown>>;
  return JSON.stringify({
    timebase: metadata.timebaseTicksPerFrame,
    zero: metadata.zeroPoint,
    display: metadata.videoTimeDisplay,
    tracks: value.tracks,
    clips: clips.map((clip) => ({
      locator: clip.locator, media: clip.projectItemId,
      start: clip.timelineStart, end: clip.timelineEnd,
      in: clip.sourceIn, out: clip.sourceOut,
      speed: clip.speed, reversed: clip.reversed,
    })),
  });
}

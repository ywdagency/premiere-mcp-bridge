import type { Project, Sequence } from "@adobe/premierepro";
import { BridgeError, ReadArgs, ReadCommand, validateArgs } from "./bridge-protocol";
import { ClipConstants, readSequenceClips } from "./clip-inspection";

type ProjectReader = Pick<Project, "guid" | "name" | "path" | "getSequences" | "getActiveSequence">;
export interface InspectionHost {
  getFileAccess?(includePath: boolean): Record<string, unknown>;
  getActiveProject(): Promise<ProjectReader | null | undefined>;
  name: string;
  version: string;
  uxpVersion: string;
  clipConstants?: ClipConstants;
}

function idOf(value: { guid: { toString(): string } } | null | undefined): string | null {
  return value ? value.guid.toString() : null;
}

function assertHostVersion(version: string): void {
  const match = /^(\d+)\.(\d+)(?:\.|$)/.exec(version);
  if (!match || Number(match[1]) < 25 || (Number(match[1]) === 25 && Number(match[2]) < 6)) {
    throw new BridgeError("UNSUPPORTED_HOST", "The bridge requires Premiere 25.6 or newer.");
  }
}

async function checkContext(host: InspectionHost, project: ProjectReader | null | undefined,
  sequence: Sequence | null | undefined): Promise<void> {
  const current = await host.getActiveProject();
  if (idOf(current) !== idOf(project) || idOf(await current?.getActiveSequence()) !== idOf(sequence)) {
    throw new BridgeError("ACTIVE_CONTEXT_CHANGED", "The active project or sequence changed during inspection. Retry the read.");
  }
}

// This adapter deliberately receives only getter capabilities, never the full ppro module.
export async function inspectPremiere(host: InspectionHost, command: ReadCommand,
  args: ReadArgs): Promise<Record<string, unknown>> {
  validateArgs(command, args);
  assertHostVersion(host.version);
  try {
    const observedFrom = new Date().toISOString();
    const project = await host.getActiveProject();
    const sequence = await project?.getActiveSequence();
    let result: Record<string, unknown>;
    if (command === "get_project") {
      const sequences = project ? await project.getSequences() : [];
      result = { project: project ? {
        id: idOf(project), name: project.name,
        ...(args.includePath ? { path: project.path } : {}),
        sequenceCount: sequences.length,
        activeSequence: sequence ? { id: idOf(sequence), name: sequence.name } : null
      } : null };
    } else if (command === "get_sequence_clips") {
      if (args.sequenceId !== undefined && idOf(sequence) !== args.sequenceId) {
        throw new BridgeError("ACTIVE_CONTEXT_CHANGED", "The requested sequence is no longer active.");
      }
      if (sequence && !host.clipConstants) throw new BridgeError("UNSUPPORTED_HOST", "Clip inspection is unavailable in this plugin build.");
      result = {
        project: project ? { id: idOf(project), name: project.name } : null,
        ...(sequence ? await readSequenceClips(sequence, args, host.clipConstants!) : {
          activeSequence: null, tracks: [], clips: [],
          page: { offset: args.offset ?? 0, limit: args.limit ?? 10, returned: 0, totalClips: 0, nextOffset: null }
        })
      };
    } else {
      let detail: Record<string, unknown> | null = null;
      if (sequence) {
        const [end, position, timebase, videoTracks, audioTracks] = await Promise.all([
          sequence.getEndTime(), sequence.getPlayerPosition(), sequence.getTimebase(),
          sequence.getVideoTrackCount(), sequence.getAudioTrackCount()
        ]);
        if (!Number.isFinite(end.seconds) || !Number.isFinite(position.seconds) ||
            !/^-?\d+$/.test(end.ticks) || !/^-?\d+$/.test(position.ticks) || !/^\d+$/.test(timebase) ||
            !Number.isSafeInteger(videoTracks) || videoTracks < 0 ||
            !Number.isSafeInteger(audioTracks) || audioTracks < 0) {
          throw new BridgeError("INVALID_HOST_DATA", "Premiere returned invalid sequence metadata.");
        }
        detail = {
          id: idOf(sequence), name: sequence.name,
          endTime: { ticks: end.ticks, seconds: end.seconds },
          playhead: { ticks: position.ticks, seconds: position.seconds },
          timebaseTicksPerFrame: timebase,
          videoTrackCount: videoTracks, audioTrackCount: audioTracks
        };
      }
      result = {
        project: project ? { id: idOf(project), name: project.name } : null,
        activeSequence: detail
      };
    }
    await checkContext(host, project, sequence);
    return {
      readOnly: true,
      host: { name: host.name, version: host.version, uxpVersion: host.uxpVersion },
      observedFrom, observedTo: new Date().toISOString(), ...result
    };
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    // Host exception text can contain paths. Do not bypass includePath by echoing it.
    throw new BridgeError("HOST_READ_FAILED", "Premiere could not read the active context. Check Premiere and retry.");
  }
}

import type { FolderItem, ProjectItem, Action, AudioClipTrackItem, Project, Sequence, TickTime, VideoClipTrackItem } from "@adobe/premierepro";
import { BridgeArgs, BridgeError } from "./bridge-protocol";
import type { BridgeCommand } from "./command-catalog";
import { ImportDiagnostics } from "./import-diagnostics";

type Clip = VideoClipTrackItem | AudioClipTrackItem;
export interface ControlHost {
  getActiveProject(): Promise<Project | null | undefined>;
  tickTime(ticks: string): TickTime;
  clipType: number;
  projectItem(item: FolderItem): ProjectItem;
  writesEnabled(): boolean;
  resolveMedia(paths: string[]): Promise<string[]>;
  mediaGranted(): boolean;
}
export class PremiereControl {
  private readonly working = new Map<string, Set<string>>();
  constructor(private readonly host: ControlHost) {}
  mayEdit(projectId: string, sequenceId: string): boolean { return this.working.get(projectId)?.has(sequenceId) ?? false; }
  forgetWorking(projectId:string,sequenceId:string):void { this.working.get(projectId)?.delete(sequenceId); }
  capabilities(): Record<string, unknown> {
    return { writesEnabled: this.host.writesEnabled(), mediaFolderGranted: this.host.mediaGranted(),
      workingSequences: Array.from(this.working, ([projectId, ids]) => Array.from(ids, (id) => ({ projectId, id }))).flat() };
  }
  markWorking(project: Project, sequence: Sequence): void {
    const key = project.guid.toString();
    if (!this.working.has(key)) this.working.set(key, new Set());
    this.working.get(key)!.add(sequence.guid.toString());
  }
  private async project(args: BridgeArgs): Promise<Project> {
    if (!this.host.writesEnabled()) throw new BridgeError("WRITES_DISABLED", "Launch Premiere MCP Bridge first.");
    const project = await this.host.getActiveProject();
    if (!project || project.guid.toString() !== args.projectId) throw new BridgeError("ACTIVE_CONTEXT_CHANGED", "The requested project is no longer active.");
    return project;
  }
  private async sequence(project: Project, args: BridgeArgs, editable = false): Promise<Sequence> {
    const sequence = (await project.getSequences()).find((item) => item.guid.toString() === args.sequenceId);
    if (!sequence) throw new BridgeError("SEQUENCE_NOT_FOUND", "The requested sequence does not exist in the active project.");
    if (editable && !this.mayEdit(project.guid.toString(), sequence.guid.toString())) {
      throw new BridgeError("SOURCE_SEQUENCE_PROTECTED", "Only sequences created or duplicated by this bridge in this plugin session can be edited.");
    }
    return sequence;
  }
  private transaction(project: Project, actions: () => Action[], label: string, expiresAt: number): void {
    let succeeded = false;
    project.lockedAccess(() => {
      this.beforeWrite(expiresAt);
      succeeded = project.executeTransaction((compound) => { for (const action of actions()) compound.addAction(action); }, label);
    });
    if (!succeeded) throw new BridgeError("TRANSACTION_FAILED", "Premiere did not confirm the transaction. Inspect the working sequence before another edit.");
  }
  private beforeWrite(expiresAt: number): void {
    if (!this.host.writesEnabled()) throw new BridgeError("WRITES_DISABLED", "Premiere MCP Bridge has stopped.");
    if (Date.now() >= expiresAt) throw new BridgeError("REQUEST_EXPIRED", "The operation expired before it could start.");
  }
  private ref(project: Project, sequence: Sequence) {
    return { projectId: project.guid.toString(), sequence: { id: sequence.guid.toString(), name: sequence.name },
      editable: this.mayEdit(project.guid.toString(), sequence.guid.toString()), saved: false };
  }
  private async importMedia(args: BridgeArgs, expiresAt: number, diagnostics: ImportDiagnostics): Promise<Record<string, unknown>> {
    try {
      diagnostics.at('preparation', 'control_project');
      const project = await this.project(args);
      diagnostics.at('path_validation', 'resolve_media');
      const files = await this.host.resolveMedia(args.paths as string[]);
      diagnostics.at('preparation', 'import_root');
      const root = await project.getRootItem();
      diagnostics.at('preparation', 'cast_import_root');
      const target = this.host.projectItem(root);
      diagnostics.at('preparation', 'import_method');
      const importFiles = project.importFiles;
      if (typeof importFiles !== 'function') throw new BridgeError('HOST_MEMBER_UNAVAILABLE', 'Project#importFiles is unavailable in this host.');
      diagnostics.at('preparation', 'write_gate');
      this.beforeWrite(expiresAt);
      diagnostics.at('native_import', 'import_files');
      diagnostics.nativeCallStarted = true;
      if (!await importFiles.call(project, files, true, target, false)) {
        throw new BridgeError("OPERATION_OUTCOME_UNKNOWN", "Premiere did not confirm the complete import. Some files may have been imported; inspect the project before another operation.");
      }
      diagnostics.at('result_registration', 'control_result');
      return { projectId: project.guid.toString(), imported: args.paths, saved: false };
    } catch (error) {
      throw diagnostics.failure(error);
    }
  }
  async execute(command: BridgeCommand, args: BridgeArgs, expiresAt: number, diagnostics?: ImportDiagnostics): Promise<Record<string, unknown>> {
    if (command === 'import_media') return this.importMedia(args, expiresAt, diagnostics ?? new ImportDiagnostics());
    const project = await this.project(args);
    try {
      if (command === "create_sequence") {
        this.beforeWrite(expiresAt);
        const sequence = await project.createSequence(args.name as string);
        this.markWorking(project, sequence);
        return this.ref(project, sequence);
      }
      if (command === "duplicate_sequence") {
        const source = await this.sequence(project, args);
        const before = new Set((await project.getSequences()).map((seq) => seq.guid.toString()));
        this.transaction(project, () => [source.createCloneAction()], "MCP: duplicate sequence", expiresAt);
        const added = (await project.getSequences()).filter((seq) => !before.has(seq.guid.toString()));
        if (added.length !== 1) throw new BridgeError("OPERATION_OUTCOME_UNKNOWN", "The clone transaction ran, but its new sequence could not be identified uniquely. Inspect Premiere; do not retry under a new operationId.");
        const clone = added[0];
        this.markWorking(project, clone);
        const item = await clone.getProjectItem();
        this.transaction(project, () => [item.createSetNameAction(args.name as string)], "MCP: name working sequence", expiresAt);
        return { ...this.ref(project, clone), sourceSequenceId: source.guid.toString() };
      }
      if (command === "open_sequence") {
        const sequence = await this.sequence(project, args);
        this.beforeWrite(expiresAt);
        if (!await project.openSequence(sequence)) throw new BridgeError("HOST_WRITE_FAILED", "Premiere did not open the requested sequence.");
        return this.ref(project, sequence);
      }
      const sequence = await this.sequence(project, args, true);
      const trackIndex = args.trackIndex as number;
      const track = args.trackType === "video" ? await sequence.getVideoTrack(trackIndex) : await sequence.getAudioTrack(trackIndex);
      if (!track) throw new BridgeError("TRACK_NOT_FOUND", "The requested track no longer exists.");
      const clips = track.getTrackItems(this.host.clipType, false) as Clip[];
      const clip = clips[args.clipIndex as number];
      if (!clip) throw new BridgeError("CLIP_CHANGED", "The clip no longer exists at the observed locator.");
      const [start, end, sourceIn, sourceOut, item] = await Promise.all([
        clip.getStartTime(), clip.getEndTime(), clip.getInPoint(), clip.getOutPoint(), clip.getProjectItem()
      ]);
      if (start.ticks !== args.expectedStartTicks || end.ticks !== args.expectedEndTicks ||
        sourceIn.ticks !== args.expectedInTicks || sourceOut.ticks !== args.expectedOutTicks || item.getId() !== args.expectedProjectItemId) {
        throw new BridgeError("CLIP_CHANGED", "The observed clip no longer matches. Read its current state before editing.");
      }
      const newStart = this.host.tickTime(args.newStartTicks as string);
      const expected = { start: newStart.ticks, end: end.ticks, sourceIn: sourceIn.ticks, sourceOut: sourceOut.ticks };
      if (command === "move_clip") {
        const shift = newStart.subtract(start);
        const newEnd = end.add(shift);
        expected.end = newEnd.ticks;
        for (const other of clips) {
          if (other === clip) continue;
          const [otherStart, otherEnd] = await Promise.all([other.getStartTime(), other.getEndTime()]);
          if (newStart.seconds < otherEnd.seconds && newEnd.seconds > otherStart.seconds) {
            throw new BridgeError("CLIP_OVERLAP", "The destination overlaps another clip on this track.");
          }
        }
        this.transaction(project, () => [clip.createMoveAction(shift)], "MCP: move clip", expiresAt);
      } else if (command === "trim_clip") {
        const newEnd = this.host.tickTime(args.newEndTicks as string);
        if (await clip.getSpeed() !== 1 || await clip.isSpeedReversed()) throw new BridgeError("UNSUPPORTED_CLIP_SPEED", "Inward trim currently supports only 1x forward clips.");
        if (newStart.seconds < start.seconds || newEnd.seconds > end.seconds || newStart.seconds >= newEnd.seconds) {
          throw new BridgeError("INVALID_TRIM", "Trim must retain a nonempty range inside the current clip.");
        }
        const nextIn = sourceIn.add(newStart.subtract(start));
        const nextOut = sourceOut.subtract(end.subtract(newEnd));
        expected.end = newEnd.ticks; expected.sourceIn = nextIn.ticks; expected.sourceOut = nextOut.ticks;
        // Timeline-boundary actions also trim the source boundaries. Combining
        // source and timeline setters would apply the same trim twice in Premiere.
        this.transaction(project, () => [clip.createSetStartAction(newStart), clip.createSetEndAction(newEnd)], "MCP: trim clip", expiresAt);
      } else throw new BridgeError("COMMAND_NOT_ALLOWED", "No mutation handler is registered for this command.");
      const [resultStart, resultEnd, resultIn, resultOut] = await Promise.all([
        clip.getStartTime(), clip.getEndTime(), clip.getInPoint(), clip.getOutPoint()
      ]);
      if (resultStart.ticks !== expected.start || resultEnd.ticks !== expected.end ||
        resultIn.ticks !== expected.sourceIn || resultOut.ticks !== expected.sourceOut) {
        throw new BridgeError("OPERATION_OUTCOME_UNKNOWN", "Premiere applied the operation but its resulting boundaries differ from the request. Inspect the working sequence; do not repeat automatically.");
      }
      return { ...this.ref(project, sequence), locator: { trackType: args.trackType, trackIndex, clipIndex: args.clipIndex },
        timelineStartTicks: resultStart.ticks, timelineEndTicks: resultEnd.ticks,
        sourceInTicks: resultIn.ticks, sourceOutTicks: resultOut.ticks,
        linkedItems: "not-automatically-modified", ripple: false };
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      throw new BridgeError("OPERATION_OUTCOME_UNKNOWN", "Premiere raised an error during a write. Inspect the project; do not retry under a new operationId.");
    }
  }
}

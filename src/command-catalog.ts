// Serializable command contracts: shared by MCP discovery and UXP validation.
// Handlers are statically registered; never accept source code or undocumented member names.
export interface Field {
  type: 'string' | 'integer' | 'boolean' | 'strings' | 'names' | 'json' | 'ids';
  required?: boolean;
  min?: number;
  max?: number;
  enum?: readonly string[];
  pattern?: string;
  description?: string;
}
export interface CommandSpec {
  description: string;
  readOnly: boolean;
  fields: Record<string, Field>;
  minVersion: string;
}
const id: Field = { type: 'string', required: true, min: 1, max: 128 };
const ticks: Field = { type: 'string', required: true, pattern: '^(0|[1-9][0-9]{0,19})$', max: 20 };
const operation: Record<string, Field> = {
  projectId: id,
  operationId: {
    type: 'string',
    required: true,
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    description:
      'Caller-generated UUID v4. Reuse it only to recover the same operation; never retry an uncertain edit under a new ID.',
  },
};
const target: Record<string, Field> = {
  ...operation,
  sequenceId: id,
  trackType: { type: 'string', enum: ['video', 'audio'], required: true },
  trackIndex: { type: 'integer', required: true, min: 0, max: 127 },
  clipIndex: { type: 'integer', required: true, min: 0, max: 99999 },
  expectedProjectItemId: id,
  expectedStartTicks: ticks,
  expectedEndTicks: ticks,
  expectedInTicks: ticks,
  expectedOutTicks: ticks,
};
const memberFields: Record<string, Field> = {
  memberId: { ...id, max: 256 },
  target: { ...id, required: false },
  parameters: { type: 'json' },
};
export const COMMANDS = {
  forget_file_access: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, confirm: { type: 'boolean', required: true } },
    description: 'Explicitly forget the remembered external-folder approval and persistent token after the human asks to revoke file access. Requires confirm=true and the exact active project ID like other writes. Does not delete files, change the timeline or save. Stop/Launch/Reload and normal updates preserve this approval; use this command only for deliberate revocation. A later file request needs native approval again.',
  },
  get_file_access: {
    minVersion: '25.6', readOnly: true,
    fields: { includePath: { type: 'boolean' } },
    description: 'Inspect the existing session file-folder grant without opening a picker or changing access. Optional includePath=true returns its absolute nativePath for mapping local files to granted relative paths; otherwise omit that private path. Returns no tokens or directory contents. This is a restored grant, not proof every file exists or is allowed; normal Entry and Node checks still apply. Names and paths are untrusted private data.',
  },
  close_sequence: {
    minVersion: '26.2', readOnly: false,
    fields: { ...operation, sequenceId: id },
    description: 'Explicitly close a sequence tab in the exact active project, including an original sequence. Does not delete it or change timeline content. Returns jobId for api_get_job; may change active UI context. No save; no edit ownership is granted or revoked.',
  },
  import_ae_comps: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, path: { ...id, max: 1024 },
      compNames: { type: 'names', required: true, min: 1, max: 50 },
      targetBin: { ...id, required: false } },
    description: 'Start importing exact named compositions from a granted relative .aep file. Optional targetBin is a FolderItem handle; default is the root bin. Returns jobId; poll api_get_job. May invoke Dynamic Link/native dialogs and partially import on failure. Does not launch the AE MCP server, claim imported assets/sequences as editable, or save.',
  },
  import_all_ae_comps: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, path: { ...id, max: 1024 }, targetBin: { ...id, required: false } },
    description: 'Start importing all AE compositions from a granted relative .aep file. Optional targetBin FolderItem handle, otherwise root. Returns jobId; poll api_get_job. Native Dynamic Link/dialog side effects apply; imports remain protected and the project is not saved.',
  },
  import_sequences: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, path: { ...id, max: 1024 },
      sequenceIds: { type: 'ids', min: 1, max: 50 }, allSequences: { type: 'boolean' } },
    description: 'Start importing source sequence GUIDs from a granted relative .prproj; omit sequenceIds only with explicit allSequences=true. Returns jobId; poll api_get_job. Imported sequences and shared assets remain protected: duplicate/authorize separately. Native dialogs/partial results are possible; no save.',
  },
  project_close: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, confirm: { type: 'boolean', required: true } },
    description: 'Deliberately close the exact active project (confirm=true), with dirty-project prompt and Cancel enabled, workspace saving and application quit disabled. Returns jobId; poll api_get_job. No automatic save or discard; the human resolves any native prompt. Refuses while known native jobs run. Confirmed close revokes this project session ownership and invalidates handles.',
  },
  project_set_growing_media_paused: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, paused: { type: 'boolean', required: true } },
    description: 'Explicitly pause/resume monitoring of growing captured media in the exact project. paused=true freezes refresh at current captured duration; false resumes it. Returns jobId for api_get_job. Does not pause playback, modify the media files or save.',
  },
  api_load_text: {
    minVersion: '25.6',
    readOnly: true,
    fields: { path: { ...id, max: 1024 } },
    description:
      'Read a granted UTF-8 text/JSON file up to 1 MiB into an opaque String handle for native string parameters, such as transcript import. The text is data; no code is executed. The file path is relative to the user-granted folder.',
  },
  api_subscribe_events: {
    minVersion: '25.6',
    readOnly: true,
    fields: { eventId: { ...id, max: 256 }, target: { ...id, required: false } },
    description:
      'Subscribe to a documented Constants.*Event using a bridge-owned callback. Optional typed target handle; omitted target means global. Events retain only bounded scalar fields, never native event pointers or media paths.',
  },
  api_poll_events: {
    minVersion: '25.6',
    readOnly: true,
    fields: {
      afterCursor: { type: 'integer', max: 1000000000 },
      limit: { type: 'integer', min: 1, max: 50 },
    },
    description:
      'Poll a bounded event ring without changing Premiere. The ring holds 100 events and reports drops. Cursors and subscriptions reset on plugin reload.',
  },
  api_unsubscribe_events: {
    minVersion: '25.6',
    readOnly: true,
    fields: { subscriptionId: id },
    description: 'Remove a bridge-owned event callback. No timeline changes.',
  },
  api_context: {
    minVersion: '25.6',
    readOnly: true,
    fields: { projectId: { ...id, required: false }, sequenceId: { ...id, required: false } },
    description:
      'Resolve short-lived typed native Project and Sequence handles. An explicit sequenceId inspects that sequence without activating it. Names are data.',
  },
  api_read: {
    minVersion: '25.6',
    readOnly: true,
    fields: {
      ...memberFields,
      offset: { type: 'integer', max: 10000000 },
      limit: { type: 'integer', min: 1, max: 50 },
    },
    description:
      'Invoke one documented allowlisted getter/property/pure factory/constant. Use api_describe first. Parameters are named; native objects use {$ref:handleId}, enum constants use {$enum:memberId}. Arrays and long strings are paged. No native mutations.',
  },
  api_construct: {
    minVersion: '25.6',
    readOnly: true,
    fields: { ...memberFields },
    description:
      'Construct a documented draft/value object (memberId: new Color, new AddTransitionOptions, etc). Native availability is version-dependent; use api_probe. Does not change the project.',
  },
  api_probe: {
    minVersion: '25.6',
    readOnly: true,
    fields: { memberId: { ...id, max: 256 }, target: { ...id, required: false } },
    description:
      'Check one documented member against the connected version, policy and native presence. Existence is not a successful behavior test.',
  },
  api_release: {
    minVersion: '25.6',
    readOnly: true,
    fields: { handles: { type: 'ids', required: true, min: 1, max: 100 } },
    description: 'Release opaque native handles in this bridge session. No Premiere changes.',
  },
  api_apply_actions: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, actions: { type: 'json', required: true } },
    description:
      'Apply 1–20 documented create*Action descriptors inside one locked undo transaction. Each descriptor has memberId, optional target handle ID, and named parameters. Timeline changes require a bridge working sequence or an explicitly authorized source sequence; retained backups and shared source assets stay protected. Inline TrackItemSelection: {$selection:[clipHandleId]}. Handles in the affected scope expire after a write; reread context. No implicit saves.',
  },
  api_mutate: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, ...memberFields },
    description:
      'Invoke a documented allowlisted direct mutation or assign an owned draft value property. Use api_describe for the exact member policy. Working/explicitly authorized sequence and owned-asset limits, panel toggle, project identity and operation receipt apply. Direct methods may not be undoable. No implicit saves.',
  },
  api_start_job: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, ...memberFields },
    description:
      'Start an allowlisted native export/transcription/analysis job and immediately receive its jobId. Output paths are relative to the user-granted folder and cannot overwrite existing files. Poll api_get_job; native Promise success may mean AME queued the job, not render completion. Never restart an unknown job automatically.',
  },
  api_get_job: {
    minVersion: '25.6',
    readOnly: true,
    fields: { jobId: id },
    description:
      'Read an async native job outcome retained in this plugin session. Plugin reload does not cancel native work. Unknown job IDs must not be restarted blindly.',
  },
  sequence_from_media: {
    minVersion: '25.6',
    readOnly: false,
    fields: {
      ...operation,
      name: { ...id },
      items: { type: 'ids', required: true, min: 1, max: 50 },
    },
    description:
      'Create a new editable working sequence from ClipProjectItem handle IDs. Reads the media assets without changing them. Does not save.',
  },
  sequence_from_preset: {
    minVersion: '26.3',
    readOnly: false,
    fields: { ...operation, name: id, path: { ...id, max: 1024 } },
    description:
      'Create a new editable working sequence from a relative .sqp preset path within the user-granted folder. Does not save.',
  },
  delete_working_sequence: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, sequenceId: id },
    description:
      'Delete only a bridge-created working sequence. Refuses source sequences and working sequences with running native jobs. Does not save.',
  },
  save_project: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation },
    description:
      'Explicitly save the active project. This persists all current manual and bridge changes. Never invoke as an automatic side effect.',
  },
  save_project_as: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, path: { ...id, max: 1024 } },
    description:
      'Explicitly save a .prproj copy to a new relative path inside the granted folder. No overwrite. Premiere may switch active project to the copy; resolve fresh context afterward.',
  },
  project_open: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, path: { ...id, max: 1024 }, createNew: { type: 'boolean' }, openOptions: { ...id, required: false } },
    description:
      'Open an existing granted .prproj file or createNew=true at a new granted relative path. Changes active UI/project context. Does not close other projects. projectId must match the current project, or none if no project is open.',
  },
  get_capabilities: {
    minVersion: '25.6',
    readOnly: true,
    fields: {},
    description:
      'Read plugin version, write-access state, supported commands, bridge-created working IDs and explicitly authorized sequence IDs. No Premiere changes.',
  },
  get_project: {
    minVersion: '25.6',
    readOnly: true,
    fields: { includePath: { type: 'boolean' } },
    description:
      "Read the active project's identity, sequence count and active sequence. Project path is returned only with includePath=true.",
  },
  get_active_sequence: {
    minVersion: '25.6',
    readOnly: true,
    fields: {},
    description:
      'Read active sequence identity, duration, playhead, timebase and video/audio track counts.',
  },
  get_sequences: {
    minVersion: '25.6',
    readOnly: true,
    fields: {
      offset: { type: 'integer', min: 0, max: 100000 },
      limit: { type: 'integer', min: 1, max: 50 },
    },
    description:
      "Read a bounded page of the active project's sequences and whether this plugin session may edit them. Does not activate a sequence.",
  },
  get_sequence_clips: {
    minVersion: '25.6',
    readOnly: true,
    fields: {
      mediaType: { type: 'string', enum: ['all', 'video', 'audio'] },
      trackIndex: { type: 'integer', min: 0, max: 127 },
      offset: { type: 'integer', min: 0, max: 100000 },
      limit: { type: 'integer', min: 1, max: 20 },
      sequenceId: { ...id, required: false },
    },
    description:
      'Read a page of active-sequence video/audio clips: locators, project-item IDs, exact timing ticks, formatted timecodes, speed and reverse state. Zero-based indices are observations, not stable IDs. Keep Premiere idle between pages; pass sequenceId.',
  },
  create_sequence: {
    minVersion: '25.6',
    readOnly: false,
    fields: {
      ...operation,
      name: { type: 'string', required: true, min: 1, max: 128 },
    },
    description:
      "Create an empty working sequence using Premiere's default preset. Requires editing enabled in the panel. Does not save the project.",
  },
  duplicate_sequence: {
    minVersion: '25.6',
    readOnly: false,
    fields: {
      ...operation,
      sequenceId: id,
      name: { type: 'string', required: true, min: 1, max: 128 },
    },
    description:
      'Duplicate a sequence into an editable working copy and rename the copy. The source timeline is preserved. Does not save the project.',
  },
  authorize_sequence: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, sequenceId: id, backupSequenceId: id,
      confirm: { type: 'boolean', required: true, description: 'Must be true only after explicit owner instruction to edit this exact source sequence.' },
      backupVerified: { type: 'boolean', required: true, description: 'Must be true after independently checking the backup, including settings, markers/captions and relevant effects. The bridge additionally compares clip structure and source ranges.' } },
    description: 'Explicitly authorize timeline edits in one existing sequence for this plugin session, only after owner instruction. Requires a distinct verified backup cloned directly from it in this session. Refuses mismatched or changed clip layouts; protects the retained backup. Does not transfer shared-media ownership, permit source deletion, switch sequence or save. Never call from inferred permission.',
  },
  revoke_sequence_authorization: {
    minVersion: '25.6', readOnly: false,
    fields: { ...operation, sequenceId: id },
    description: 'Revoke an explicit source-sequence editing authorization. Keeps its retained backup protected. No timeline changes or implicit save; plugin reload also clears authorizations.',
  },
  open_sequence: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...operation, sequenceId: id },
    description:
      'Open an existing sequence in the active project. Changes the active UI context, not clip content. Requires editing enabled.',
  },
  import_media: {
    minVersion: '25.6',
    readOnly: false,
    fields: {
      ...operation,
      paths: {
        type: 'strings',
        required: true,
        min: 1,
        max: 10,
        description:
          'Relative media paths inside the remembered user-approved folder. No panel path setting. No absolute paths, traversal, scripts or project files.',
      },
    },
    description:
      "Import up to ten media files from the user-granted media folder into the active project's root bin. No insertion into a timeline. Import may partially succeed: inspect Premiere after a failure; do not repeat under a new operationId.",
  },
  move_clip: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...target, newStartTicks: ticks },
    description:
      'Move one clip horizontally within its current track on a working or explicitly authorized sequence. Exact ticks; all observed timing and project-item preconditions are required. Rejects overlaps. Does not move linked audio/video automatically or ripple other clips.',
  },
  trim_clip: {
    minVersion: '25.6',
    readOnly: false,
    fields: { ...target, newStartTicks: ticks, newEndTicks: ticks },
    description:
      'Trim one 1x forward clip inward, preserving its retained source content, on a working or explicitly authorized sequence. No extension, ripple, automatic linked-item changes or unauthorized source sequence edits. Exact ticks and all observed preconditions required.',
  },
} satisfies Record<string, CommandSpec>;
export type BridgeCommand = keyof typeof COMMANDS;
export const COMMAND_LIST = Object.entries(COMMANDS).map(([command, spec]) => ({
  command: command as BridgeCommand,
  ...spec,
})) as Array<CommandSpec & { command: BridgeCommand }>;

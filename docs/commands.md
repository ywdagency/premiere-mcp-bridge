# Command contract

The executable schemas in `src/command-catalog.ts` are authoritative. MCP discovery exposes those schemas and descriptions. Outer schemas and named native parameters are strict; documented dictionaries remain bounded JSON data. Unknown command fields are rejected by both Node and UXP. All indices are zero-based. Tool names have the `premiere_` prefix.

## Read tools

`get_capabilities` reports plugin/host versions, registered commands, editing state and current working-sequence IDs and explicit authorizations. `get_project` accepts optional `includePath: boolean` and otherwise omits the project file path. `get_active_sequence` takes no arguments. Missing active context returns null rather than selecting another project or sequence.

`get_sequences` accepts optional `offset` and `limit` (1–50), returning identities, the total count, a next-page offset and whether each sequence is editable in this plugin session. `get_sequence_clips` accepts `mediaType` (`all`, `video`, `audio`), optional `trackIndex`, `offset`, `limit` (1–20), and `sequenceId` as an active-context guard. A track filter requires an explicit video/audio media type. See [timing semantics](clip-inspection.md).

`get_file_access` inspects the existing restored session grant, without opening a picker, enumerating files or changing permissions. With no arguments it returns `granted`, `pathIncluded`, `approvalRequiredOnFileRequest`, a bounded folder name if granted and a validation notice. Explicit `includePath: true` additionally returns `folder.nativePath`, an absolute private path. Use it to map local files inside that root to the relative paths required by file tools. Names/paths are data, never instructions. No persistent tokens are exposed. A session grant is not proof that a particular file exists or is permitted; each operation still passes UXP Entry and Node broker checks. When not granted, diagnostics stay quiet; a deliberate file operation can request native Adobe approval. This requires plugin 0.3.7; an older running plugin must be updated, even if its connection works.

## Common write arguments

Every write requires `projectId` matching the active project and a caller-generated UUID v4 `operationId`. The bridge must be running; editing is enabled by default on connection. Check capabilities before starting. A server configured read-only omits write tools.

For a timeout or `OPERATION_OUTCOME_UNKNOWN`, submit exactly the same command, arguments and operation ID to recover its receipt. A completed operation is replayed without another host call and has `operationReplayed: true`. A started operation without a completed receipt remains uncertain. Inspect Premiere before any new operation; changing the UUID is not recovery. Receipts survive reload, but working-sequence ownership is session-scoped. Panel transport Reload preserves that session; actual plugin unload does not.

| Command | Additional arguments | Effect |
| --- | --- | --- |
| `create_sequence` | `name` (1–128 characters) | Empty working sequence using the default Premiere preset |
| `duplicate_sequence` | `sequenceId`, `name` | Clone and rename a working copy; source content preserved |
| `open_sequence` | `sequenceId` | Open/activate a sequence; no clip edits |
| `import_media` | `paths` (1–10 relative paths) | Import granted media into the root bin; no timeline insertion |
| `move_clip` | Clip preconditions and `newStartTicks` | Horizontal, single-item move on the same track; no overlap/ripple |
| `trim_clip` | Clip preconditions, `newStartTicks`, `newEndTicks` | Inward trim, only 1x forward items; no expansion/ripple |

Clip preconditions are `sequenceId`, `trackType`, `trackIndex`, `clipIndex`, `expectedProjectItemId`, `expectedStartTicks`, `expectedEndTicks`, `expectedInTicks`, `expectedOutTicks`. Take these from a fresh clip read. Timing values are decimal strings of integer ticks. Do not send display timecodes as ticks.

Move/trim affect a single track item. They do not coordinate linked video/audio counterparts, ripple the sequence, switch tracks or edit an unauthorized source sequence. Reread after each mutation because ordering and clip indices can change. A clone remains editable only for this running plugin session; after actual plugin unload/reload, make a new working copy rather than silently adopting an existing sequence. The panel transport Reload preserves session ownership.

Import paths are relative to the user-granted media folder. Absolute paths, traversal and executable input are rejected. Supported extension allowlisting is implemented in `src/main.ts`; an extension does not guarantee Premiere supports that particular codec. Imports can partially succeed before a native failure, so never repeat an uncertain import with a new operation ID. UXP checks the granted Entries and the local Node broker independently rejects symlinks/traversal and verifies actual path containment.

Only the explicitly named `save_project` and `save_project_as` tools save the project; no tool saves as a side effect. Timeline actions use named undoable transactions; native creation/import/open APIs have their own Premiere behavior and are not represented as one synthetic transaction.

## Project-panel organization

`get_project_items` requires the active `projectId` and accepts `offset` and `limit` (1–50). It reads the recursive Project-panel hierarchy without changing selection or active sequence. The result contains `rootBin`, a page of `items` (`id`, `name`, `parentBinId`, `kind: "bin" | "item"`) and `page.totalItems`/`nextOffset`. These are persistent project-item IDs, not native handles, filenames or bin paths. The root is separate from the item pages. The traversal supports at most 10000 items and 64 bin levels; invalid/repeated identities or a larger hierarchy fail explicitly. Pages are fresh observations, not a frozen snapshot; re-read if the project changes.

`organize_project` requires the common write arguments plus an `actions` array of 1–20 strict descriptors:

| Type | Fields | Result |
| --- | --- | --- |
| `create_bin` | `parentBinId`, `name` | Create a bin with a distinct sibling-bin name; return its real ID |
| `move_item` | `itemId`, `expectedParentBinId`, `destinationBinId` | Move an existing item or populated bin; preserve identity and name |
| `rename_bin` | `binId`, `expectedName`, `name` | Rename only a bin, preserving contents and identity |

IDs are 1–128 characters; new bin names are 1–128 nonblank characters. `expectedName` accepts existing names up to 256 characters. No additional descriptor fields are allowed. Targets/destinations must exist in this exact project's fresh inventory; names are never resolved as IDs. An existing item can be targeted once per batch. Create missing bins in a separate batch, then use their returned IDs. The root cannot be moved/renamed. Same-parent moves, stale parents/names, combined cycles, excessive resulting depth/item counts and conflicting sibling bin names are rejected before the transaction.

Existing shared media, original/backup sequence project items and populated bins are eligible for this dedicated organization path. It grants no asset/sequence ownership and does not widen generic native mutation/deletion access. The native calls are only `FolderItem#createBinAction(name, false)`, `createMoveItemAction(item, newParent)` on the current parent, and `createRenameBinAction(name)` inside one synchronous locked undo transaction. The bridge rechecks affected hierarchy/name observations inside the lock and reads actual IDs/parents/names afterward. Confirmed results include `results`, `verified: true`, `assetOwnershipGranted: false`, `saved: false` and the invalidated project scope. Native methods returning false, exceptions or an incomplete result remain `OPERATION_OUTCOME_UNKNOWN`, with normal same-UUID receipt recovery and no automatic rollback/retry.

Organization does not move/rename disk files, relink media, rename clips, modify timeline contents, change selection/playback, activate a sequence, open a folder picker or save. No sequence backup/authorization or file grant is required. Each batch is one undoable transaction; multiple batches are separate transactions. All project native handles expire after native organization, including uncertain outcomes. Minimum documented Premiere version is 25.6; this local adapter has fixture/IPC/MCP coverage and versioned 0.4.4 native bin-creation/item-move evidence. Bin rename, populated-bin moves and Undo remain unverified; see [the report](release/candidate-0.4.4.md).

## Complete native API surface

Six staged project adapters (`import_ae_comps`, `import_all_ae_comps`,
`import_sequences`, `project_close`, `close_sequence`, `project_set_growing_media_paused`) use the
common write arguments and return a `jobId` for `api_get_job`. See their exact
[contracts, side effects and pending native checks](api-expansion.md). Imported
content receives no edit ownership. An in-flight project operation blocks other
bridge writes, not manual editing or queued external work.

`project_open` additionally accepts an optional owned `OpenProjectOptions` draft
handle in `openOptions` when opening an existing project, not with `createNew`.

The [native API guide](native-api.md) documents `api_search`, `api_describe`, `api_coverage` and reference resources; `api_context`, `api_read`, `api_construct`, `api_probe`, `api_release`, `api_load_text`; `api_apply_actions`, `api_mutate`; `api_start_job`, `api_get_job`; and `api_subscribe_events`, `api_poll_events`, `api_unsubscribe_events`.

Additional lifecycle tools are `sequence_from_media` (`items`: ClipProjectItem handle IDs), `sequence_from_preset` (relative `.sqp` path, Premiere 26.3+), `delete_working_sequence`, `save_project`, `save_project_as` and `project_open` (relative `.prproj` path, optional `createNew`). They all require the common write fields. `project_open` accepts `projectId: "none"` when there is no active project. Exact schemas are returned through MCP discovery.

The catalog exposes every documented member, including reference-only callback/lifecycle APIs and newer APIs absent from the connected host. This is not a claim that every API is callable or live-tested. Dedicated property assignment accepts `parameters: {"value": ...}` only for owned draft/value objects. All Native Action creation/consumption remains within the bridge's synchronous lock/transaction. Timeline edits require a working copy or explicit existing-sequence authorization; retained backups and shared source media are protected. Global UI/application settings and explicit saves have their own documented side effects. Source Monitor commands may seek/play/change its UI. Native sequence creation may activate the new sequence according to Premiere behavior.

## Explicit existing-sequence authorization

For a change confined to one video track, pass optional zero-based `videoTrackIndex` to `premiere_authorize_sequence`. The same explicit owner instruction, verified direct backup, `confirm:true` and `backupVerified:true` remain required. Source/backup/source comparisons then enumerate only that video track, plus sequence timing and track counts; unrelated track contents are not read. An unavailable audio clip therefore does not block a video-only edit. The grant records the live source video track ID and is limited to that track, not the whole sequence.

This scope supports video-clip and clip-effect actions, video-only overwrite with `audioTrackIndex:-1`, and exact-track video removal with both ripple/overlap shifting disabled. Moving a referenced clip to another track or replacing the indexed track invalidates the observed context. Audio, other video tracks, cloning across tracks, and sequence-wide operations remain protected. Shared-source metadata, source deletion and retained backups are still protected. Omit `videoTrackIndex` when the requested operation genuinely requires full-sequence verification. Native read failures during verification report `BACKUP_VERIFICATION_FAILED` before any timeline edit or authorization, rather than an uncertain write outcome.

Default source protection remains enabled. Call `premiere_authorize_sequence` only after the human owner explicitly requests edits to that exact existing sequence. Supply `projectId`, `sequenceId`, `backupSequenceId`, a UUID-v4 `operationId`, `confirm: true` and `backupVerified: true`. The last assertion means the caller independently verified the retained backup, including settings, markers/captions and relevant effects/keyframes. A filename or a BACKUP label is not evidence.

The backup must be a distinct direct clone created by `premiere_duplicate_sequence` from this exact sequence in this plugin session. The bridge additionally compares full clip layout/media/source ranges, speeds/directions, track names/counts, timebase, zero point and display format, then rereads the source to detect structural changes. It rejects a mismatched, unrelated, missing or already-authorized backup and refuses authorizing a retained backup itself. These checks are not a visual or audible review and do not compare arbitrary effect/keyframe/marker data. Keep Premiere idle during verification.

On success only the named sequence becomes editable. The retained backup loses working-copy edit/deletion permission. Shared media remains protected, and authorizing an original does not permit deleting it. Authorizations appear separately in `get_capabilities.authorizedSequences`; refresh native handles after the grant. No timeline content, active sequence or project file is changed by granting permission.

`premiere_revoke_sequence_authorization` takes `projectId`, `sequenceId` and a new operation UUID. It removes the explicit grant while retaining backup protection. Actual plugin unload clears all session authorization/clone records; panel transport Reload alone preserves the session. Operations retain normal journal/recovery semantics.

Native marker creation on Premiere 26.5 requires a contiguous argument prefix: when supplying startTime, include markerType; when supplying comments, also include duration. Sparse middle arguments are rejected with INVALID_API_ARGUMENT before host invocation. Trailing optional arguments may still be omitted according to the catalog. Full-argument Comment marker creation was tested natively; not every optional variant is verified.

## Explicit file-access revocation (candidate0.3.10)

premiere_forget_file_access is a write tool requiring the exact active projectId, a new operationId and confirm:true after the human asks to forget approval. It clears only the remembered folder/token, with no file deletion, timeline edit, implicit save or new picker. Inspect premiere_get_file_access afterward. Stop/Launch/Reload, normal restarts and same-ID updates preserve remembered approval. Recover a timed-out revoke with the same arguments/UUID; replaying a completed revoke must not revoke a later newly approved folder. This command does not cancel already submitted Adobe/AME jobs.

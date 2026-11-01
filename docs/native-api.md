# Complete Adobe API knowledge and typed control

The existing search/describe tools also provide [official user-guide references](manual-reference.md). Search defaults to the API; choose source=manual or source=all explicitly. Manual IDs use the manual: prefix, return documentation-only text and cannot be passed to native tools. No additional MCP tools are registered.

Version 0.3 includes the complete pinned Premiere DOM reference: 73 types, 570 class members (450 methods, 81 properties, 12 constructors and 27 event entries), plus 137 constants. `data/adobe-api.json` retains signatures, named parameters, return types, minimum versions, descriptions and official links. It was generated from AdobeDocs commit `fe96210fca589eec41310c8f2c7f88c9cc6edf5d`, with Adobe's Apache-2.0 notices retained alongside it. This is the Premiere DOM, not arbitrary UXP JavaScript, OS automation or every feature exposed by Premiere's UI.

Knowledge is separate from execution. `premiere_api_search`, `premiere_api_describe` and `premiere_api_coverage` work without Premiere. The MCP resources `premiere://api/index` and `premiere://api/member/{id}` expose the same reference; URI-encode member IDs. Descriptions report policy, source, version compatibility and live verification separately. `premiere_api_probe` checks native presence in the connected host. A method's presence does not prove its behavior, and a reference page's `Since` label can be wrong. Compatibility corrections preserve the original label and explain the correction.

## Resolve objects and invoke documented members

Call `premiere_api_context` for Project/Sequence handles. Pass a `sequenceId` to inspect a copy without activating it. Each handle describes its actual owner scope. Read a track, then its clips, then a clip's component chain, its components and their parameters. Project bins expose ProjectItem handles; cast through the documented `ClipProjectItem.cast`, `FolderItem.cast` or `ProjectItem.cast` when needed. Native union returns are narrowed only when their documented structure distinguishes the type. An ambiguous union exposes candidate types and permits only identical read contracts common to all candidates; it cannot masquerade as every candidate for writes.

Member IDs are `Class#instanceMethod`, `Class.staticMethod`, `Class@property`, `new Class` and `Constants.Enum.MEMBER`. Only exact catalog IDs are executable. Native parameters are named JSON fields, native objects are `{"$ref":"handle-id"}`, and enum arguments are `{"$enum":"Constants.TrackItemType.CLIP"}`. A target is the opaque handle ID itself. No source code, callback strings, arbitrary property paths or native Action handles are accepted.

For example, after resolving a Sequence handle:

```json
{"memberId":"Sequence#getVideoTrack","target":"<sequence-handle>","parameters":{"trackIndex":0}}
```

Then inspect clips:

```json
{"memberId":"VideoTrack#getTrackItems","target":"<track-handle>","parameters":{"trackItemType":{"$enum":"Constants.TrackItemType.CLIP"},"includeEmptyTrackItems":false}}
```

Arrays return bounded pages with `nextOffset`; long strings return text pages. Handles expire after ten minutes, eviction (2,000 maximum), affected writes, or plugin reload. Reread context after a mutation. They are session references, not persistent timeline IDs. `premiere_api_release` frees unused handles. Adobe's property access flag `W` means readable/writable, not write-only.

## Actions, draft values and direct mutations

Create or duplicate a working sequence before timeline changes, or obtain explicit owner instruction for an existing sequence and use the verified-backup authorization described in [commands](commands.md#explicit-existing-sequence-authorization). `premiere_api_apply_actions` accepts 1–20 descriptors and creates/consumes every native Action inside one synchronous locked undo transaction. It supports clip movement, trimming, disabling and naming, insertion/overwrite/cloning/removal, effects, transitions, parameter values and animation, markers, track names, sequence settings and other documented action factories. This generic surface follows native semantics: overlaps, ripple and linked items depend on the exact operation and arguments. It does not apply the narrower convenience tool's no-overlap/inward-trim rules.

```json
{
  "projectId":"<project-guid>",
  "operationId":"<new-uuid-v4>",
  "actions":[{
    "memberId":"VideoClipTrackItem#createSetDisabledAction",
    "target":"<working-copy-clip-handle>",
    "parameters":{"disabled":true}
  }]
}
```

Use `premiere_api_construct` for documented value constructors; pure factories such as `FrameRate.createWithValue`, `TickTime.createWithTicks`, filter factories and `ComponentParam#createKeyframe` use `premiere_api_read`. `premiere_api_mutate` configures owned draft objects (for example `Keyframe@position`) and invokes allowlisted direct APIs. Applying draft settings or keyframes still requires a native action on an authorized target. Native parameters may clamp or round values; inspect their resulting values. Direct mutations may not be undoable.

An inline selection `{"$selection":["<clip-handle>"]}` is accepted where Adobe expects TrackItemSelection. The bridge supplies the callback and keeps the selection alive through the consuming call. Selection arguments cannot smuggle clips from a protected source sequence into an edit on a copy.

Timeline writes affect bridge-created working sequences and explicitly authorized existing sequences in the current session. Authorization does not make an original a deletable working copy; its retained backup remains protected. A clip's ProjectItem points to shared source media and does not inherit its copy's timeline permission. Media writes require a uniquely identified newly imported asset; assets used by any original sequence (including an explicitly authorized one) or a retained backup and bins containing unowned children cannot be changed/deleted through this generic adapter. For explicit non-destructive Project-panel organization of existing items, use the separate [get_project_items / organize_project contract](commands.md#project-panel-organization); it grants no ownership or deletion rights. Native drafts and source references are distinct. Explicit application preferences, cache operations, Source Monitor/UI controls, ingest/scratch-disk settings, exports and saves have the side effects described by their own members. There is no automatic save.

## Files, exports, transcription and events

The bridge connection itself is automatic and never needs a folder picker. Operations on media, presets, projects, transcript text or output files need a separate native folder grant, requested on demand by the first valid file operation. Paths are relative to that folder; required parent directories must exist. Outputs must not already exist. UXP checks the granted Entries and requests an independent Node path proof for the current request; Node uses real `lstat`/`realpath` checks to reject links/traversal and verifies output parents. This extra check is necessary because Premiere 26.5's UXP `fs.lstat` follows links. Path-based native APIs cannot provide an atomic no-overwrite guarantee against a concurrent external filesystem change; the preflight protects the checked state. Treat the folder as trusted local working storage.

`premiere_api_load_text` reads a UTF-8 file up to 1 MiB into a String handle. Supply it through `$ref` to a native string parameter, for example Transcript.importFromJSON. Native JSON/text remains data and is never evaluated. Transcript changes are asset-scoped, so existing shared media stays protected. Transcription language availability depends on the installed host and language packs.

`premiere_api_start_job` starts native transcription, scene detection, frame export, sequence/XML/AAF/OTIO export or supported EncoderManager jobs without blocking the IPC deadline. Poll `premiere_api_get_job`. A fulfilled Promise returning false is reported as `native_returned_false`; it is never labeled a successful job. Native Promise settlement can mean that AME accepted queued work; it does not universally mean rendering finished. Inspect render events/host state before deleting a job's inputs. Actual plugin unload/reload loses job records but does not cancel native work; an unknown job must not be restarted blindly. Panel transport Reload preserves job records. Only 100 job records are retained per session.

For frame export, `filename` is the relative output file path and `filepath` is its relative parent directory. Both are verified within the folder grant; `filepath: "."` means the granted root itself. Other export presets/outputs follow their documented parameter names. The bridge does not start AME's existing queue implicitly.

`premiere_api_subscribe_events` accepts a documented `Constants.*Event` member ID and an optional Project/Sequence/VideoTrack/AudioTrack/EncoderManager target handle. The bridge owns callback identity and cleanup. `premiere_api_poll_events` reads a 100-entry ring with cursors and a drop counter; `premiere_api_unsubscribe_events` removes the exact callback. Only bounded scalar event fields are retained. Native event objects and media paths are not forwarded. Cursors reset on actual plugin unload/reload, not panel transport Reload.

## Explicit lifecycle tools and limits

The staged [API expansion](api-expansion.md) adds named project-close, AE-import,
sequence-import and growing-media commands with pollable jobs. These additions
remain pending live verification; callback plumbing stays internal.

The original tools remain available. Additional dedicated tools create a sequence from media or a granted `.sqp` preset, delete a bridge working sequence, explicitly save/Save As, and open/create a granted `.prproj`. Save persists the user's manual edits too; agents must never add it as an unrequested side effect. Save As may change the native Project identity. Resolve fresh context afterward. The staged project close/import/growing-media tools use named adapters and pollable jobs. Callback plumbing and unsupported native output-reference overloads retain explicit reasons or declarative alternatives instead of accepting arbitrary code.

Every host write needs a running bridge, exact current project ID and an operation UUID. Editing is enabled by default while connected; Stop blocks it. The client can still omit writes with PREMIERE_MCP_READ_ONLY=1. Durable receipts cover nested action plans too. After a timeout, recover with the identical operation ID and payload, even if its old handles have expired. A new ID is a new operation, never a recovery mechanism. See [live verification](live-verification-26.5.md) for what was actually exercised in Premiere.

Native unknown/variant return values can be encoded as bounded scalar records: for example Keyframe@value returned {"value":42} in the 0.3.8 numeric effect test. Inspect the actual response shape rather than assuming every value is a primitive or every union candidate is simultaneously a valid native type.

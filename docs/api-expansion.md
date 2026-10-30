# API expansion inventory

This is an implementation and verification inventory, not a claim that every
Premiere feature is remotely controllable. Scope: the pinned official Premiere
DOM in `data/adobe-api.json`, 73 types and 707 entries including constants/events.
General UXP/OS APIs and UI-only features are outside this catalog.

Release candidate 0.3.8 retains **42 tools** (39 native/bridge commands and three offline reference tools). Actual 0.3.7 synthetic native workflows are [recorded separately](release/native-check-0.3.7.md); batch preflight failed and the current patch needs native rechecking. This is not a claim that every documented member or variant is behavior-tested. See [current status](release/candidate-0.3.8.md).

## New named adapters

All six require exact project identity and an operation UUID covered by the
durable journal. They return a session `jobId`; poll `premiere_api_get_job` rather
than starting them again. Receipt replay returns the original job ID, even after
plugin unload has lost that job's in-memory outcome. Never restart an unknown job
blindly. There is no implicit save.

| Tool | Adobe member / minimum | Contract |
| --- | --- | --- |
| `premiere_import_ae_comps` | `Project#importAEComps`, 25.6 | Granted relative `.aep`, 1–50 distinct exact `compNames`, optional FolderItem `targetBin` handle; explicit root target by default. |
| `premiere_import_all_ae_comps` | `Project#importAllAEComps`, 25.6 | Granted relative `.aep`, optional FolderItem target; deliberately imports all compositions. |
| `premiere_import_sequences` | `Project#importSequences`, 25.6 | Granted relative `.prproj`, 1–50 distinct source `sequenceIds` (GUIDs), **or** `allSequences: true` without IDs. Same-project import rejected. |
| `premiere_project_close` | `Project#close`, 25.6 | `confirm: true`; dirty prompt and Cancel enabled, workspace saving and application quit disabled. Options are read back before close; the human decides any native save/discard prompt. |
| `premiere_project_set_growing_media_paused` | `Project#pauseGrowing`, 25.6 | Explicit `paused` boolean controls captured-file refresh, not playback or media files. |
| `premiere_close_sequence` | `Project#closeSequence`, 26.2 | Exact `sequenceId`; closes its UI tab without deleting or editing the sequence, including originals. May change active UI context; does not change ownership. |

`premiere_project_open` also accepts an optional `openOptions` handle constructed
with `new OpenProjectOptions` and configured through the documented setters.
Only a bridge-owned draft is accepted, and options cannot be combined with
`createNew`. This preserves the native MRU/conversion/locate-file/warning-dialog
choices supplied by the caller; the bridge does not silently suppress dialogs.

Native AE import may involve Dynamic Link, Adobe processes and dialogs. This
adapter does not launch/call the AE MCP server. Input file authorization does not
sandbox Adobe's own resolution of linked media inside a project. Imports receive
no automatic asset/sequence edit ownership; duplicate or explicitly authorize a
sequence separately. False/rejected imports can leave partial contents.

Project jobs refuse to start while a known native project job is running. While
one runs, other native/legacy bridge writes are blocked; context, job and reference
reads remain available. Manual edits and externally queued work are not blocked.
Confirmed close invalidates project handles and clears project ownership/grants.

Sources: [Project](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project),
[CloseProjectOptions](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/closeprojectoptions).
Adobe's [26.5 changelog](https://developer.adobe.com/premiere-pro/uxp/changelog/)
records an AE-import implicit-bin fix; our adapter passes its target explicitly.
Since labels and native presence still need runtime verification.

## Complete expansion and verification scope

Most areas already use the typed generic adapter. Verify and repair individual
contracts and workflows rather than duplicate each member as a separate tool.

| Area | Existing surface | Next verification scope |
| --- | --- | --- |
| Projects/interchange | Project, project/color settings, import/open/save/lifecycle | New adapters, selected/all imports, native cancellation and lifecycle. |
| Sequence structure | Sequence, SequenceEditor, SequenceSettings, WorkAreaUtils | Insert/overwrite/ripple/remove/clone/subsequence, work area, settings and selection. |
| Video/audio timeline | Video/AudioTrack and ClipTrackItem | Move/trim, speed/reverse, linked A/V, mute, naming and native overlap rules where exposed. |
| Effects/transitions | Chains/factories, components/parameters, transition options | Add/remove/order, value types/clamping, placement and duration. |
| Animation | ComponentParam, Keyframe, PointKeyframe | Key count/times/values, time-varying flags and supported interpolation. |
| Media/bins | ProjectItem, ClipProjectItem, FolderItem, Media, FootageInterpretation | Owned imports, bins, subclips, proxy/relink, interpretation/LUT; protect shared media. |
| Metadata | Metadata, Properties, ProjectItemSelection | Supported keys/types, owned writes and project isolation. |
| Graphics | SequenceEditor MOGRT insertion, component params, MogrtText/MogrtComment | Templates and exposed parameters; MogrtText constructor is recorded absent in 26.5. |
| Captions | CaptionTrack | Exposed inventory/items, mute/name only; full text authoring is not established. |
| Markers | Marker, Markers | Native types, color, notes, timing and removal. |
| Speech | Transcript, TextSegments | Existing reads, language packs, transcription, JSON construction/application. |
| Export/render | Exporter, EncoderManager, ProjectConverter, AAFExportOptions | Frames, sequence/file/item jobs, XML/AAF/OTIO, explicit AME actions; queued vs finished. |
| Events | EventManager and event constants/classes | Callback identity, bounded pages, drops, cleanup and job correlation. |
| Source Monitor | SourceMonitor | Explicit open/close/play/position, preserving visible side-effect semantics. |
| Application | Application, AppPreference, MediaManager, ScratchDiskSettings, Utils | Deliberate settings/cache/queue operations with documented restoration limits. |
| Mask/content inspection | ObjectMaskUtils, C2PAService | Presence/credentials where exposed; no implied mask drawing/tracking endpoint. |
| Values/time | TickTime, FrameRate, Guid, Color, geometry, TimeDisplay | Types/enums, exact ticks, frame boundaries and version differences. |

## Exhaustive per-member matrix

`data/api-coverage-matrix.json` lists every ID, domain, scenario, minimum version,
public route, adapter classification, official source and separate native evidence.
Regenerate after building:

```sh
npm run build
node scripts/api-coverage-matrix.mjs
```

Current classification: **700 routed entries, five internal plumbing entries and
two declarative alternatives**. Routing is static eligibility, not proof of all
native argument/result variants. There are 56 recorded native member checks and
three recorded unavailable members. A member check does not verify all variants.

Internal callbacks/Actions remain bridge-owned: `Project#lockedAccess`,
`Project#executeTransaction`, `CompoundAction#addAction`,
`TrackItemSelection.createEmptySelection` and `TrackItemSelection#addItem`.
Selection removal is represented by supplying the desired `$selection` list
without that item, not editing an escaped native callback object. For the
callback-based `TextSegments.importFromJSON`, use the already adapted
`Transcript.importFromJSON` alternative. Neither alternative claims direct native
execution of the replaced member.

Adobe's exposed API and the installed host remain the ceiling. UI parity, full
caption authoring, mask drawing/tracking, every third-party plugin parameter and
multicam camera switching are not promised without exact members and evidence.
Public eval, QE, shell code and generic menu automation are excluded.

After Premiere verification, audit the separate AE bridge's real catalog and
contracts. Preserve its own units, project identity and composition ownership.
The shared [Node adapter contract](adapter-contract.md) is the composition boundary;
no combined server is introduced. See the [live test plan](live-test-plan.md).

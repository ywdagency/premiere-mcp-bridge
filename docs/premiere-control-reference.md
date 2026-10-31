# Adobe control reference

Checked 2026-10-28 against official Adobe documentation. Use the exact method's documented minimum version before adding a tool. The bridge baseline is Premiere 25.6. A page documenting a 27.0 method does not establish support in an installed 26.x release.

| Area | Official reference | Bridge use / minimum |
| --- | --- | --- |
| Host metadata | [UXP host](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/uxp/host-information/host) | Report connected version |
| Project | [Project](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project/) | Active project, sequence inventory, create/import/open, locks and transactions; 25.6 |
| Sequence | [Sequence](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequence/) | Metadata, track access, clone action; 25.6 |
| Project items | [ProjectItem](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/projectitem/) | Identity, cast root bin, rename clone; 25.6 |
| Video | [VideoTrack](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videotrack/), [VideoClipTrackItem](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videocliptrackitem/) | Clip getters and move/trim actions; 25.6 |
| Audio | [AudioTrack](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/audiotrack/), [AudioClipTrackItem](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/audiocliptrackitem/) | Clip getters and move/trim actions; 25.6 |
| Time | [TickTime](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/ticktime/) | Exact string ticks and native add/subtract; 25.6 |
| Storage | [FileSystemProvider](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/uxp/persistent-file-storage/file-system-provider/) | `getDataFolder()` without interaction; picker/persistent tokens only for media |
| Loading/debugging | [Plugin workflows](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/udt-deep-dive/plugin-workflows/), [Debugging](https://developer.adobe.com/uxp/guides/how-to/debugging/) | Unload/Load for manifest changes; Reload for code |

**Action lifetime matters.** All `create*Action()` calls must execute inside `lockedAccess()` or `executeTransaction()`. `addAction()` must execute inside the transaction callback. Do not create an Action first and only then acquire the lock. See Adobe's [action lock rule](https://github.com/adobe/eslint-plugin-premierepro/blob/main/docs/rules/require-action-lock-scope.md), [action scope escape rule](https://github.com/adobe/eslint-plugin-premierepro/blob/main/docs/rules/no-action-scope-escape-type-checked.md) and [official samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples).

The transaction helper receives an action factory and executes it synchronously inside the locked transaction. Do not pass pre-created native Action objects or use async callbacks. The official sample groups native TickTime timecode conversion under 27.0, while current reference pages say Since 25.6; neither function exists in the tested 26.5 runtime, so the current bridge formats display timecodes in Node instead. `createSequenceWithPresetPath` is 26.3; baseline empty-sequence creation uses `createSequence(name)` and the default preset.

The [UXP changelog](https://developer.adobe.com/premiere-pro/uxp/changelog/) and current DOM reference take precedence over cached types, old CEP/ExtendScript tutorials or community QE workarounds. This bridge does not expose QE or arbitrary scripting.

`ClipProjectItem.cast` and `ProjectItem.cast` are documented from 25.6. The specialized ClipProjectItem wrapper does not expose `ProjectItem#getId`: obtain identity through `ProjectItem.cast(clip).getId()` while retaining the clip wrapper for its own APIs. This distinction was verified in Premiere 26.5 when reading an existing transcript. `Transcript.exportToJSON` is documented from 25.6 and `Transcript.hasTranscript` from 26.3; these are reads, distinct from creating or importing a transcript.

The full pinned DOM catalog is in `data/adobe-api.json`, generated with SDK types 26.5.0. Read [native API behavior](native-api.md) and [actual host checks](live-verification-26.5.md). The 26.5 changelog corrects stale method Since labels for Media/Transcript and adds WorkAreaUtils/MediaManager/C2PAService. The 26.3 changelog establishes track-name actions, subclips, AAF, ObjectMaskUtils, language queries and EncoderManager queue/XMP helpers. Corrected metadata retains the page's original Since label. Current samples/reference pages also contain APIs newer than the installed host; native probing is mandatory when availability is uncertain.

The API-expansion audit on 2026-10-29 checked the current Project and
CloseProjectOptions references. `Project#closeSequence` now states Since 26.2;
the generator applies that conservative minimum while retaining the pinned
page's older label and an explicit correction note. New named import/close/
growing-media contracts are [staged, not live-verified](api-expansion.md).

For file operations, [UXP fs](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/fs/fs) documents scheme-based lstat. In the tested host, bare native paths fail, Entry URLs work, Stats lacks isSymbolicLink, and URL lstat follows a link. Production file metadata uses Entry.getMetadata; the Node file broker performs independent real filesystem checks before native path calls. Do not rely on UXP lstat alone for containment.

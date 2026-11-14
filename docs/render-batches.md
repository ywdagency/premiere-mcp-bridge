# Render batches

Source candidate 0.4.6 adds `premiere_render_batch` and `premiere_get_render_batch`.
These are queue submission and evidence tools. They do not implement Adobe's
Render and Replace command or Restore Unrendered, and do not replace clips.
Native Dynamic Link encoding and alpha output are pending a disposable-host pilot.

Resolve exact `ClipProjectItem` handles with the normal context/bin/getter/cast
tools. Read the existing file grant and reuse it. Provide the exact active project
ID, a new operation UUID, one granted relative `.epr` preset and 1–10 distinct
source items. Each item contains `item` (handle ID) and `outputPath`. Output paths
must be new relative `.mov` files whose basename starts with the operation UUID
and a hyphen. The UUID avoids accidental completion correlation with old jobs.
One asset cannot appear twice, even through different handles: encode it once and
retain each timeline occurrence's independent source ranges for later work.

All paths pass UXP Entry validation and the current-request Node file broker before
any native submission. The coordinator calls documented
`EncoderManager#encodeProjectItem` with full-source `workArea:0`,
`removeUponCompletion:false` and `startQueueImmediately:false`. The returned queueStartRequested:false describes the requested flags, not a
readback of whether an existing queue is running. It neither modifies
source In/Out nor calls `startBatchEncode` or `launchEncoder`. Native queue submission
can still involve AME/Dynamic Link and native dialogs. Filesystem preflight is
not an atomic no-overwrite guarantee against an external filesystem change.

The [Adobe encoder sample](https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/src/encoderManager.ts)
documents the full-source work-area value. The
[EncoderManager reference](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/encodermanager)
documents the encode call and events from 25.6. These are documentation evidence,
not proof that a specific Dynamic Link item/preset works on Premiere 26.5.

## Completion and recovery

The operation receipt and a bounded private `render-batch-<UUID>.json` record are
written before native invocation. Per-item `submission_unknown` means a call may
have run; `native_accepted` means only that its Promise returned true;
`native_rejected` means false; `not_submitted` means the coordinator did not invoke
it. A thrown/rejected native call remains unknown and is never automatically
retried. A known failure stops subsequent submission when observed. Items already
submitted may continue; this is not an atomic batch or a cancellation API.

Read `premiere_get_render_batch` with the same project ID and `batchId` equal to
the original operation UUID. This read does not prompt for a folder. Private
absolute paths are omitted. Transport Stop/Launch/Reload retains live tracking.
Actual plugin unload loses listeners and handles; saved evidence remains, and
nonterminal prior-session submissions report `unknown_after_restart`. Polling
never recreates jobs or grants edit ownership. Recover an uncertain request only
with the identical operation UUID and payload, then inspect its batch record.

Adobe's [official event sample](https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/src/eventManager.ts)
uses `jobID` and `outputFiles`. The coordinator listens before submitting and
records completion only when an output path matches exactly a submitted path.
Unrelated events, Promise success and job-ID timing/order cannot confirm completion.
Queue/progress/error/cancel events carry no demonstrated input/output mapping, so
the coordinator does not guess which batch item they belong to. The public event
tool preserves bounded scalar fields and output counts for inspection without
returning native output paths. A missing event leaves completion unconfirmed.

`render_event_observed` confirms only that native completion was observed for the
expected output. It does not prove a readable/complete file, alpha channel content,
correct dimensions/frame rate/duration, or unchanged source/effect appearance.
`outputSuitability` therefore remains `unverified`; `replacementAllowed` is always
false. `.mov` or a preset name containing “alpha” is not alpha verification.
Storage failure is reported separately and prevents further submissions. Up to
100 saved batches are retained without automatic cleanup; restarting does not
clear this durable limit or cancel Adobe jobs.

Unconfirmed saved render submissions also block bridge project-close and working
sequence deletion in that project, including after actual plugin restart.
Boolean acceptance alone does not release that protection. A matched completion
event or a confirmed native rejection is distinct from an unknown job; there is
no force-delete/resubmit shortcut. Corrupt evidence must be inspected rather than
silently discarded to unlock lifecycle operations.

## Replacement and restoration boundary

The audited official DOM has no callable native Render and Replace/Restore
Unrendered/menu-execution member. The existing overwrite Action inserts a new
ProjectItem and does not promise preservation of the original clip's effects,
speed or animation. The audited `VideoClipTrackItem` surface reads speed/reverse
but exposes no setter for restoring those values. `ComponentParam` exposes
interpolation writes but no complete interpolation/tangent readback for lossless
serialization. A shared-source `changeMediaFilePath` is unsuitable: it can also
change retained backups and unrelated occurrences. No such relink is used here.

A custom replacement requires a separate verified native strategy for preserving
the original clip instance or safely retaining/cloning all of its properties.
Until that strategy passes the [pilot](live-test-plan.md#render-batches-and-alpha-replacement-pending-native-pilot),
automatic overwrite and a claimed “restore” command would be unsafe. A full-source
render must preserve original dimensions, frame rate and transparency, and each
cut/repeated occurrence must retain its own source In/Out, timeline position,
track, disabled state, Motion/Opacity, keys and speed. A fresh verified direct
backup and scoped authorization are still required for an existing timeline.
Concurrent manual changes must stop the operation; an old snapshot never
authorizes reverting the current source.

Adobe's [native Render and Replace help](https://helpx.adobe.com/premiere/desktop/render-and-export/render-sequences-for-playback/render-and-replace-media-in-a-sequence.html)
identifies GoPro CineForm with Alpha for transparency in that native workflow.
That does not certify an arbitrary custom export preset or this coordinator's
output. Native menu operations remain available to the editor independently of
the bridge. No QE, eval, UI automation or project-file rewriting is introduced.

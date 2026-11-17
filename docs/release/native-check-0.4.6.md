# 0.4.6 native pilot, Premiere 26.5

Checked 2026-11-16 America/Vancouver on macOS ARM64, Premiere 26.5.0,
UXP 9.3.0-local, installed/executing Bridge 0.4.6. This is partial native evidence,
not a successful alpha-render/replace/restore certification.

## Activation and isolation

The closed Premiere application was launched once through ordinary macOS
LaunchServices without a document argument, restart or UI automation. The
installed panel restored automatically. Live doctor passed with executing 0.4.6,
all 44 host commands and no open project/active sequence. The existing external
folder approval restored without another picker; matching MCP discovery exposed
47 tools. Installation hashes remain those in the [candidate report](candidate-0.4.6.md).

A new disposable project was deliberately created in a fresh test subfolder of
that existing grant. Only two synthetic alpha MOVs were imported. Native getters
read 24 fps / 96-frame source duration and 30000/1001 fps / 90-frame duration:
1016064000000 and 762810048000 ticks. Source paths/IDs, interpretation and durations
were read back. No owner project or working AEP was opened. No timeline was
created or changed and no project-save command was issued. Premiere's own
automatic recovery file for this disposable project is separate from an agent save.

## Native invocation, failure and recovery

The first full-source batch used the installed Adobe CineForm RGB 12-bit with
alpha preset with match-source metadata. Entry and Node file authorization passed;
the exact UUID/payload was persisted before submission. The bridge returned two
per-item records without claiming completion or starting the queue.

AME was initially closed; its saved queue and watch-folder list were empty. It was
explicitly launched through `EncoderManager#launchEncoder`, and the controlled
synthetic queue was explicitly started through `startBatchEncode`. No owner
queue, watch folder or existing job was cleared, edited or restarted. Both encode
Promises eventually returned true, but no output was produced.

The UTF-16 AME error log identifies both exact unique test output paths as terminal
failures, code **27**: the QuickTime exporter rejected the preset's video codec.
This is native failure evidence despite a true native Promise. Having an installed
preset with an alpha-capable name is demonstrably insufficient. This finding does
not assert that CineForm is unsupported on every host/version.

An identical native `render_batch` request replayed the original receipt with
`operationReplayed:true`, the same batch creation time and exactly two entries.
No new native submission was invoked. The durable batch conservatively reports
accepted/unconfirmed: a job-ID-only error event cannot safely be attributed by
timing or queue order. Exact-path terminal log evidence does not silently rewrite
the journal.

## ProRes experiment and remaining limits

After correlating those terminal failures, a distinct experiment used the
original installed Adobe Apple ProRes 4444 with alpha match-source preset, a new
operation UUID and new output paths. The failed batch and inputs were retained.
No uncertain encode was replayed under another UUID.

At the latest bounded observation, both ProRes submissions remain unconfirmed;
no output file or completion event was observed. A queue-start true result and
queue-resumed/stopped log are not successful encoding. Do not resubmit these
unknown jobs, remove their inputs or close/restart their host as cleanup. Native
queue/dialog status needs reconciliation without UI automation. The owner's
factual AME-status question is separate from update permission.

All five documented EncoderManager class-event subscriptions registered in the
native host; this proves registration, not delivery of every event/payload.
Completion correlation, alpha content/dimensions/fps of a finished output,
Dynamic Link, lossless clip replacement and restoration remain unverified.
There is no synthetic `.aep` fixture and no AE bridge/application operation was
used to manufacture one. No native Restore Unrendered/menu API, shared-media
relink or automatic overwrite was introduced.

The central ledger records scoped observations separately from the historical
member-check list. Search/describe and the per-member matrix expose them as
`latestNativeObservation`; a queue-accepted/failed export or subscription
registration never becomes a full workflow pass. Raw projects, IDs, paths,
receipts and log excerpts remain private.

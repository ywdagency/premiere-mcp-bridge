# Native candidate check — 0.3.6

Checked on 2026-10-29 America/Vancouver after the owner reported restarting
Premiere and opening the installed panel. Direct MCP capabilities confirm the
executing bridge is **0.3.6**, on Premiere **26.5.0**, UXP **9.3.0-local**, macOS
Apple Silicon. All 38 host commands are advertised and the MCP server exposes
41 tools, including three offline reference tools. `npm run doctor` passes the
exact-version and command checks and reads the project and active sequence.
These checks close the previous installed-versus-executing-version mismatch.

## Actual native checks

| Check | Observed result |
| --- | --- |
| Project, active sequence and sequence inventory | Read successfully; existing sequences remain non-editable and working/authorization inventories are empty. |
| Bounded clip pages | First, subsequent, final partial and empty terminal pages return consistent paging metadata and exact integer tick strings. No complete-content audit is claimed. |
| Explicit inactive-sequence context | Resolves the requested protected sequence; active sequence identity remains unchanged around the read. |
| Sequence getters | Audio/caption track counts, frame-size value, end time, settings and timebase return successfully. An empty caption count is not a caption-authoring test. |
| Native time values | All 16 assertions below pass. |
| API presence probes | Documented project lifecycle, XML/OTIO export, time, editor, markers and filter factories are present. Presence is not a behavior test. |

The 16 time assertions cover round-tripping tick strings `0`, `1`, `-1` and
`9007199254740993`; one second as seconds and ticks; 25 fps and its ticks per
frame; 25 frames at 25 fps; floor and nearest-frame alignment of 1.03 seconds;
addition/subtraction of one tick; multiplication by two; division by two; and
equality between equivalent frame-based and tick-based values. The value above
JavaScript's safe-integer range is preserved as an exact string.

## Open native gates

No candidate project/timeline write, import, save, close, export, application
control or visual/audio inspection was performed in this run. The existing
project was read only. The owner-reported restart is separate from an observed
UDT-closed cold-start/prompt/cancellation test. Historical native results retain
their original build versions; the aggregate historical member list has not
been relabeled as a complete 0.3.6 regression run.

The plugin reports an existing media-folder grant, but capabilities do not
expose its path. The owner has been asked for that path before preparing a
unique synthetic subfolder. Import, working/backup sequence changes, durable
write recovery, deliberate synthetic-project Save/Save As/open/close and
interchange exports still require the isolated fixture run. Missing assets or
host features must be recorded as blockers, not passes. No After Effects work,
private-project lifecycle tests, global preference/cache changes or existing
AME queue work are authorized by this check.

Raw MCP responses and assertions are private ignored artifacts. Publish only
this sanitized account. This is **activation and bounded read verification**;
the candidate is not yet certified for a public functional release. See the
[release gates](README.md) and [assisted test plan](../live-test-plan.md).

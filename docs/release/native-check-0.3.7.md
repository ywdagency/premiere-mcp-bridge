# Native workflow check — 0.3.7

Checked on 2026-10-29 America/Vancouver using Premiere 26.5.0 / UXP 9.3.0-local
on macOS Apple Silicon, after the owner reported fully closing Premiere and UDT.
Actual MCP confirms executing 0.3.7 with 39 host commands; candidate SDK stdio
exposes 42 tools. Doctor passes. Existing file access is discovered through MCP;
its private native path is omitted by default and returned only when requested.
No application UI, screenshot or visual/audio inspection was used.

All writes below target a separately created synthetic project and media in a
unique granted subfolder. The owner's original project remains open and receives
no content/save/close operation. Its project/active-sequence identity and sequence
count match the initial observation on return; no stale source snapshot is used
to revert anything. Raw identities, paths, receipts and outputs stay ignored.

| Scenario | Actual result |
| --- | --- |
| Create project | New granted .prproj created and becomes active; original remains open. |
| Four-file batch import | Failed during snapshot path validation with UXP error -2 before native import. Root inventory remained empty; same-ID recovery returns the same recorded failure. This is a release blocker. |
| Individual imports | Synthetic H.264/AAC video, stereo WAV, mono WAV and PNG each import successfully through separate deliberate calls. Imported inventory contains four expected assets. |
| Create from media | A new video/audio sequence is created from the typed imported ClipProjectItem. |
| INPUT/BACKUP/WORK | Distinct direct-clone backup and WORK IDs; independent complete clip-layout/source-range/speed/track and 16-setting comparisons match the baseline before editing. Backups retained. |
| Move/trim | Video and audio move and inward-trim commands return exact requested timeline/source ticks; a final frame-grid-aligned variant preserves A/V alignment. Narrow tools do not automatically synchronize linked items. |
| Recovery/conflict | Successful move replays with the same UUID without re-execution; changed payload under the same UUID rejects. Failed preflight recovery preserves the error. |
| Marker | Sparse middle optional arguments failed with an uncertain action result. Same-ID recovery retained that result; complete synchronous marker inventory was empty. A separate full-argument Comment variant succeeds and reads back its expected name/count. Sparse input needs pre-host rejection. |
| Explicit Save/Save As | Only the synthetic project saved. A unique copy saves successfully and Project.isProject accepts it. |
| Selected sequence import | Saved synthetic source sequence imports into the copy; new sequence remains non-editable and native job confirms success. |
| Sequence tab | Explicit close job succeeds and the WORK tab reopens. |
| Clean project close/open | Saved test copy closes, the original becomes active; synthetic source reopens. No dirty-prompt save/cancel choice was exercised. |
| Ownership after reopen | Prior session ownership is gone; a fresh valid move request rejects with SOURCE_SEQUENCE_PROTECTED. Reopened test closes successfully and original context returns. |
| XML / OTIO | Native jobs succeed and outputs are readable UTF-8 through MCP (13,063 and62,408 characters respectively). Semantic round-trip/interchange fidelity is unreviewed. |

The synthetic INPUT, retained BACKUP, edited WORK, saved project/copy and test
outputs are retained. No media render/frame extraction, existing AME queue work,
AE operation, global preference/cache mutation or implicit owner-project save
was performed. Positive existing-sequence authorization/revocation, dirty
save/cancel prompts, preset/MOGRT/transcription/AME fixtures and every generic API
variant remain unverified here. Historical member checks keep their original
versions; this report is not blanket 707-entry certification.

The batch preflight failure was reproduced by a real IPC regression adapter
that rejects overlapping UXP proof lifecycles. The subsequent 0.3.8 patch serializes
those lifecycles, cancels queued checks when their originating request ends and
rejects sparse marker arguments at both boundaries. Its automated checks are
separate from pending native verification. See [current candidate](candidate-0.3.8.md).

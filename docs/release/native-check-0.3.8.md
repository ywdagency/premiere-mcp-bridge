# Native regression check — 0.3.8

Checked on 2026-10-30 America/Vancouver on Premiere 26.5.0 / UXP 9.3.0-local,
macOS Apple Silicon. The owner reported a full restart with UDT closed; actual
capabilities confirm executing 0.3.8,39 host commands and a passing doctor.
Real SDK stdio exposes 42 tools. Restored file access is read through MCP.
All writes use a separate synthetic project/unique granted fixture folder.
No UI/screenshot, visual/audio review, AE operation or owner-project save is used.

| Scenario | Observed result |
| --- | --- |
| Maximum batch | Ten unique synthetic media files import in one command; inventory has ten owned assets. Native run took14,822 ms. Exact-UUID replay returns the recorded result without duplicates. |
| Deadline recovery | Original 10-second request ended without a response. Identical recovery established a completed preflight failure before native import; inventory was empty. A new deliberate attempt with 30 seconds succeeds. |
| Broker denial/recovery | A symbolic-link media fixture rejects with LINK_NOT_ALLOWED before native import. A subsequent regular input succeeds; inventory increases to eleven. |
| Backup chain | New INPUT/BACKUP/WORK are independently compared across complete clip layouts, source ranges, tracks and 16 settings. INPUT and retained BACKUP are rechecked unchanged after WORK edits. |
| Sparse marker | A middle-argument gap returns INVALID_API_ARGUMENT; marker inventory remains empty. Shared native guard is also fixture-tested; the actual client rejects before forwarding. |
| Valid marker / editing | Full-argument Comment marker creates and reads back; video/audio move on the verified WORK with aligned exact frame ticks. |
| Interchange outputs | XML and OTIO jobs succeed; outputs read as UTF-8 through MCP,13,126 and63,247 characters. Visual/audio and semantic round-trip fidelity remain unreviewed. |
| Historical recovery | A real 0.3.7 sparse-marker failure is recovered through the updated MCP with its original outcome, without a native retry despite stricter validation. Success/conflict/incomplete history variants are fixture-tested. |

The default Node request budget is now 30 seconds, within the unchanged protocol
limit. This and historical-receipt recovery change the Node server only; reviewed
CCX SHA-256 remains
7153825fb11b08423a138b37833ef557f7e7280d7c01293a4a896b5cca0218b1
and still matches the rebuilt plugin payload. Clients must use the matching
updated checkout/reconnect; do not mistake an old cached server for this code.

The [0.3.7 workflow report](native-check-0.3.7.md) separately covers explicit
Save/Save As, project validity, selected project-sequence import, clean close/open,
source protection after ownership reset and original-context restoration.
Those prior results retain their actual build. No every-member 707-entry or
production certification is inferred. Positive explicit source authorization,
dirty-prompt choices and fixture-dependent preset/MOGRT/transcription/AME paths
remain separate gates; the exact test-source authorization is awaiting the owner.

Additional native checks: a discovered bundled Mosaic component appends to WORK, its numeric value reads back as 42, and time-varying keyframes at ticks 0 and 508032000000 read back as 42 and 80. INPUT/BACKUP component-chain counts remain unchanged. The synthetic project is explicitly saved and closed, restoring the owner project context. Visual appearance is unreviewed. The named authorization fixture is saved; reopening requires a fresh current-session direct backup before any grant.

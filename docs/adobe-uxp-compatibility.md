# Compatibility and verification

## Requirements

The manifest minimum is Premiere 25.6 and UXP manifest v5. Node.js 22+ runs the MCP server; the current local test runtime is Node 24.7.0. Adobe UXP Developer Tools is needed for the development-plugin loading workflow. No Adobe Marketplace or signed-package release has been made.

Current official documentation was checked on 2026-10-28. Individual reference pages include future 27.0 methods. The current TickTime reference labels native timecode conversion Since 25.6 while the official sample groups it under 27.0; both functions are absent in the tested 26.5 runtime. Runtime probing reports this discrepancy explicitly. The bridge retains exact string ticks and formats timecodes in Node.

## Verification record

| Scope | Result |
| --- | --- |
| macOS, Premiere 26.5.0, UXP `uxp-9.3.0-local` | Automatic discovery, real project/active-sequence/clip reads verified |
| Live control on the same macOS host | Empty sequence creation, clone/rename, open, single-clip move, inward trim and synthetic WAV import verified |
| Live source comparison | All 204 source clips matched the pre-edit snapshot after operations on a working copy |
| Shared contracts, actual private filesystem IPC, SDK stdio handshake | Automated fixtures pass |
| Write receipts | Same-ID replay, conflicts, incomplete receipts and late-result recovery exercised |
| Source protection | Existing source sequence IDs rejected; only session-created copies may be edited |
| Windows | Discovery path adapter implemented; live Premiere verification pending |
| Adobe 25.6 baseline | API minimums documented; this exact release not tested live |

Live host checks are separate from mock fixtures. Developer tools reporting Loaded, MCP tool discovery or TypeScript compilation alone do not prove native execution. Verification artifacts with private project/clip identities are kept locally in ignored build output and are not distributed.

## Runtime details

Action creation must occur within a project lock. The control adapter executes action factories inside synchronous `lockedAccess` and `executeTransaction` callbacks. The test fixture enforces this native requirement. Timeline start/end trim actions also adjust source In/Out; combining both sets of setters applies a trim twice. The bridge uses the timeline-boundary actions and checks resulting boundaries explicitly.

Use picker-granted Entry objects directly when importing media. Some Premiere storage lookups reconstructed through blob URLs fail; the bridge enumerates granted folder entries instead. Connection uses `getDataFolder()` and never opens a bridge-folder picker.

Premiere's development-plugin runtime can be instantiated lazily: open its panel once after Load. Manifest changes require Unload/Load; Reload is sufficient for JavaScript changes. The optional `npm run plugin:load` shortcut uses the local CLI service bundled with UDT 2.3.0 and was tested on this Mac. This internal developer-service interface can change; ordinary UDT Load remains the fallback. It is not an MCP tool and does not execute arbitrary scripts in Premiere.

UDT 2.3.0 on the development Mac crashed in its Electron Accessibility handlers. Do not automate UDT's native Accessibility tree to recover a plugin. Use its normal controls manually or the scoped developer-service load shortcut. Premiere's own plugin panel is a separate surface.

Version 0.3 broad native-adapter checks are recorded in [the live verification report](live-verification-26.5.md) and `data/live-verification.json`. Catalog/probe results must never be presented as a successful behavioral test.

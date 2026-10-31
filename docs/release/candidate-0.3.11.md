# Preview 0.3.11 verification

This macOS preview combines remembered folder approval, explicit permission forgetting, a daily GitHub update indicator and read-only updateStatus diagnostics. It retains 43 full MCP tools (40 host commands) or 19 inspection-only tools. Plugin identity, folder-token key and receipt format are unchanged. Public installation uses the exact v0.3.11 source tag and matching CCX/checksum, following [INSTALL.md](../../INSTALL.md).

## Package and installed runtime

Adobe UDT 2.3.0 offline packaging produced the seven-file CCX. SHA-256: f9385fba1601ce0db331e5dff133e6a119cda6d2171b4c00264cad524ffbbe2d. Release preparation independently rebuilt the source and validated the checksum, exact archive allowlist, normalized manifest and payload bytes through onboard. All seven installed External-channel files also match the rebuilt source. Filesystem access remains request-only; the only additional origins/schemes are the fixed raw.githubusercontent.com update request and user-clicked HTTPS browser opening.

Earlier owner-authorized UPIA installation enabled this exact payload and preserved 703 durable receipts. Release preparation rechecked those 703 files unchanged. It did not reinstall an already matching plugin, downgrade, erase data, change client configuration or restart/save Premiere.

Fresh doctor/MCP reads confirm executing 0.3.11 on Premiere 26.5.0 / UXP uxp-9.3.0-local, all 40 expected host commands, an open project and active sequence. File access remains granted without prompting. Native updateStatus reports a successful network request with one attempt, the previously published 0.3.8 metadata, no critical threshold and a neutral repository destination. Repeated capability reads preserve request count and attempt time; the next attempt is exactly 24 hours later. Earlier same-payload owner confirmation records the gray label opening the expected GitHub repository.

## Scope and limits

All 178 automated tests pass on the release source. These include the production bundle, actual stdio/IPC, file authorization and operation-recovery fixtures; they do not certify all native APIs.

Bundled-runtime tests cover retained grants across Stop/Launch/restart, explicit forgetting, late asynchronous completion and real Entry/Node broker boundaries. Isolated fixtures/browser cases cover yellow/red routing, numeric comparisons, invalid/offline responses, click/Enter behavior and daily scheduling. A successful request and interval arithmetic are not an elapsed 24-hour native test. Native yellow/red appearance, a pristine new Mac, Windows and every agent client are not certified.

No working-timeline operation, implicit save, export, host restart or new folder approval was used as an installation test. Earlier synthetic edit/import/export checks remain [0.3.8 evidence](native-check-0.3.8.md), not a full 0.3.11 regression. The update indicator opens a reviewed release; it does not automatically install the plugin or update the client's Node server. Older 0.3.8 installations do not contain this indicator and need the documented upgrade route.

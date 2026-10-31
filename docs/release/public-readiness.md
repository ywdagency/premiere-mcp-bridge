Current development: [candidate 0.3.10](candidate-0.3.10.md). This historical report retains its own version and scope.

# Historical candidate readiness audit — 0.3.6

This audit describes the 0.3.6 snapshot, not the subsequent 0.3.7 patch. See [current candidate status](candidate-0.3.8.md).

Reviewed on 2026-10-29 for the private `ywdagency/premiere-uxp-bridge` repository. This audit applies to the release/0.3.6 source snapshot and its generated packages. It supersedes the current-status claims in the [historical 0.3.4 migration audit](migration-0.3.4.md), without changing that evidence.

## Scope and evidence

| Surface | Candidate evidence |
| --- | --- |
| Identity | Package, lockfile, manifest, shared runtime identity and release documents identify 0.3.6. The stable manifest ID remains unchanged. |
| Automated behavior | The original payload preparation passed 142 tests. The CLI onboarding addition passed a fresh clean-clone npm ci and all 150 tests, plus all eight macOS/Ubuntu Node 22/24 CI jobs at b4b61aa. These are source/fixture checks, separate from native Premiere tests. |
| MCP clients | Real SDK stdio discovers 41 full-access or 18 read-only tools. Setup generator/merge tests cover Codex, Claude Desktop, Cursor and VS Code. Dedicated sessions in all client apps are not claimed. |
| Plugin stage | Seven allowlisted plugin files plus a separate SHA-256 inventory; no configs, projects, logs, receipts or Node server are copied into the plugin stage. Version mismatch and accidental overwrite are rejected. The separately packaged CCX contains the same seven inputs with only normalized manifest JSON. |
| npm archive | The original 123-file candidate tarball passed its unpack/production-start checks. The current onboarding/evidence tarball contains 133 files and is unpacked and rescanned: no private paths, native artifacts or Gitleaks findings. Generated SDK stdio configuration was separately exercised with offline reference discovery. This source/runtime archive is a review artifact, not npm publication. Use a source checkout for lockfile-based installation. |
| Disclosure | The original 115-file source snapshot, history, archive and plugin stage passed disclosure checks. The onboarding/evidence source now has 125 files; current source/history/package checks are recorded separately. Raw host evidence remains ignored and excluded from the 133-file archive. Clean scans are bounded evidence, not a guarantee of absence. |
| Dependencies | Fresh lockfile audit reports zero known vulnerabilities at review time. This does not prove native host or dependency code is vulnerability-free. |
| Git | Clean replacement history is retained; new commits use the account's GitHub noreply identity. No predecessor history or private backups are imported. |
| Installed host | The reviewed seven-file 0.3.6 CCX passed archive/hash/permission scans and official installation; the install-time check preserved all 179 transport files at mode 0700. After the owner's restart, direct MCP confirms executing 0.3.6 on Premiere 26.5, all 38 host commands and 41 server tools. Doctor, bounded context/clip reads and 16 exact-time assertions pass. Native write workflows remain pending; see the [candidate report](native-check-0.3.6.md). |

Private audit logs, generated client configs, original Git backups, host results and raw receipts remain in ignored local storage. The original shared dirty checkout is preserved while the candidate is prepared in isolation. Historical tasks keep their original scopes/results; they are not new verification evidence for 0.3.6.

## Security boundary

The manifest still requests only `localFileSystem: request`. There is no network/fullAccess expansion, HTTP bridge listener or arbitrary-code endpoint. Current-request Node file authorization and UXP Entry validation remain independent boundaries. Native project/media resolution can access linked files according to Adobe's own permissions; granting one input file does not sandbox Premiere itself.

Writes require the running bridge, exact project identity and operation UUID. Existing-sequence editing additionally requires explicit owner instruction and a verified retained backup. Source media and original deletion remain protected. New project lifecycle/import operations are deliberate writes and do not grant import ownership. Dirty close prompts can let the human save; the bridge does not silently choose that outcome.

Project/clip names, paths, requested transcripts and bounded original exception text can reach the AI client/provider and private receipts. Import messages are bounded, not redacted. Never publish raw diagnostics, private project/media files, generated configs or audit archives. The owner-designated private vulnerability contact is [dev@ywd.agency](mailto:dev@ywd.agency); delivery has not been independently tested.

## GitHub and publication

The repository stays private. Dependency vulnerability alerts and read-only default workflow permissions are enabled; unused wiki/project surfaces are disabled. GitHub's current private-repository eligibility does not provide all requested secret-scanning, push-protection, private-reporting or main-protection controls. Do not claim those controls are enabled. Recheck eligibility and configure available protections before a public launch.

CI must pass for the exact pushed candidate on macOS/Ubuntu and Node 22/24. Logs must be reviewed before publication. Caches/artifacts can contain more than tracked source; do not upload raw host evidence and review retained caches before public PR access. No tag, release assets, merge, visibility change or npm publication is performed by this preparation.

An installable public release still requires the exact final CCX and native tests in [the release gates](README.md). New sequence authorization and project adapters remain pending in [the live plan](../live-test-plan.md). Successful fixtures do not close those gates.

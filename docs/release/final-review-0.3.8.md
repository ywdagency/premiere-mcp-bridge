# Final private review — 0.3.8

Historical prepublication evidence: private/unpublished status below describes the review at that time. For the public preview, use [INSTALL.md](../../INSTALL.md) and the [release notes](release-notes.md).

Checked 2026-10-30 America/Vancouver on macOS Apple Silicon, Node.js 24.7.0 and Premiere 26.5.0 / UXP 9.3.0-local. This is an unpublished preview. Native core behavior is recorded in the [0.3.8 report](native-check-0.3.8.md); installation/client/disclosure checks below have a different scope.

## Fresh source checkout and connection

The tested code/client snapshot is aef00ea, cloned without local object sharing into a new path containing spaces. It starts without node_modules, build output or client configuration. npm ci uses an empty task-specific dependency cache; the full local suite passes 158 tests. Documentation-only evidence updates follow this snapshot without changing its runtime/client code.

| Check | Actual result |
| --- | --- |
| Reviewed installer | Exact CCX SHA-256 7153825fb11b08423a138b37833ef557f7e7280d7c01293a4a896b5cca0218b1; seven-file allowlist/version and rebuilt payload match. Validation alone leaves client configuration absent. |
| Official install from the fresh clone | Real onboard --install --read-only invokes Adobe UPIA, succeeds and generates only the clone-local Codex config. The existing installed/executing plugin was already the same reviewed 0.3.8 payload. The enabled listing and actual doctor confirm 0.3.8. |
| Existing private state | All 636 pre-existing completed operation files remain byte-identical; transport directory stays 0700. No uninstall, data deletion, hidden restart or owner-project write is used. |
| First connection | Actual SDK stdio starts from the newly generated command/args/env, auto-discovers Premiere and exposes 19 inspection-only tools. Capabilities/project/active-sequence reads succeed; current context is unchanged. Doctor passes with all 39 host commands. |
| Client deadline | Generated Codex tool_timeout_sec is 45, above the bridge's 30-second request budget. A regression test prevents a client deadline below the native request lifetime plus transport allowance. Config mode is 0600. |
| Full surface | Fresh setup exposes 42 tools, including 23 write tools; offline reference access succeeds. No native write is submitted as an installation test. |
| Other client generators | Claude Desktop, Cursor and VS Code JSON uses the fresh clone's actual paths and inspection-only flag. Dedicated sessions in those apps remain unverified; configuration is returned for manual merge. |
| Unpublished public route | Anonymous onboard --release fails explicitly while the matching release is unpublished. It does not install or alter the client config. Positive download behavior against the eventual public assets remains a post-publication check. |

This is a genuine fresh-source/dependency/configuration test plus a same-user reinstallation and connection to the existing Adobe host. It is not a pristine new macOS account or a second Mac with no prior plugin, host preferences or trust decisions. Adobe's first-install dialogs and each client's trust UI are not automated or claimed as verified.

## Future-public material review

The candidate's current files, intended publication history, npm archive and seven-file CCX are scanned separately for credentials and owner paths/project metadata. The reviewed source has 135 tracked files; the npm archive has 143 files. No private-data or Gitleaks finding was detected in either. The isolated unpacked package starts with production dependencies only, outside the source checkout and without inherited module paths, and supplies all 42 tools plus offline reference access. The lockfile audit reports zero known dependency vulnerabilities at review time. The current audit inventory is recorded locally; raw files, host identities and scan output stay ignored. No package includes local client configs, receipts, native projects/media, audit archives or the extracted Adobe packager. Adobe license/copyright notices and the bridge MIT license are retained.

All 27 existing completed Actions runs were downloaded without starting a runner. Their 291 log files (about 10.43 MB) have no detected secrets or owner path/project metadata. There are no uploaded Actions artifacts. The 12 obsolete dependency caches (166,235,132 bytes) were cleared after confirming there were no active runs; cache contents are not mislabeled as inspected. No cache or artifact is left for the visibility change.

Only main and release/0.3.6 exist remotely; there are no remote tags or published releases. Both remote branches and candidate HEAD are included in the publication-history review. Unrelated local-only branches are excluded from publication and preserved, not rewritten or sent. Push only reviewed refs; never publish all local refs with --all or --mirror.

GitHub default workflow permission is read, and workflow approval of pull requests is disabled. Dependency alerts are enabled. Main protection/rulesets return a plan/visibility restriction (403); private vulnerability reporting is unavailable (404). These are not reported as enabled. Recheck and configure available protections when the owner authorizes public visibility; the private security email remains documented.

## Publication remains separate

The repository remains private and the release PR unmerged. No tag, release assets, visibility change, merge, npm publication, automatic updater or Actions run is performed here. CI remains intentionally skipped while usage is restricted; local checks are not described as a new green remote matrix.

Before an announcement, publish the reviewed source/tag and exact CCX/checksum together, update candidate-only wording, configure available public protections, and verify the anonymous documented --release path against the real published assets. Those operations cannot be performed under the current no-publication instruction. Windows, other client app sessions, dirty-close choices, asset-dependent preset/MOGRT/transcription/AME variants and visual/audio/interchange fidelity remain explicit preview limits.

## User/agent instruction follow-up

The later guide-only/package-metadata follow-up retains the tested runtime/client code and all 158 passing local tests. It adds the [user guide](../user-guide.md), [agent operating guide](../agent-workflows.md), [open-source model](../../OPEN_SOURCE.md), [publication handoff](publish-checklist.md) and prepared GitHub release text. All named guide tools match actual 42-tool SDK discovery; this check makes no native host call. The follow-up source has 141 files and its npm archive has 149; local links, credential/private-data scans and exact CCX payload checks pass. Earlier audit counts above retain their original snapshot.

Private prepublication staging can update the existing PR with skip-ci and attach the reviewed CCX/checksum to an unpublished release draft. Draft assets must be downloaded and compared byte-for-byte; this is not proof of anonymous public download. Draft state, target commit, tag absence, private visibility and zero new Actions runs are recorded in the final task evidence. No public release, main merge or visibility change is authorized by these instructions.

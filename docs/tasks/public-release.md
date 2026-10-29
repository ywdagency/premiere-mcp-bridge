# Public release preparation

Historical PR numbers below refer to the predecessor repository, not to PRs in this clean-history replacement.

Registry: TASK-FAD7BB7A3DCC. Scope: local, reviewable release materials for the existing repository. Publication, visibility changes, merging PR #1, native edits/exports/saves and outreach require a separate owner request.

- [x] Inspect the existing implementation, documentation, license and uncommitted work.
- [x] Preserve the shared documentation baseline; owner approved careful additions to those files.
- [x] Finish English-only onboarding and verified client setup.
- [x] Prepare troubleshooting, contribution example, community templates and release notes.
- [x] Prepare YWD positioning, promotion options and a synthetic-data demo script.
- [x] Audit tracked content, reachable Git history and package contents; run repository checks.
- [x] Record remaining release gates and save the verification checkpoint.

Release acceptance and checks are recorded in [the release review](../release/README.md). UI/runtime work belongs to its existing owner and is outside this task.

Owner steering: all current public/release materials are English-only. Publication and final installed-build checks remain in the separate release-gate checklist.

## Commit/push follow-up

Owner authorized committing only release-preparation changes and pushing them to existing PR #1. Panel/runtime/version/evidence/adapter changes remain outside this commit. Repository visibility stays private; no merge or public release is authorized.

The isolated release-only tree passed all 59 tests/build, package inventory, internal links and secret scan; native runtime changes are excluded. Commit/push outcome is recorded in the follow-up task checkpoint.

## Private release hardening follow-up

Registry: TASK-4BA136EC0D07. The owner authorized remaining release safeguards, verification of 0.3.4 and a documentation push while keeping the repository private. The owner subsequently designated `dev@ywd.agency` for private security reports and requested removal of the personal author email before public visibility. This later request authorizes identity-only Git history cleanup; it does not authorize deleting/recreating the repository or publishing it.

Dependency vulnerability alerts were enabled and read back successfully. All 12 historical Actions dependency caches were deleted; immediate read-back returned zero. GitHub rejected secret-scanning enablement as unavailable, retained push protection as disabled, restricted main protection by plan/visibility and returned unavailable for private vulnerability reporting. The email route is documented instead. All 12 historical workflow runs were also deleted after preserving private audit evidence, because their commit metadata retained personal identity. Fresh CI is run against sanitized history. No paid feature or visibility change was made.

An isolated, privately backed-up history cleanup replaces the personal email with the verified account's GitHub noreply address. All eight historical commit file trees, messages and parent relationships were verified identical. GitHub-owned PR refs and cached commits are a separate remaining privacy gate; branch rewriting cannot guarantee their removal. Old clones must not merge or repush the original history.

Fresh MCP capabilities still report 0.3.3. The owner cannot reload the plugin now, so the installed 0.3.4 runtime, cold start and synthetic native import remain unverified. No host restart, project save, timeline write, import, export or UI automation was attempted by this follow-up. The final push/CI/privacy outcome is recorded in the registry and ignored local audit evidence.

## Clean private repository replacement

Registry: TASK-4BA136EC0D07. The owner explicitly selected `ywdagency/premiere-uxp-bridge`, requested a private repository with clean history and noreply identity, and authorized deleting the predecessor only after the replacement is verified. This supersedes the historical no-deletion constraint above. It does not authorize public visibility, release publication, Premiere reload, project saves or native edits.

Preserve the 0.3.4 runtime, manifest identity, pinned dependencies and all tests byte-for-byte. Update repository/setup links and migration evidence; omit private design references. Copy only the reviewed tracked-file allowlist into a separately initialized Git repository, with one parentless initial commit. Exclude predecessor Git metadata, PR refs, logs, generated personal configuration, credentials, media and private artifacts. Verify source equivalence, all 105 tests/build, package contents, secret/path scans, fresh remote clone, noreply identity and CI before deleting the predecessor. Keep private backups and update the current local origin to the verified replacement.

Native 0.3.4 activation/import verification remains deferred by the owner and must not be inferred from successful repository migration or fixture tests.

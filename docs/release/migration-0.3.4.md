# Public readiness audit — 0.3.4

Reviewed on 2026-10-29, America/Vancouver, for `ywdagency/premiere-uxp-bridge`. The owner selected a new private repository with a clean initial commit and GitHub noreply identity. The 0.3.4 implementation, manifest, pinned dependencies and tests are preserved from the verified working checkout. Repository/setup links and migration documentation are updated. This migration does not publish a release or activate a different Premiere runtime.

## Disclosure and migration scope

Only the reviewed 100 tracked source/documentation files are eligible for transfer. A separate Git repository is initialized from their current bytes; the old `.git`, branches, tags, PR refs, workflow history and private local artifacts are excluded. The new initial commit has no parents and uses the verified account's noreply address for both author and committer. The current working directory and installed plugin are retained; no machine-specific configuration is transferred to GitHub.

| Surface | Evidence and acceptance |
| --- | --- |
| Source equivalence | Hash comparison covers every transferred file. Changes are restricted to repository/setup links, private design-reference removal and migration/release documentation. Runtime code, manifest identity, dependencies and tests are byte-identical to the working source. |
| Git identity | One new root commit, one `main` branch, no tags or PR refs. Both author and committer use GitHub noreply. Predecessor commit objects must not resolve through the new repository; old PR #1 must not exist there. Verify these conditions in a fresh remote clone and through GitHub before accepting the replacement. |
| Automated checks | The 0.3.4 source passes all 105 tests/build, including ownership/job-state regressions, filesystem IPC and real MCP stdio with host fixtures. Repeat the checks from the clean snapshot and confirm the new repository's macOS/Ubuntu Node 22/24 CI jobs. These are not native Premiere tests. |
| npm archive | The package allowlist contains 108 files after building. Private configs, ignored artifacts, media/projects, Git metadata and nested audit archives are excluded. Scan the exact migration archive for credentials, owner paths and personal email. No npm publication is authorized. |
| Existing CCX | The previously inspected 0.3.4 CCX contains seven plugin files only. Its payload matches the audited build; the parsed manifest differs only by an omitted trailing newline. No installer, raw host evidence or private archive is copied into the new Git repository. |
| Agent setup | The unchanged actual configuration generators were exercised for Codex, Claude Desktop, Cursor and VS Code. Codex TOML parses and preserves unrelated entries. Real stdio exposes 33 full-access or 18 read-only tools; production-dependency runtime startup was checked separately. Dedicated app sessions for every client are not claimed. |
| GitHub history | Predecessor PRs and workflow metadata are not imported. The replacement gets fresh CI against its own root commit. Inspect its new logs/metadata for credentials, owner paths and personal email before removing the predecessor. |
| Dependencies | The lockfile is preserved. The preceding audit reported zero known vulnerabilities; repeat the time-specific dependency audit for the clean snapshot. Enable dependency alerts on the replacement and confirm read-back. |
| Runtime | Installed 0.3.4 is recorded, but the latest MCP read reports running 0.3.3. The owner deferred plugin reload. Native 0.3.4 activation/import verification, cold startup and the completed native file-permission flow remain open. |

The predecessor retained personal author email through merged-PR references even after branch-history rewriting. That is why the owner chose a separate repository, rather than merely renaming it or copying its Git metadata. Original history, audit logs, scan JSON, operation receipts, generated configs and backup bundles stay private in ignored local artifacts. Historical task notes refer to predecessor PR numbers; they do not create PRs in the replacement repository. Nonessential private Figma URLs are removed from transferred task documents.

Delete the predecessor remote only after the replacement passes source-equivalence, clean-history, package/security and CI checks. Preserve the private local backup and the current working files. Deleting a repository is not a claim that GitHub has immediately erased every provider backup; this audit makes no such promise. See [GitHub repository deletion](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository). No support request or external message is sent by this migration.

## Repository safeguards

The replacement must remain private, with no published release or tag. Configure the workflow token for read-only access without PR-review approval, and enable dependency vulnerability alerts. Keep wiki/project surfaces disabled when unused. Current private-repository eligibility can restrict secret scanning, push protection, private vulnerability reporting and main-branch protection; record actual responses and do not claim unavailable controls are enabled. No paid upgrade or public visibility is authorized.

The owner-designated private security contact is [dev@ywd.agency](mailto:dev@ywd.agency). Mail delivery was not independently tested. If GitHub's private reporting form is unavailable, use this contact. Recheck protection eligibility before any later public launch; the [security guide](../../SECURITY.md) describes data handling and reporting.

## Private working data and release limits

Public bridge source does not make host/tool outputs public-safe. Project/sequence/clip names, requested paths/transcripts and original import exception messages can reach the selected MCP client/provider, its logs and durable operation receipts. Import messages are bounded, not redacted. Public bug reports require synthetic reproduction data and reviewed diagnostics.

Fresh CI may create npm dependency caches. Review or clear those caches before future public PR access, following [GitHub's cache security guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching). Do not transfer prior workflow caches, logs, secrets or uploaded artifacts.

An installable release still needs actual running 0.3.4 confirmation, final-installer checks with UDT closed, cold startup, native folder approval/cancellation and safe synthetic import verification. Keep per-client and host-version claims tied to their real evidence. See [client setup](../clients.md), [native evidence](../live-verification-26.5.md) and [release gates](README.md).

Public visibility, release publication and promotion each require a later explicit owner instruction. The repository migration alone does not authorize them.

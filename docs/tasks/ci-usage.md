# Reduce GitHub Actions usage

Registry: TASK-0963B1E3105D. The owner requests removal of duplicate CI and reduced minute usage, with local tests only and no new GitHub runs during this change.

Routine PR updates use one Ubuntu matrix on Node.js 22/24. Only main accepts push-triggered checks; feature-branch pushes no longer repeat the PR matrix. Explicit manual full compatibility adds macOS. Superseded runs are cancelled, Node setup is bounded, pinned actions and the full test/staging/package commands remain intact. No path filters are added that could leave required checks pending for documentation-only PRs.

Validate workflow syntax and event/matrix behavior locally, run the full local suite plus release staging/package review, and record results here. Keep changes local until the owner permits sending them to GitHub. Do not modify billing, public visibility, Premiere or another chat's work.

Local verification, 2026-10-30 America/Vancouver: actionlint 1.7.12 reports no workflow syntax/expression errors. Trigger/matrix review confirms no feature-branch push run, two routine Ubuntu jobs and four jobs only for an explicit full compatibility dispatch. All 157 tests pass. The unchanged staging command succeeds in a fresh isolated mirror with seven allowlisted plugin files, preserving the existing reviewed stage. npm pack dry-run contains 141 files and no artifacts/client configuration entries. git diff --check passes. No workflow was dispatched, rerun or exercised on GitHub; no push was made. GitHub still uses the previous remote configuration until these local changes are sent.

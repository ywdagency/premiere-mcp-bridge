# Prepare release candidate 0.3.6

Registry: TASK-9A5666B87861. Owner requested repository release preparation after the readiness review. Keep the repository private and prepare a reviewable candidate branch. Do not merge, publish a tag/release, install/reload Premiere or execute native mutations as part of this work. Preserve other chats' working files and task ownership.

- [x] Freeze current reviewed source in an isolated checkout and retain the original worktree.
- [x] Assign 0.3.6 separately from installed 0.3.5 and align English documentation.
- [x] Add version/staging regression checks and run fresh automated verification.
- [x] Inspect and scan exact plugin/source packages and candidate Git history.
- [x] Configure four CI jobs for the candidate, including release staging. Push/check results are recorded in the registry checkpoint and the candidate PR checks.
- [ ] Verify the final installed candidate in the separate assisted native session.

Native verification is an external release gate, not acceptance of repository preparation. See [release review](../release/README.md) and [audit](../release/public-readiness.md). Historical checks remain labeled by their actual versions. No successful automated check authorizes native editing or publication.

# Protected-item ownership and rejected-job cleanup

Scope: fix the two confirmed findings in PR #1 and push only their implementation and regression tests. Preserve unrelated working changes. Keep the repository private and the PR unmerged. Native Premiere edits, exports and saves are outside this task.

- [x] Require ownership of the supplied item for folder remove/move actions.
- [x] Preserve legitimate owned-item operations and protection of unowned bin children.
- [x] Do not retain a job when its final project/editing/deadline preflight rejects.
- [x] Demonstrate regression failures on the old code and success on the fix.
Delivery requires an isolated commit pushed to existing PR #1 with successful CI and private/unmerged state verified. The registry checkpoint records the delivery outcome.

Tests use synthetic host fixtures; their results are not live Premiere verification.

Verification before commit: the new suite reproduces eight failing scenarios on the old runtime; all 74 tests/build pass with the scoped fix. Native Premiere was not invoked.

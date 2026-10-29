# Preserve batch import failure diagnostics

Task: TASK-FB847FCD78BE

Preserve preparation, path-validation, native-import and result-registration failures through the dispatcher, UXP operation receipt, Node IPC and MCP response. Include bounded original exception type/code/message and whether the native import call started. Identical operation recovery must return the recorded result without executing again, including receipts predating diagnostics.

Keep file grants, Node authorization, source protection and durable claim-before-write behavior. Preserve existing uncommitted work. Do not replay the incident batch under a new ID, modify timelines, save, restart Premiere or install a plugin. Fixture results and current live MCP reads must be reported separately; the historical primary cause remains unknown without its discarded exception.

Implemented in `src/import-diagnostics.ts` with propagation through API snapshot/control/registration, UXP receipts, Node IPC and MCP. Errors carry phase/step, bounded original type/code/message and a native-import-start flag. Existing guard codes and legacy receipts remain intact. Media-path errors during registration now surface; unsupported non-clip casts remain excluded from ownership.

Validation: `npm test` passed all 105 tests, including 17 new import-diagnostics tests/subtests. Coverage includes a successful ten-file batch, injected failures before/during/after import, native method lookup, receipt-before-native assertion, bounded/malformed diagnostics, native false, legacy/incomplete receipts, same-ID recovery after bridge recreation, ID conflicts and real MCP stdio error responses. `git diff --check` passed. Existing file-broker/source-protection tests passed unchanged. The pre-existing dirty worktree was preserved; this task was not committed or released.

Separate live evidence: installed 0.3.3 / Premiere 26.5.0 / UXP 9.3.0-local responded to MCP capabilities, project/context/root inventory and ProjectItem ID reads. No live write or plugin reload/install was performed; the new diagnostics are not live-verified. See `docs/live-verification-26.5.md` and `data/live-verification.json`. The historical primary cause remains unknown because its exception was discarded; neither PNG/batch incompatibility nor a particular preparation/registration step was established.

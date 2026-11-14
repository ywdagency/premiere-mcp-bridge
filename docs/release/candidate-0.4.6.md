# 0.4.6 render-batch source candidate

This is a local development candidate, not an installed/published release or a
native alpha-render/replace/restore certification. The installed bridge and client
configuration are outside these source changes. No Premiere/AE project, timeline,
selection, application or render queue was changed during candidate preparation.

The candidate exposes durable full-source render-batch submission and status,
exact-output completion event correlation, official class-event subscriptions and
the official encoder scalar payload fields. It retains the 0.4.5 semantic backup
comparison correction, which ignores unstable enumeration indices but preserves
track/source/timing/speed checks. File permissions, broker validation, retained
backup protection and operation UUID recovery remain in force. There are 47 MCP
tools, 21 available in inspection-only mode.

The official DOM was refreshed to AdobeDocs commit
`ffa53e0dab56c421ef2ac665b66ed370e3a1d675`: 73 types, 707 entries, 700 routed entries,
five internal callbacks and two declarative alternatives. This refresh changed
provenance only, not member signatures. There are still 56 historical native
member checks and three recorded unavailable members; none is a new candidate
native check. The event adapter previously advertised 27 class events but rejected
their IDs. Those exact class-event IDs now have explicit instance/global subscription paths.

Local npm test passes 259 tests with no skips. Packaging dry-run lists 159 files
and excludes private configuration, caches, media and task artifacts. These are
local fixture/package checks, not native-host checks.

Automated checks cover preflight file denial, exact output matching, completion
before Promise settlement, false/rejected/thrown native submission, partial
submission, durable storage failure/corruption, context changes, unknown work after
plugin restart, transport restart and same-UUID replay without re-execution. MCP
and UXP validate the new schemas separately. Fixture completion events are synthetic;
they do not establish real encoder event delivery, file readability or transparency.

Automatic replacement remains disabled. Lossless restoration of arbitrary speed,
effects and animation has no verified native strategy in this candidate. The
[workflow guide](../render-batches.md) records the exact API limits and the
[live pilot](../live-test-plan.md#render-batches-and-alpha-replacement-pending-native-pilot)
defines the remaining evidence. Native testing requires a deliberate separate
project and a suitable time when it does not conflict with the editor's work.
No installer was created, installed or published, and no remote reference was pushed.

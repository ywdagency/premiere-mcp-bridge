# 0.4.6 render-batch source candidate

This is an unpublished local development candidate, not a native
alpha-render/replace/restore certification. The exact local installer and installed
payload are verified as described below. No Premiere/AE project, timeline,
selection or render queue was changed during preparation or installation.

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

The 2026-11-14 full local npm test passed 259 tests with no skips on the reviewed
runtime source commit `eedad5f`. On 2026-11-16, 14 focused render/event/matrix checks
also passed without source changes. Packaging dry-run lists 159 files
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
No remote reference or installer was published.

## Local installation, 2026-11-16 America/Vancouver

Fresh read-only process/log checks found no Premiere, AME, AE or Adobe renderer
process, a terminal successful latest AME encoding entry/result code 0 and an
empty persisted AME batch. These facts established that the already-authorized
update would not interrupt an active render. They do not certify the picture,
sound or completeness of every prior export. No queue file or application was
changed to establish that condition.

The installed Adobe UDT packager produced the eight-file CCX. Onboarding verified
its exact allowlist, manifest, checksum and source-matched payload before Adobe
UPIA accepted the same-ID 0.4.6 update. Every installed file matches the reviewed
source (manifest compared structurally). CCX SHA-256:
`c1e20887f22f2b8bafd1d0228eaea17e0e9c19b9df8e3fb120897f73e2b938d0`.
Installed runtime SHA-256:
`619401d2fca53ea31d650067a96c9974e7c6f896a68179dc679f8620ba752079`.

Private backups retained the prior installed payload, plugin-owned storage and
client configuration. All 1920 pre-existing plugin-storage files remained byte
identical after the update. The actual project's configured server path now
points to the matching checkout; its environment, timeouts, access mode and
unrelated configuration were preserved. No access reset or new grant occurred.
Saved token bytes being preserved is separate from native grant readback.

The first live doctor returned `PLUGIN_NOT_LOADED` while Premiere was closed.
A subsequent ordinary LaunchServices launch, without a document argument or UI
automation, restored the installed panel automatically. Live doctor then passed:
executing 0.4.6, all 44 host commands, no open owner project and retained folder
approval without a picker. The [partial disposable native
pilot](native-check-0.4.6.md) records actual submissions and CineForm terminal
failures; successful output, ProRes completion and alpha remain unverified.
Reconnect the client's MCP process for refreshed schemas. Dynamic Link additionally
needs a synthetic `.aep` fixture; raster-source encoding alone cannot certify it.

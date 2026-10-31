# Changelog

## Unreleased

- Add daily GitHub updates.json checks and a plain clickable version: gray opens the repository, yellow opens a newer compatible release, red opens an explicitly critical update. No automatic install or telemetry.
- Rename the repository to premiere-mcp-bridge and update active installation, package and release URLs.

## 0.3.8 — public preview

Serialize request-bound UXP file proof lifecycles after an actual batch-import preflight failure. Release the queue on error/expiry/context end and prevent queued checks from outliving the request. Reject sparse marker argument prefixes before native calls at both boundaries. Preserve exact UUID recovery, file permissions and all 42 tools. The native ten-file batch and denied-file recovery pass on Premiere 26.5; full-argument markers, effect animation and explicit source authorization/revocation are verified on synthetic fixtures. Keep catalog coverage distinct from native coverage. The generated Codex client timeout is 45 seconds, above the bridge request deadline. Routine CI now avoids duplicate feature-branch pushes and makes macOS an explicit manual compatibility check. See the versioned release reports for current limits.

## 0.3.7 — release candidate, unpublished

Add read-only file-access diagnostics so agents can discover an existing restored folder grant. Omit the private absolute path unless explicitly requested; never expose saved tokens, enumerate files, open a picker or change permission. Preserve automatic connection, the compact lifecycle-only panel and per-file Entry/Node validation. This patch requires an updated plugin; earlier 0.3.6 activation/read evidence is separate from its pending native verification.

## 0.3.6 — release candidate, unpublished

Add six explicit, journaled project import/lifecycle adapters and typed project-open options. Imports do not grant edit ownership. Pollable jobs block competing bridge writes, retain native close prompts and distinguish false or uncertain outcomes. Add the complete per-member API coverage matrix and an assisted live verification plan. Align English release documentation and build/package version checks. These contracts pass local tests. The candidate was installed and its 0.3.6 runtime activated; doctor and bounded read/time checks pass. Disposable native write verification remains pending.

## 0.3.5 — development candidate

Add explicit, session-scoped authorization of an existing sequence with a verified direct-clone backup and revocation. Compare structural state and detect source changes before granting permission. Keep the backup protected, original deletion blocked and shared media protected even when its original timeline is authorized. No implicit save or context switch. Fixture checks are separate from pending live installation/verification.

## 0.3.4 — development candidate

Preserve import failures across preparation, file validation, native execution and result registration. Return bounded original exception type/code/message and whether native import started through durable receipts and MCP, including same-operation recovery. Historical receipts remain unchanged. Local tests pass. The later 0.3.5 runtime was activated successfully; a synthetic native import still awaits separate verification.

## Unreleased — release preparation

Prepare English-only public onboarding, source/client installation guidance, troubleshooting, data-handling details, contributor examples and GitHub issue/PR templates. Add local release notes/checklist, product/demo drafts and an allowlisted plugin staging helper. These materials do not constitute a public release or final installed-build verification.

## 0.3.2 — development

Use two equal horizontal controls from the approved Figma design. Add a compact state box for starting, waiting, running, stopped, reloading and concise errors, with the plugin version sourced from the shared build identity. Running reports plugin transport readiness rather than agent-process liveness. Preserve default-on editing and existing lifecycle behavior.

## 0.3.1 — development

Enable editing by default while the bridge runs, per the owner's selection. Replace the access controls with Stop / Launch and Reload. Reload reconnects the plugin transport while retaining session ownership, native handles, jobs and durable receipts; it does not restart the external MCP server or JavaScript runtime. Request native folder approval only when a valid file request needs access, rejecting that request before file I/O to avoid picker timeouts. Preserve source protections, UUID/project guards and no implicit saving. Keep logs out of the normal panel.

## 0.3.0 — development

Reduce the panel to one connection control, explicit editing access and the separate media-folder picker. Remove persistent status text and explanations; show concise connection/folder errors only on failure. Preserve the entire MCP API, write gates and source protection. Disconnect revokes editing and the folder grant; reconnect never restores editing. Reduce the panel's minimum height to 200px and update portable setup guidance.

Add the complete pinned official Adobe DOM catalog (73 types,570 class members,137 constants), offline MCP search/describe/coverage resources and a typed, catalog-allowlisted native object adapter. Add scoped action batches, owned drafts, effects/keyframes/markers/transitions, async native jobs, event subscriptions and explicit project/sequence lifecycle commands. Preserve convenience tools, source-copy boundaries, editing gates, receipts and automatic bridge discovery. Add current-request Node file authorization to verify grants independently of UXP's link-following lstat behavior, and verify native frame export plus synthetic-path guards. Separate catalog coverage, native availability and live-tested behavior. Upgrade SDK declarations to26.5.0 and retain Adobe's Apache notices.


## 0.2.0 — development

Replaced the autonomous edit-plan product with Premiere MCP Bridge. Added an extensible command catalog, strict validation, project/sequence/clip reads, basic working-sequence control, durable operation receipts, automatic plugin-storage discovery and portable MCP client configuration. Removed the analyzer, cut/edit-plan schemas, examples and execution UI. Added contributor, client, API and security documentation.

The development installation ID remains stable for existing UDT registrations. Manifest changes require Unload/Load to refresh native menu labels.

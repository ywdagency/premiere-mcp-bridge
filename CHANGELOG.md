# Changelog

## 0.4.4 — public preview

Retain all 0.4.3 selected-video-track authorization and verification checks. Add `get_project_items` and `organize_project` for explicit Project-panel sorting of existing shared media, sequence items and populated bins. Create/rename bins and move existing items by exact IDs in bounded undoable batches, with stale-parent/name, root, cycle, name-conflict and readback checks. Preserve disk files, timeline content, media names, selection, source edit/deletion protections and no implicit saving. Add strict Node/UXP contracts and durable IPC/MCP regression coverage. The reviewed same-ID eight-file candidate is installed and running on Premiere 26.5; native creation and existing-item moves are verified. Bin rename, populated-bin moves and Undo remain pending; see the 0.4.4 candidate report. Publication uses the reviewed matching source tag, installer and checksum.

## 0.4.2 — public preview

Give Stop/Launch, Reload, Files and the version link explicit hover, pressed and keyboard-focus feedback. Keep a short click pulse visible even for fast actions. Show Reloading/Starting and Choosing labels during work, disable repeated activation while busy, and show browser-opening failure on the version link. Preserve the panel geometry, remembered folder approval and existing permissions.

## 0.4.1 — development candidate

Move the folder button into the lower row before the Running status block and restore equal full-width Stop/Reload controls. Add a visible Files label, hover color and an in-panel tooltip on hover/keyboard focus with file-access state, approved folder name and purpose. Escape dismisses the tooltip; folder names remain plain bounded text. Keep the0.4.0 grant/picker protections and unchanged permissions.

## 0.4.0 — development candidate

Add the approved compact folder button: red without usable access, green with a remembered folder, and a status/name tooltip. A human can explicitly select or replace a folder without an agent file request. Cancellation, picker/token failure and stale completions preserve the previous approval; Stop/restart/update persistence stays intact. Block a new selection during active host work and new file requests while replacing a grant. Folder errors stay in the folder tooltip, leaving transport status accurate. Report button availability to agents without inferring it for older runtimes. Retain existing per-file Entry/Node checks and manifest permissions. Package the exact local Figma SVG as the eighth allowlisted asset.

## 0.3.12 — experimental Windows preview

Add Windows UPIA onboarding, native node.exe client configuration, case-insensitive environment discovery and guarded Windows relative paths. Validate CCX archives portably in bounded Node memory without a system unzip command. Retain per-file authorization, remembered folder tokens, plugin ID and manifest permissions. Include the already published official Adobe manual search through existing reference tools. Add exact-version Windows installation instructions and a sanitized volunteer test-report template.

Windows behavior is covered by platform fixtures on macOS, not a Windows installation or Premiere session. This release does not claim a new native 0.3.12 Mac regression either; earlier native evidence remains versioned. Start read-only; report actual host results separately.

## 0.3.11 — public preview

Preserve approved external-folder tokens across Stop/Launch, plugin/Premiere restarts and normal same-ID upgrades. Restore without prompting; retain tokens across temporary restoration failures. Add explicit journaled file-access revocation without panel settings; stale picker/restoration completions cannot silently regrant permission. Keep request-only filesystem access and per-file Entry/Node checks. Correct obsolete panel-folder guidance. The combined installer payload, executing version, restored grant and native GitHub update request are verified on macOS Premiere 26.5; yellow/red routing remains fixture/browser evidence.

Add daily GitHub updates.json checks and a plain clickable version: gray opens the repository, yellow opens a newer compatible release, red opens an explicitly critical update. No automatic install or telemetry. Rename the repository to premiere-mcp-bridge and update active installation, package and release URLs. Add read-only updateStatus diagnostics to capabilities, refresh agent-led onboarding and remove superseded internal documentation.

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

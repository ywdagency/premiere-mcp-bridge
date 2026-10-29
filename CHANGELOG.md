# Changelog

## 0.3.4 — development candidate

Preserve import failures across preparation, file validation, native execution and result registration. Return bounded original exception type/code/message and whether native import started through durable receipts and MCP, including same-operation recovery. Historical receipts remain unchanged. Local tests pass; installation and live import verification are pending owner authorization.

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

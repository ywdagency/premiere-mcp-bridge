# First-run instructions for an AI agent

Read [INSTALL.md](../INSTALL.md), the root AGENTS.md and [installation guide](installation.md). This repository
connects only to Adobe Premiere; no other Adobe bridge is part of installation.

Identify the checkout version from package.json and use the matching reviewed
source/tag and CCX. Run npm ci, then the onboarding validator. Use --release only
when that exact version is published, as for v0.3.8. Future unpublished
candidates need a reviewed local artifact and checksum. Do not invent a tag, download location or
successful installation. Ask the user for the missing reviewed artifact if needed.

The first check omits --install. Explain the concrete version/checksum result,
then invoke --install when the user's install request authorizes it. Adobe can
require a confirmation dialog. Do not add sudo, uninstall/delete plugin storage,
disable protections or restart Premiere as an implicit workaround.

Codex uses ignored project .codex/config.toml with absolute local paths. Other
client JSON must be merged in the documented location while preserving unrelated
servers. Inform the user of project trust and MCP reconnect needs; do not invent
a desktop Restart button. The AI client's own authentication is independent.

Enable Premiere Developer Mode, then open the installed panel. Reconnect the client from the trusted clone; generated Codex setup uses a 45-second tool timeout above the 30-second native request deadline. After the panel is open, run doctor. Treat runtime mismatch, missing
commands or connection failure as unfinished setup. Request the owner's normal
Premiere restart only if activation needs it; preserve manual work and session
receipts. Once reads pass, the user may legitimately have no active project.

For the first agent call, read capabilities and project identity, then the active
sequence if relevant. Report the actual executing version. Never create/import/
edit/export/save as a connection probe. Follow documented backup/ownership and
operation-UUID recovery rules for later editing tasks. A doctor pass is a
connection/version result, not certification of every API member.

For an authorized file task, call premiere_get_file_access first. Use
includePath=true only when the native root is needed to prepare/map local files.
Do not ask the owner to remember a hidden saved folder or restore a removed panel
setting. If granted:true, reuse the existing approval without another selection.
For a default destination, derive the saved .prproj parent from get_project with
includePath:true only when needed and use it only within the approved root.
The project path alone is not permission. The diagnostic does not open a picker or grant access. If no grant
exists, explain the native approval required by the deliberate file request;
connection/setup alone must not trigger it. Never bypass the normal path checks.

For actual editing tasks, follow the [agent operating guide](agent-workflows.md): current identity and paging, verified INPUT/BACKUP/WORK, exact ticks and write UUIDs, limited in-place consent, file grants, job/recovery semantics and result reporting. These workflows are reference instructions, not permission to edit during installation. The human-facing [user guide](user-guide.md) explains panel/client controls and example requests.

Folder approval in candidate 0.3.10 survives Stop/Launch/Reload, normal same-ID updates and restarts. Do not ask for a path already returned by get_file_access. Use premiere_forget_file_access only for an explicit revocation request, with confirm:true, current projectId and operationId; it is absent from inspection-only clients. Stop is transport suspension, not revocation. Earlier installed versions can clear approval on Stop; check the executing version. Uninstall/data deletion or Adobe/OS invalidation can remove persistence. Never trigger a picker merely to diagnose or test installation.

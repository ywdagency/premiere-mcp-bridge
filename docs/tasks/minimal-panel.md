# Minimal bridge panel

Historical 0.3.0 scope. The owner's later default-on lifecycle request supersedes its separate editing control; see [lifecycle panel](lifecycle-panel.md).

Simplify the panel to connection and explicit access controls while preserving the complete MCP API and source protections. Keep setup portable and prepare documentation for sharing the repository. Publication is outside this task.

- [x] Update the existing editable Figma panel in place.
- [x] Keep three controls: connection, editing access and the external-file folder grant.
- [x] Remove persistent status/diagnostic copy and show concise actionable errors.
- [x] Preserve explicit editing, project/operation guards, working-copy ownership and no implicit saves.
- [x] Preserve the existing uncommitted ClipProjectItem/transcript fix and host evidence.
- [x] Update setup/access documentation without user-specific paths or configurations.
- [x] Verify tests, isolated rendering and repository/package hygiene.

Design: internal editable panel reference (retained privately). Verification for this UI change uses isolated host fixtures and a browser preview; it does not modify, save or export the open Premiere project.

Verification: `npm test` passes all 65 tests, including the preserved transcript regression and panel access/recovery cases. Isolated browser rendering matches the frame geometry at 360px and reflows at the 320px minimum without horizontal overflow; editing, disconnect/reconnect and folder-error interactions pass. `npm pack --dry-run --json` includes no local configs, private artifacts, user paths or project data; `git diff --check` passes. The prior five-file uncommitted patch is unchanged. No live Premiere calls, plugin reload, publication, push or PR were performed for this task. Reload the development plugin to apply the code; Unload/Load refreshes the manifest's panel dimensions.

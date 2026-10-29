# Equal panel with status and version

Registry: TASK-9AC9D99C76E5. Owner selected proposal 2 on 2026-10-29, adding a compact status box and plugin version.

- [x] Update the editable native Figma reference and implement the two equal controls.
- [x] Show truthful lifecycle state or concise error, with version from the shared identity.
- [x] Preserve default-on behavior, transport Reload and all API/file protections.
- [x] Verify responsive rendering, tests and installed External-channel 0.3.2 with UDT closed.

Design: internal editable panel reference (retained privately)

Running means the plugin transport is ready; it is not a heartbeat from the agent-owned MCP process. Reload retains the existing transport-only behavior. No settings or persistent logs were added.

Verification: 73 npm tests passed; native Stop/Launch/Reload and read-only identities passed without UDT or a Premiere restart. See the 0.3.2 section in ../live-verification-26.5.md. The official Adobe CCX contains exactly seven runtime/license files with no owner paths and only request-based local-file access.

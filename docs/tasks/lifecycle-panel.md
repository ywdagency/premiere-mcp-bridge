# Default-on lifecycle panel

The owner selected automatic editing access while the bridge runs on 2026-10-29, replacing the separate Enable Editing switch. Keep the ordinary panel limited to Stop / Launch and Reload; leave persistent logs out.

- [x] Update the existing editable Figma frame and implement its two controls.
- [x] Enable editing when connected; block access after Stop and while reconnecting.
- [x] Recover the plugin transport without clearing working ownership, handles, jobs or durable receipts.
- [x] Request external-folder access only for a valid file request that needs it.
- [x] Preserve source protections, project/operation checks, the Node file broker and no implicit saves.
- [x] Preserve the prior ClipProjectItem/transcript identity fix.
- [x] Update current documentation and package/install 0.3.1.
- [x] Verify tests, isolated rendering, installed lifecycle controls and package hygiene.

Design: internal editable panel reference (retained privately). Browser checks cover 320px and 360px widths. Installed External-channel 0.3.1 was checked with UDT closed: automatic write availability, Stop, Launch, Reload and project/sequence reads succeeded without changing or saving the project. An actual external MCP process restart is covered by the stdio test. Native folder approval from an agent request and a cold Premiere launch were not exercised against the open owner project.

Reload means restarting the plugin connection and reading the IPC marker again. It does not reload JavaScript or restart an exited agent-owned Node process. File approval rejects the current request before file access instead of waiting on a human beyond its deadline; a later request uses the approved folder. A completed MEDIA_FOLDER_REQUIRED write receipt is still replayed under its original operation ID. Uncertain native writes must never be retried under a fresh ID.

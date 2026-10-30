# Final build verification — 0.3.6

Follow-up: the owner clarified that folder settings were removed. The release check found a missing MCP diagnostic for the restored file grant. [Candidate 0.3.7](../release/candidate-0.3.7.md) adds it, passes 153 tests and is officially installed, with actual runtime activation pending. Do not ask the owner to recall the hidden folder; use premiere_get_file_access after activation. The 0.3.6 observations below retain their original scope.

Registry: TASK-2BFAF9DBED1E. Owner requested final build checks after candidate preparation. Keep the repository private and the PR unmerged. Preserve shared source changes and durable receipts. Use Premiere MCP for host inspection/operations; application controls and native folder prompts require the owner where MCP has no route.

The Adobe UDT 2.3.0 bundled offline packaging implementation produced the reviewed seven-file CCX (runtime payload commit e4163e165daf71b9a8890a2cf6d88cc9650eb9b9). Archive/hash/permission checks and official Adobe installation passed; the install-time check preserved all 179 durable transport files at mode 0700. Initial post-install MCP still executed 0.3.5, so native candidate work was deferred. The owner has now restarted Premiere and opened the installed panel: direct MCP confirms executing **0.3.6**, Premiere **26.5.0**, all **38 host commands** and **41 MCP tools**. Doctor passes.

Bounded native read checks and all 16 exact-time assertions pass, as detailed in the [candidate report](../release/native-check-0.3.6.md). No native project/timeline write, import, save, close, export or UI operation has been issued. The existing media-folder grant is present but its root is not exposed through capabilities; the owner has been asked for the path before creating an isolated synthetic subfolder. The four synthetic fixtures are ready. Raw host evidence stays ignored locally.

- [x] Inspect exact CCX contents, permissions, payload equivalence and checksum.
- [x] Read installed host context and preserve durable receipts before any update.
- [x] Activate the exact candidate and confirm version/commands through MCP; doctor passes.
- [ ] Verify disposable synthetic workflows and record failures or fixture/application blockers.
- [x] Align the installer evidence and native test-plan limits; candidate PR/CI results are recorded in the registry checkpoint.

Do not infer successful native operation from catalog coverage or fixtures. Do not modify the owner's existing sequences, save private projects, reset preferences/caches or start existing AME work as a test. Keep visual/audio review separate and owner-supplied; no application screenshots or preview exports for verification.

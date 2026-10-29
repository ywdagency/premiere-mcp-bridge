# Final build verification — 0.3.6

Registry: TASK-2BFAF9DBED1E. Owner requested final build checks after candidate preparation. Keep the repository private and the PR unmerged. Preserve shared source changes and durable receipts. Use Premiere MCP for host inspection/operations; application controls and native folder prompts require the owner where MCP has no route.

The Adobe UDT 2.3.0 bundled offline packaging implementation produced a seven-file CCX from the reviewed stage. The archive matches the stage (normalized manifest JSON only), passes secret/path checks and has a SHA-256 checksum. The official Adobe installer reports successful installation and enabled 0.3.6. All 179 preserved durable transport files remain byte-identical at private directory mode 0700. MCP still reports executing 0.3.5, so candidate activation/native checks await the owner-controlled cold restart. Candidate source: e4163e165daf71b9a8890a2cf6d88cc9650eb9b9. The owner subsequently confirmed that Premiere cannot be restarted now. Activation, cold startup and native candidate tests are deferred; do not replace them with results from 0.3.5. Four synthetic media fixtures and the private per-member checklist are prepared. Raw artifacts and evidence stay ignored locally.

- [x] Inspect exact CCX contents, permissions, payload equivalence and checksum.
- [x] Read installed host context and preserve durable receipts before any update.
- [ ] Activate the exact candidate and confirm version/commands through MCP.
- [ ] Verify disposable synthetic workflows and record failures or fixture/application blockers.
- [x] Align the installer evidence and native test-plan limits; candidate PR/CI results are recorded in the registry checkpoint.

Do not infer successful native operation from catalog coverage or fixtures. Do not modify the owner's existing sequences, save private projects, reset preferences/caches or start existing AME work as a test. Keep visual/audio review separate and owner-supplied; no application screenshots or preview exports for verification.

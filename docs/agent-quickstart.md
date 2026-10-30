# First-run instructions for an AI agent

Read the root AGENTS.md and [installation guide](installation.md). This repository
connects only to Adobe Premiere; no other Adobe bridge is part of installation.

Identify the checkout version from package.json and use the matching reviewed
source/tag and CCX. Run npm ci, then the onboarding validator. Use --release only
when that exact version is published; while it is a candidate, use the owner's
reviewed local artifact and checksum. Do not invent a tag, download location or
successful installation. Ask the user for the missing reviewed artifact if needed.

The first check omits --install. Explain the concrete version/checksum result,
then invoke --install when the user's install request authorizes it. Adobe can
require a confirmation dialog. Do not add sudo, uninstall/delete plugin storage,
disable protections or restart Premiere as an implicit workaround.

Codex uses ignored project .codex/config.toml with absolute local paths. Other
client JSON must be merged in the documented location while preserving unrelated
servers. Inform the user of project trust and MCP reconnect needs; do not invent
a desktop Restart button. The AI client's own authentication is independent.

After the installed panel is open, run doctor. Treat runtime mismatch, missing
commands or connection failure as unfinished setup. Request the owner's normal
Premiere restart only if activation needs it; preserve manual work and session
receipts. Once reads pass, the user may legitimately have no active project.

For the first agent call, read capabilities and project identity, then the active
sequence if relevant. Report the actual executing version. Never create/import/
edit/export/save as a connection probe. Follow documented backup/ownership and
operation-UUID recovery rules for later editing tasks. A doctor pass is a
connection/version result, not certification of every API member.

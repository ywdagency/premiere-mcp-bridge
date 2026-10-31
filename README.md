# Premiere MCP Bridge

Development source prepares Windows onboarding; actual Windows/Premiere validation is pending. These changes are not in the published v0.3.11 tag. See [Windows preparation and acceptance](docs/windows.md).

**Give your AI agent a documented connection to Adobe Premiere.** Inspect timelines, work on sequence copies and build creative tools through local MCP—using the agent you choose.

MIT-licensed bridge built by **YWD Agency** for editors, creative technologists and developers connecting AI workflows to desktop production tools. The bridge exposes explicit operations; you direct the edit. It does not choose a story, analyze footage for an automatic montage or replace editorial judgment.

[User guide](docs/user-guide.md) · [Agent workflows](docs/agent-workflows.md) · [Client setup](docs/clients.md) · [Tools](docs/commands.md) · [Native API](docs/native-api.md) · [Troubleshooting](docs/troubleshooting.md) · [Documentation index](INDEX.md)

**Free, MIT-licensed preview 0.3.11.** Native reference host: Premiere 26.5 on macOS Apple Silicon; manifest minimum: 25.6; Node.js: 22+. This preview combines remembered folder approval, explicit permission forgetting, daily GitHub update checks and read-only update diagnostics. The exact seven-file installer/source match, executing version, restored grant and native update request are verified. Earlier synthetic editing/import/export checks remain [versioned evidence](docs/release/native-check-0.3.8.md), not a new full regression. Windows, every API/client and native yellow/red rendering are not certified. Download the [0.3.11 installer and checksum](https://github.com/ywdagency/premiere-mcp-bridge/releases/tag/v0.3.11). See [0.3.11 verification](docs/release/candidate-0.3.11.md) and [release gates](docs/release/README.md).

## Easiest start: ask your agent

Paste this into a local Codex, Claude Code or another agent with terminal/file access on the Mac running Premiere:

> Study https://github.com/ywdagency/premiere-mcp-bridge and help me install Premiere MCP Bridge and connect it to this agent. Follow the repository's installation instructions, start in read-only mode, and do not change my edit during setup.

The agent should begin with [INSTALL.md](INSTALL.md) and [AGENTS.md](AGENTS.md), use the published v0.3.11 source/installer, and guide you through Adobe confirmation, opening the panel, client trust and reconnecting. A browser-only/cloud chat without local computer access can explain the steps but cannot start this local bridge. Claude Desktop is also supported through the documented configuration merge.

Prefer to install the plugin yourself? Download the [CCX and SHA-256](https://github.com/ywdagency/premiere-mcp-bridge/releases/tag/v0.3.11), verify the checksum, then double-click the CCX and confirm in Adobe Creative Cloud Desktop. The CCX installs the Premiere plugin; the local MCP server/client still needs the agent-led or [CLI setup](docs/installation.md). You do not need UXP Developer Tools for this route.

## What you can do

The current Node source also searches 806 official Premiere Help articles through the existing `premiere_api_search` (`source: "manual"` or `"all"`) and reads cited passages through `premiere_api_describe`. Default API behavior and tool counts are unchanged. Search uses offline navigation metadata; reading article text contacts Adobe. See [manual reference](docs/manual-reference.md). This Node-only feature needs a client reconnect after updating the source/dependencies, with no UXP reinstall.

Ask an agent to report the active sequence, inspect paginated clips with exact ticks/timecodes, or read existing transcript data where the host supports it. Prepare a named working copy and make deliberate clip, marker, effect or keyframe changes through documented tools. Develop a custom assistant that can discover exact native signatures and probe the installed runtime before calling them.

Timeline mutations default to sequences created or duplicated by this bridge in the current plugin session. With explicit owner instruction, `premiere_authorize_sequence` permits one existing sequence after a verified direct-clone backup; `premiere_revoke_sequence_authorization` removes that permission. Retained backups, original-sequence deletion and shared source media stay protected. Project saves, global settings, Source Monitor changes and native export jobs are separate, explicit operations with their own side effects. See [tools and arguments](docs/commands.md).

## Two components, one local connection

The **UXP plugin** runs inside Premiere. The **Node MCP server** is started by your AI client on the same computer and user account. They exchange bounded JSON in the plugin's private local storage; there is no bridge-folder picker, cloud bridge, API key or HTTP listener.

```mermaid
flowchart LR
    Agent[Your AI client] -->|MCP over stdio| Server[Local Node server]
    Server -->|Private file IPC| Plugin[Premiere UXP plugin]
    Plugin -->|Documented APIs| Host[Adobe Premiere]
```

The client receives tool results, which may include project names, clip names and requested transcript text. Its model provider and data policies still apply. A local transport does not make the AI client offline. Read [security and data handling](SECURITY.md).

## Install and connect on macOS

The CCX route uses Adobe Creative Cloud's installer; end users do not need UXP
Developer Tools. See [CLI installation](docs/installation.md) and
[first-run agent instructions](INSTALL.md).

Use the exact published source tag and reviewed release assets:

```sh
git clone --branch v0.3.11 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run onboard -- --release
npm run onboard -- --release --install --read-only
```

Validation does not install or configure anything. Explicit --install invokes Adobe and creates project-local Codex configuration; other clients receive JSON for a controlled merge. Enable Premiere Developer Mode, open Window → UXP Plugins → Premiere MCP Bridge, open/trust this clone in the client and reconnect its MCP process. Then run npm run doctor. It checks the actual executing version/commands; installer registration alone is insufficient.

The downloader uses only the matching published version and checksum, without a floating-latest fallback. Manual CCX installation and agent-assisted client setup are described in [INSTALL.md](INSTALL.md). Current package/runtime limits are in the [0.3.11 report](docs/release/candidate-0.3.11.md); the [earlier fresh-checkout review](docs/release/final-review-0.3.8.md) remains historical.

## Development loading with UDT

Install Node.js 22+, Adobe Premiere 25.6+ and Adobe UXP Developer Tools (UDT). Adobe documents Premiere support from UDT 2.2; this project's developer-load shortcut was tested with UDT 2.3.0. Premiere 26.5 is the current native reference host. A working Adobe installation/license is required separately.

```sh
git clone --branch v0.3.11 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run setup
```

Run commands from the clone. Setup builds the plugin and creates this clone's ignored `.codex/config.toml` with absolute paths. It preserves unrelated Codex server entries, replaces this bridge's prior local registration and does not change global settings. For Claude Desktop, Cursor or VS Code, use [the client guide](docs/clients.md) instead of the default Codex setup.

In Premiere, enable Developer Mode in Preferences → Plugins if needed. In UDT, add this clone's `manifest.json` and select Load. With UDT and Premiere already running, `npm run plugin:load` is an optional development shortcut; manual UDT Load is the fallback. Open **Premiere MCP Bridge** under Window → UXP Plugins once to instantiate it.

Open this clone as a trusted project in Codex, then restart/reconnect its MCP server so the new configuration is read. No connection folder or address is required. For a first successful command, ask:

> Use `premiere_get_capabilities` and `premiere_get_project` with empty arguments. Tell me the host version and whether a project is open. Do not edit, activate, export or save anything.

Success means capabilities report the connected host and project inspection returns the current project or null. If Premiere has no open project, null is expected. You can also run `npm run mcp:smoke -- --metadata-only` for a read-only connection check; keep its raw metadata output private. See [recovery guidance](docs/troubleshooting.md) if tools are missing or time out.

## Running, stopping and file access

The bridge connects automatically when the plugin loads, with editing enabled. **Stop** blocks access while preserving the remembered external-folder approval; **Launch** resumes it. **Reload** restarts the plugin transport while retaining working-copy ownership, handles, job records and receipts. It does not restart JavaScript or the client's external Node process. Actual UDT/host plugin unload loses session ownership, handles and job registries; it does not cancel native jobs.

File operations require a separate native folder approval. The first valid request without a grant opens that dialog and returns `MEDIA_FOLDER_REQUIRED` before file I/O. Approve the intended folder and submit a new request; a write with this confirmed preflight rejection uses a new operation UUID. Unknown write outcomes require recovery with the original UUID and identical arguments instead. There is no implicit project save.

For an inspection-only client configuration, run `npm run setup -- --read-only`. This omits write tools from that Node server even while the plugin runs. Other clients can use the same flag with their generator. See [client permissions](docs/clients.md).

## API coverage and limits

The staged source server exposes **43 MCP tools**: convenience project/sequence/clip operations, searchable reference tools and a typed native adapter. Six project import/lifecycle adapters are exposed; selected native checks and remaining AE/growing-media variants are separately recorded; see the [API expansion matrix and test plan](docs/api-expansion.md). Installed runtimes report their own command list through capabilities. The pinned Adobe DOM catalog covers **73 types and 707 entries**, including 137 constants. Native evidence is recorded separately for Premiere 26.5; installation/lifecycle observations must identify the actual build tested. These counts describe this checkout, not every Premiere version or full behavioral coverage.

Catalog membership, execution policy, native presence and live-tested behavior are different. Search and describe work without Premiere; `premiere_api_probe` checks the running host. The [native API guide](docs/native-api.md) documents opaque handles, locked action batches, file grants, jobs and events. The [live report](docs/live-verification-26.5.md) records what actually ran.

No arbitrary JavaScript, shell, QE, ExtendScript or callback source is accepted. Single-item move/trim tools do not automatically synchronize linked audio/video. Some APIs in current Adobe docs are absent from Premiere 26.5; queued export acceptance is not render completion. See [known limits](docs/troubleshooting.md).

## Develop and contribute

```sh
npm test
npm run build
npm pack --dry-run --json
```

Automated tests cover contracts, ownership guards, real local IPC and MCP SDK stdio with host fixtures; they do not constitute native Premiere checks. See [CONTRIBUTING.md](CONTRIBUTING.md) for the command example, version gates and verification workflow. The [architecture](docs/mcp-bridge.md) covers discovery, receipts and uncertain writes. Installation and this release are Premiere-only.

Native UXP button rendering can vary by host. Release review materials and outstanding gates are in [docs/release](docs/release/README.md).

Bridge code is [MIT licensed](LICENSE); see the [open-source model](OPEN_SOURCE.md) for reuse, contributions and third-party boundaries. The bundled Adobe reference retains its [Apache-2.0 license](data/ADOBE-LICENSE.txt) and [copyright notice](data/ADOBE-COPYRIGHT.txt); see [license boundaries](docs/third-party-notices.md). Adobe Premiere is an Adobe product. Premiere MCP Bridge is an independent YWD Agency project, not an Adobe product or Marketplace listing.

# Premiere MCP Bridge 0.3.8 — macOS preview

Connect a local MCP-capable AI client to Adobe Premiere through a UXP plugin and a Node.js stdio server. Inspect projects/tracks/clips, discover exact documented API contracts and make explicit edits on verified working copies. Built by YWD Agency; bridge code is MIT licensed.

## Requirements and tested scope

macOS, Node.js 22+, Adobe Creative Cloud Desktop, Premiere and a local MCP client on the same computer/user account. Native checks use Premiere 26.5 / Apple Silicon; the manifest's minimum version is 25.6, not an every-feature certification. This preview exposes 42 full-access tools or 19 inspection-only tools. Adobe and AI-client accounts/licenses are separate.

The bridge uses private local file IPC with automatic discovery. It does not need a bridge URL, API key, connection-folder picker or UXP Developer Tools for the installed CCX route. External file operations need their own deliberate native folder approval.

## Install and connect

Ask a local agent: “Study https://github.com/ywdagency/premiere-mcp-bridge and help me install the bridge and connect it to this agent, starting read-only.” The agent begins with [INSTALL.md](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/INSTALL.md). You can also verify the checksum and double-click the CCX to install the plugin; the local server/client still needs setup. Browser-only cloud chat without local computer access cannot start this stdio bridge.

Use this release's exact matching source tag:

```sh
git clone --branch v0.3.8 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run onboard -- --release
npm run onboard -- --release --install --read-only
```

Validation alone does not install/configure anything. The explicit install invokes Adobe and generates this clone's Codex configuration; other clients use the documented manual JSON merge. Enable Premiere Developer Mode, open Window → UXP Plugins → Premiere MCP Bridge, open/trust the clone in your client and reconnect its MCP process. Then run:

```sh
npm run doctor
```

Doctor verifies the executing version/commands and basic context, not every edit. A normal owner-controlled Premiere quit/reopen may be necessary if an older JavaScript runtime is loaded; save your work yourself first. Transport Reload does not load newly installed JavaScript.

Start by asking the agent to read capabilities/project/active-sequence status without editing. To enable the full tool surface later, regenerate the chosen client configuration without --read-only, merge JSON where applicable and reconnect. There is no separate Enable Editing toggle.

## Instructions

[Installation](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/installation.md) · [User guide and example prompts](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/user-guide.md) · [Agent workflows](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/agent-workflows.md) · [Client configuration](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/clients.md) · [Troubleshooting](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/troubleshooting.md).

## Verification and limitations

Local tests and actual synthetic native checks cover imports/recovery, independent backups, exact A/V moves, markers, effect/keyframe values, explicit source authorization/revocation and readable XML/OTIO outputs. Versioned persistence/lifecycle checks and a fresh source/dependency/config checkout plus official installation on the maintainer's existing Mac are recorded separately. A pristine new-Mac installation, dedicated sessions in every client app, Windows, dirty-close choices, asset-dependent variants and visual/audio/interchange fidelity are not collectively verified.

The pinned Adobe DOM reference has 73 types and 707 entries; reference coverage is broader than execution/runtime verification. No arbitrary code, shell, QE or ExtendScript endpoint is exposed. Default working-copy protection does not make all global/save/export operations harmless or undoable. Keep Premiere idle during commands, retain verified backups and recover uncertain writes using the exact original operation UUID/payload. No project is saved implicitly.

See [native evidence](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/release/native-check-0.3.8.md) and [first-run/disclosure review](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/release/final-review-0.3.8.md).

## Assets and license

Install premiere-mcp-bridge-0.3.8.ccx with its accompanying .ccx.sha256 file. CCX SHA-256: 7153825fb11b08423a138b37833ef557f7e7280d7c01293a4a896b5cca0218b1. The CCX is the plugin; the tagged source supplies the Node server/client setup. No automatic updater or npm-registry package is required.

Bridge code/documentation is [MIT](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/LICENSE). Adobe-derived reference/contracts retain separate [Apache-2.0 notices](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/docs/third-party-notices.md). This is an independent project, not an Adobe product or Marketplace listing. Use synthetic public bug reports and the [private security contact](https://github.com/ywdagency/premiere-mcp-bridge/blob/v0.3.8/SECURITY.md).

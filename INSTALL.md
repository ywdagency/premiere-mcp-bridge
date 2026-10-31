# Install with your AI agent

Development 0.4.0 is an unpublished candidate: use its reviewed local CCX/checksum as described in [the candidate report](docs/release/candidate-0.4.0.md). Do not use --release for an unpublished version or silently install 0.3.12 into a 0.4.0 checkout. The public-tag examples below remain for released 0.3.12. Folder-button selection is optional for file tasks and is never an installation requirement.

Give your local agent this repository URL and ask:

> Study https://github.com/ywdagency/premiere-mcp-bridge and help me install Premiere MCP Bridge and connect it to this agent. Follow the installation instructions, start in read-only mode, and do not change my edit during setup.

This guide is the installation entrypoint for an agent receiving that request. Read [AGENTS.md](AGENTS.md), [detailed installation](docs/installation.md). Install only what the human requested; examples do not authorize native editing.

## Check where the agent runs

The plugin, Node server and client-side MCP process must run on the same computer and user account. Check local terminal/file access and identify the actual client. Browser-only/cloud chat without an appropriate local execution environment can explain installation but cannot start this stdio bridge. Do not invent a hosted URL, expose private IPC over a network or request remote-account credentials.

Check macOS or native Windows, Git, Node.js 22+, Creative Cloud Desktop/UPIA and the intended Premiere installation. Windows is experimental: read [Windows setup and testing](docs/windows.md) before installation, explain that native Windows behavior has not been verified, and begin with read-only checks. The recorded native reference host is Premiere 26.5 on macOS Apple Silicon with the earlier 0.3.11 plugin; 0.3.12 does not inherit a native test result just because its payload differs only by version. If a prerequisite is absent, explain the missing normal installation instead of using sudo, untrusted shell installers or bypassing Adobe licensing.

## Get the matching public version

Choose a new folder, preserving existing checkouts and work. For this preview:

```sh
git clone --branch v0.3.12 --depth 1 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run onboard -- --release
```

The last command downloads only the official matching release/CCX/checksum and validates the exact allowlisted payload against this built checkout. It does not install or configure. Report the verified version and result; missing/draft releases, hash/payload mismatch or unsupported host are failures, not reasons to use a floating latest download.

## Install the plugin and prepare the client

The human's request to install/connect authorizes the normal reviewed installation. Explain the verified package and run the applicable command; do not ask the human to supply a bridge folder or API key.

| Client | Install/generate from this clone | Configuration follow-through |
| --- | --- | --- |
| Codex | npm run onboard -- --release --install --read-only | Writes only this clone's .codex/config.toml. Open/trust this clone as the client's project and reconnect the MCP process. A nested clone's configuration is not automatically loaded by a session rooted elsewhere. |
| Claude Code | npm run onboard -- --release --install --client json --read-only | Merge returned mcpServers into this clone's ignored .mcp.json, preserving unrelated entries. Start/open Claude Code in the clone, approve the project server as required and check /mcp. See client setup. |
| Claude Desktop | npm run onboard -- --release --install --client claude --read-only | Controlled merge of returned JSON into the documented Desktop configuration, preserving unrelated servers; quit/reopen the client when the user is ready. |
| Cursor / VS Code | Use --client cursor or --client vscode with --read-only | Merge the returned configuration into the documented client-specific location and reconnect its MCP process. |

For non-Codex clients, onboard reports configured:false because it only returns JSON. An agent with authorized local file access may perform the documented merge, preserving other servers and keeping a private backup; otherwise give the user the exact merge. Do not claim the client is configured merely because JSON was generated. Machine-specific paths/configs remain private and ignored.

The CCX is also a native Adobe installer: the human may verify its checksum, double-click it and confirm in Creative Cloud Desktop. If it was already installed manually, use the matching clone's setup/generator instead of reinstalling without a reason. The CCX installs only the Premiere plugin; it does not install Node or configure every AI client. UXP Developer Tools is optional for development, not required for the CCX route.

## Human actions and first read

Explain the remaining native actions clearly: Adobe may request installation confirmation; enable Premiere Developer Mode; open Window → UXP Plugins → Premiere MCP Bridge; open/trust the clone and reconnect the AI client's MCP process. These confirmations and trust decisions cannot be promised away. Never automate UDT through Accessibility.

If an old JavaScript runtime remains loaded, ask for a normal owner-controlled Premiere restart after the user saves work. Do not restart/save/uninstall/remove plugin data silently. Panel Reload is transport-only and does not activate a newly installed runtime or refresh the client's tool list.

After the panel is open:

```sh
npm run doctor
```

Require executing version 0.3.12 and no missing commands. Discover tools in the client's actual MCP connection, then read premiere_get_capabilities and premiere_get_project, and the active sequence if relevant. Inspection-only configuration exposes 19 tools. A null project/sequence is valid. Do not create/import/edit/export/save a project or open a media-folder picker as an installation test.

Finish by reporting the actual version, doctor/first-read result, client configuration location and any remaining human action. If a client needs a new session/reconnect, state that setup is waiting for it. Follow [troubleshooting](docs/troubleshooting.md) rather than claiming success from installer registration alone.

## After connection

Use the [user guide](docs/user-guide.md) and [agent workflows](docs/agent-workflows.md). When editing is intended, regenerate the configuration without --read-only and reconnect. Normal edits use verified BACKUP/WORK copies and explicit UUID recovery. File access is a separate deliberate grant. No project is saved implicitly.

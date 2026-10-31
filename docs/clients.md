# MCP client setup

The UXP plugin and the MCP client must run on the same computer and user account. Each client starts `mcp/server.mjs` as a local Node process over stdio. This is not a URL connector for a cloud-only agent. Install the matching reviewed CCX using [CLI onboarding](installation.md); UDT is an optional development alternative. Client configuration alone does not load the plugin.

From the clone, run `npm ci` and `npm run build` before generating configuration. Node.js 22+ is required. Generated configurations use the current Node executable and absolute server path, avoiding GUI PATH differences. Regenerate after moving the clone or changing Node. Do not share generated machine-specific files or commit them.

## Choose your client

Run `npm ci` from the clone. Codex setup includes the build; for the other clients run `npm run build` before their generator.

| Client | Command from the clone | Where the generated configuration goes |
| --- | --- | --- |
| Codex | `npm run setup` | Automatically updates this clone's `.codex/config.toml` |
| Claude Desktop | `node scripts/setup.mjs --client claude` | Merge printed JSON into the desktop config described below |
| Cursor | `node scripts/setup.mjs --client cursor` | Merge printed JSON into `.cursor/mcp.json` or the user config |
| VS Code | `node scripts/setup.mjs --client vscode` | Merge printed JSON into `.vscode/mcp.json` |

Load the UXP plugin separately in Premiere, open its panel once, then restart/reconnect the client's MCP server. The client starts Node itself; a separate manually running `npm run mcp:start` process is unnecessary. The bridge does not provide a remote URL, OAuth flow or API key. The common launch contract is the generated absolute Node executable plus the absolute `mcp/server.mjs` argument.

## Compatibility statement

| Client | Configuration supplied | Evidence and limit |
| --- | --- | --- |
| Codex local clients | Project `.codex/config.toml` | Config generation/merge tested; actual SDK stdio and local Premiere reads recorded. No claim of every Codex surface/version being tested. |
| Claude Desktop | `mcpServers` JSON | Format and macOS location checked against official guidance; no dedicated end-to-end client session recorded here. |
| Cursor | `mcpServers` JSON | Format and locations checked against official guidance; no dedicated end-to-end client session recorded here. |
| VS Code | `servers` JSON with `type: "stdio"` | VS Code format checked against official guidance; agent harness configuration differs. No dedicated end-to-end client session recorded here. |

Candidate 0.3.8 retains 42 full-access or 19 inspection-only tools and the portable client generators. Actual 0.3.7 synthetic workflow evidence is recorded separately; its batch preflight failure led to the current patch. Executing 0.3.8, maximum-size imports, file denial/recovery, marker guards, effects/keyframes and explicit source authorization/revocation are verified on the documented synthetic scope. Fresh-checkout results are recorded in the [final private review](release/final-review-0.3.8.md). These are local integration paths, not vendor certification. Source pages below were checked on 2026-10-29.

## Codex

```sh
npm run setup
```

This builds the plugin and creates/updates `.codex/config.toml` in this clone. It preserves unrelated registrations and replaces this bridge's current/legacy project-local entries. Open the clone as a trusted project; Codex ignores project-local configuration for untrusted projects. Restart/reconnect the client's MCP process after configuration changes. For CLI diagnosis, `codex mcp list` lists registrations and `/mcp` in the Codex TUI shows active servers. No particular desktop button name is assumed.

Generated Codex configuration sets `tool_timeout_sec = 45`, leaving room above the bridge's 30-second deadline. Regenerate older configurations that set it to 20 seconds. This changes the client wait limit, not the native request budget.

To inspect only, run `npm run setup -- --read-only`. Do not copy the generated personal paths into another installation. Setup does not start Premiere or grant external-folder access.

Official sources: [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and [trusted project configuration](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml).

## Claude Desktop on macOS

```sh
node scripts/setup.mjs --client claude
```

Merge the printed `mcpServers.premiere` entry into `~/Library/Application Support/Claude/claude_desktop_config.json`, preserving existing servers. Create a valid JSON object if the file does not exist. Fully quit and restart Claude Desktop after saving. The desktop's local-server diagnostics show connection errors; do not paste raw logs into a public issue.

This generator outputs JSON, not a Claude Desktop `.mcpb` extension. It does not configure Claude Code, claude.ai or a remote connector. See the official [MCP local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) for the manual configuration mechanism and [Claude's local-server help](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) for current diagnostics.

## Cursor on macOS

```sh
node scripts/setup.mjs --client cursor
```

Merge the printed `mcpServers.premiere` entry into project `.cursor/mcp.json` or user `~/.cursor/mcp.json`. Keep it local: the absolute paths belong to this installation. Cursor's official help documents command-based stdio entries with `command`, `args` and `env`; its detailed schema also documents explicit `type: "stdio"`, which can be added to the generated entry if required by your version. Check server status in Cursor's MCP controls and restart its server after configuration changes.

See [Cursor configuration locations and examples](https://prod.cursor.com/help/customization/mcp) and [Cursor MCP reference](https://prod.cursor.com/docs/mcp). Managed client restrictions can still prevent a local process from reading Adobe plugin storage.

## VS Code on macOS

```sh
node scripts/setup.mjs --client vscode
```

Merge the printed `servers.premiere` entry into workspace `.vscode/mcp.json`; it already includes `type: "stdio"`. Keep generated absolute paths out of commits. Use the Command Palette's **MCP: List Servers** to start/restart the server or inspect output. Approve the appropriate workspace/server trust prompts. This guide assumes a local VS Code window, not a remote container or SSH host.

VS Code's `servers` format differs from the portable Copilot `mcpServers` format in workspace `.mcp.json` or user Copilot configuration. Use the destination required by the chosen harness; do not paste the VS Code generator output into a different schema. See [the official configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

## First successful call

After loading the plugin and connecting the client, ask it to call `premiere_get_capabilities` with `{}`, then `premiere_get_project` with `{}`. A project may legitimately be null. Do not use sequence creation or export as the connection test. `npm run mcp:smoke -- --metadata-only` supplies a separate read-only SDK check and prints private host/project metadata.

With an active synthetic sequence, `premiere_get_sequence_clips` with `{"limit":5}` returns a bounded page. Asking for all clips at once does not bypass pagination. Exact schemas come from MCP tool discovery; see [commands](commands.md).

## Lifecycle and permissions

The plugin connects automatically, with editing enabled. Stop blocks access and clears the external-folder grant; Launch resumes. Panel Reload restarts transport while preserving session ownership, handles, job records and receipts. It cannot restart an exited client-owned Node process. Actual UDT/host plugin unload resets session ownership/registries and does not cancel native jobs. Do not confuse panel Reload with UDT Reload. After an upgrade, compare `bridgeVersion` from `premiere_get_capabilities` with the expected source/package version. An installer reporting a new version does not prove that its JavaScript is already running; panel Reload cannot activate a new JavaScript runtime. Use the actual plugin/host reload workflow for your installation and account for lost session handles/ownership before continuing. For an installed CCX, update it through the Adobe installer; UDT Unload/Load is only for development registrations. Duplicate installed versions of the same plugin ID can leave an older runtime selected. Preserve plugin data and durable receipts before removing an old registration: uninstall can remove shared storage even when a newer version remains installed. Restore original private-directory permissions as well as data, and confirm the running version through MCP after reopening the installed panel.

A valid file request without a folder grant opens the native picker and returns `MEDIA_FOLDER_REQUIRED` before file I/O. After approval submit a new request; a write rejected by this completed preflight needs a new operation UUID. This exception never authorizes retrying an uncertain write with a new ID. Grants last until Stop or expiry. Invalid paths do not open the picker.

For every generator, `--read-only` sets `PREMIERE_MCP_READ_ONLY=1`. That server omits all write tools; the plugin cannot restore omitted tools. Read-only here means no native content mutation. Reads can still create internal handles/event subscriptions or request a file grant. Tool annotations and client approval policies are separate from the plugin's working-sequence guard.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PREMIERE_MCP_READ_ONLY` | unset | `1` omits all write tools from this server |
| `PREMIERE_MCP_TIMEOUT_MS` | `30000` | Request deadline, 50–30000 milliseconds; serialized maximum-size file batches can exceed 10 seconds |
| `PREMIERE_MCP_HOST_VERSION` | unset | Select a host storage major version when multiple Premiere versions run |
| `PREMIERE_MCP_BRIDGE_DIR` | `auto` | Advanced transport/test override; ordinary installations use automatic discovery |

Import failure diagnostics can contain original host exception text, including private paths or filenames. Treat diagnostics and receipt contents as private before sharing them.

No bridge API key is needed. Authentication/subscriptions for your AI client and Adobe installation are independent. Returned names/transcripts can reach the client's model provider; see [data handling](../SECURITY.md). For errors, use [troubleshooting](troubleshooting.md).

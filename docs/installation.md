# Install and connect from the CLI

Development 0.4.0 is not yet published. Its reviewed local CCX includes the folder SVG as an eighth allowlisted file. Use the local CCX/checksum route with its exact source; --release must fail until that version is published. Public examples below continue to target released 0.3.12.

Version 0.3.12 provides macOS onboarding and **experimental Windows onboarding**. Windows installation, filesystem behavior and native Premiere calls are not yet verified; start with the [Windows guide](windows.md). Earlier native reference evidence is from macOS Apple Silicon / Premiere 26.5 on 0.3.11 and prior builds, not a native 0.3.12 regression.

Both routes require native Node.js 22+, Git, Creative Cloud Desktop and Premiere (manifest minimum 25.6). The plugin, local server and agent must run on the same computer/account. Creative Cloud supplies Adobe's Unified Plugin Installer Agent (UPIA); UXP Developer Tools is optional for development.

## Published preview

The free MIT preview is v0.3.12. Use its exact tag and official CCX/checksum. The
[agent-led entrypoint](../INSTALL.md) lets a local agent guide the installation
from a repository link. A cloud-only chat without local terminal/files cannot
start the stdio server on your computer.

## CLI installation

```sh
git clone --branch v0.3.12 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run onboard -- --release
npm run onboard -- --release --install --read-only
```

The first onboard call downloads/checks only. The second explicitly invokes Adobe
and creates the clone's ignored Codex configuration. Both use exactly the checkout
version; they never use a floating latest release. The tagged source must contain
this CLI before publication. Prerequisites and Adobe/client confirmation cannot
be bypassed by a shell command.

The downloader reads only this repository's published matching GitHub release
and exact assets `premiere-mcp-bridge-0.3.12.ccx` and
`premiere-mcp-bridge-0.3.12.ccx.sha256`. Missing/draft assets fail explicitly.
No API token is required for public downloads; private candidate downloads are
not supported by this automatic route.

## Reviewed local CCX or manual Adobe installation

```sh
git clone --branch v0.3.12 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run onboard -- --ccx /path/to/reviewed.ccx --sha256 HASH_FROM_REVIEWED_CHECKSUM
# Add --install only when ready to invoke Adobe and generate client configuration.
```

Use the checksum supplied with the reviewed artifact. Computing a checksum from
an unknown download is not an independent trust check. The local validator checks
the hash, exact file allowlist, version and payload bytes against this built
checkout. UDT's JSON-only manifest normalization is accepted structurally; changed
permissions/content, extra files, duplicate archive entries and source/runtime
mismatches reject before installation. A private temporary snapshot is installed,
then removed; validation never executes the downloaded plugin code.

You can also double-click the reviewed .ccx file and confirm in Creative Cloud Desktop. This installs only the plugin; run npm run setup -- --read-only in the matching source clone to generate Codex configuration, or follow the client-specific generator/merge.

The CLI installer invokes Adobe's documented macOS UPIA with `--install`, or Windows UPIA with `/install`, using separate arguments and no shell. It
does not uninstall an older version, erase plugin data, launch/restart Premiere
or save a project. Adobe may show its own confirmation or permission dialog.
If Creative Cloud/UPIA is missing, install/repair Creative Cloud normally.

Open Window → UXP Plugins → Premiere MCP Bridge once. Enable Developer Mode in
Premiere's plugin preferences before connecting, as required by Adobe. Reconnect/restart the AI
client's MCP process and trust this project where the client requires it. If an
old JavaScript runtime is still loaded, save work yourself and normally quit/reopen
Premiere when convenient, with UDT closed, then open the installed panel.
Transport Reload does not activate newly installed JavaScript.

After the installed panel is open, open/trust this clone in the chosen client and reconnect its MCP process. Only then run:

```sh
npm run doctor
```

See the [0.3.12 verification](release/candidate-0.3.12.md) for current local/package checks and the [0.3.11 report](release/candidate-0.3.11.md) for earlier native Mac evidence. A fresh checkout on an existing Mac is not a pristine OS installation or a Windows test.

## Updating an existing installation

Use a new clone of the exact v0.3.12 tag and the same onboard --release validation/install route. Preserve the plugin ID, plugin-owned storage, receipts and unrelated client configuration. Do not uninstall, delete data or restart/save Premiere automatically. Update the chosen client's server path/configuration to the matching clone and reconnect; installing a CCX alone does not update an agent's Node server. If Adobe leaves an old runtime loaded, the human should save work and normally restart Premiere, then run doctor until it reports 0.3.12 and no missing commands.

Normal same-ID updates preserve remembered approval. Version 0.3.8 has an older Stop action that clears it; close that runtime normally rather than using Stop as an upgrade step. Folder movement, uninstall, token invalidation or already lost approval can still require one native folder consent on a real file request. The project location alone does not grant file access.

## Clients and first read

Codex is the default. `--read-only` omits native writes for the first connection.
To enable the normal tool surface later, run `npm run setup` and reconnect the
client; no reinstall is needed. Other clients use, for example,
`--client claude`, `--client cursor` or `--client vscode`.
Their JSON is returned as `clientConfiguration` for manual merge; those apps are
not silently configured. See [exact locations and trust requirements](clients.md).

`npm run setup` only builds/generates the project-local Codex config and never
contacts Premiere. Absolute Node/server paths belong to this clone; regenerate
after moving it. No global settings, bridge-folder picker, URL or API key.

Run `npm run doctor -- --offline` to check source/build versions without contacting
Adobe. `npm run doctor` additionally checks executing plugin version, expected
commands and project/active-sequence availability using reads only. A null project
is valid. It does not print project names, file paths or raw host exceptions.
A mismatch returns nonzero, even if Adobe lists the expected installed version.

Doctor does **not** verify timeline edits, effects, import or export. Complete
the [native test plan](live-test-plan.md) and consult the versioned native reports for actual evidence. See [troubleshooting](troubleshooting.md)
and [release gates](release/README.md).

Adobe sources:
[Premiere installation and UPIA](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/).

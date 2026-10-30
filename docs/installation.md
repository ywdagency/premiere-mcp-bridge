# Install and connect from the CLI

The supported preview platform is macOS, Node.js 22+, Creative Cloud Desktop and
Premiere (manifest minimum 25.6; native reference host 26.5 Apple Silicon).
Creative Cloud supplies Adobe's Unified Plugin Installer Agent (UPIA). End users
install the reviewed CCX with UPIA; UXP Developer Tools is a development alternative,
not an end-user prerequisite for the CCX route.

## Candidate status

Version 0.3.6 is still a private, unmerged candidate. No public tag/release asset is
available yet. The commands below become the public path only after the matching
source commit and release assets are published. For present candidate review,
clone with `--branch release/0.3.6` and use the reviewed local installer path.
Do not use default main's older source with a newer CCX.

## Public path after the release is published

```sh
git clone --branch v0.3.6 https://github.com/ywdagency/premiere-uxp-bridge.git
cd premiere-uxp-bridge
npm ci
npm run onboard -- --release
npm run onboard -- --release --install --read-only
npm run doctor
```

The first onboard call downloads/checks only. The second explicitly invokes Adobe
and creates the clone's ignored Codex configuration. Both use exactly the checkout
version; they never use a floating latest release. The tagged source must contain
this CLI before publication. Prerequisites and Adobe/client confirmation cannot
be bypassed by a shell command.

The downloader reads only this repository's published matching GitHub release
and exact assets `premiere-mcp-bridge-0.3.6.ccx` and
`premiere-mcp-bridge-0.3.6.ccx.sha256`. Missing/draft assets fail explicitly.
No API token is required for public downloads; private candidate downloads are
not supported by this automatic route.

## Local reviewed candidate

```sh
git clone --branch release/0.3.6 https://github.com/ywdagency/premiere-uxp-bridge.git
cd premiere-uxp-bridge
npm ci
npm run onboard -- --ccx /path/to/reviewed.ccx --sha256 HASH_FROM_REVIEWED_CHECKSUM
# Add --install only when ready to invoke Adobe and generate client configuration.
```

Use the checksum supplied with the reviewed artifact. Computing a checksum from
an unknown download is not an independent trust check. The local validator checks
the hash, seven-file allowlist, version and payload bytes against this built
checkout. UDT's JSON-only manifest normalization is accepted structurally; changed
permissions/content, extra files, duplicate archive entries and source/runtime
mismatches reject before installation. A private temporary snapshot is installed,
then removed; validation never executes the downloaded plugin code.

The installer invokes Adobe's documented macOS UPIA path with `--install`. It
does not uninstall an older version, erase plugin data, launch/restart Premiere
or save a project. Adobe may show its own confirmation or permission dialog.
If Creative Cloud/UPIA is missing, install/repair Creative Cloud normally.

Open Window → UXP Plugins → Premiere MCP Bridge once. Enable Developer Mode in
Premiere's plugin preferences if required by the host. Reconnect/restart the AI
client's MCP process and trust this project where the client requires it. If an
old JavaScript runtime is still loaded, save work yourself and normally quit/reopen
Premiere when convenient, with UDT closed, then open the installed panel.
Transport Reload does not activate newly installed JavaScript.

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
the [release-specific native plan](tasks/final-build-0.3.6.md) before declaring
this candidate a tested public installer. See [troubleshooting](troubleshooting.md)
and [release gates](release/README.md).

Adobe sources:
[Premiere installation and UPIA](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/).

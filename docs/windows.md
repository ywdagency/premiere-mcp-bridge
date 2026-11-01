# Windows installation — experimental

Preview **0.4.2** retains **experimental Windows onboarding**. Automated Windows platform fixtures pass on macOS; no actual Windows/Premiere installation, client connection, NTFS privacy or native operation is verified yet. Use non-sensitive test material and start read-only. This is not stable Windows support. The older immutable v0.3.11 CLI accepts macOS only.

## Easiest start: ask your local agent

Give Codex, Claude Code or another locally running agent this request:

> Study https://github.com/ywdagency/premiere-mcp-bridge and help me install v0.4.2 on Windows and connect this agent. Follow INSTALL.md and docs/windows.md. I understand Windows support is experimental. Start in read-only mode; do not change or save my edit, restart Premiere or request a media folder during setup.

The agent needs terminal/file access on the same Windows computer and account as Premiere. A cloud-only chat cannot launch this local bridge. No bridge address, API key or connection-folder selection is needed.

## What is prepared

The released 0.4.2 manifest's eight-file CCX has no OS-specific plugin binary. This source validates the archive in Node on either OS without zip/unzip, PowerShell extraction or executing downloaded contents. It checks the reviewed checksum, exact entries, duplicate/linked/encrypted entries, expanded-size bounds, consistent local/central headers, version and rebuilt bytes before invoking Adobe. The same previously reviewed macOS CCX must still match; this is not Windows host proof.

The Windows installer resolves Adobe UPIA from the standard CommonProgramFiles environment locations and invokes UnifiedPluginInstallerAgent.exe with a separate /install argument and the validated private snapshot. It does not search PATH, use a shell, uninstall, erase data, elevate an agent, restart Premiere or save a project. Missing Adobe software or an installer error stops before configuration; do not retry an uncertain install blindly or try another executable after Adobe has started.

Automatic discovery uses the current Windows account's %APPDATA%/Adobe/UXP/PluginsStorage/PPRO, then the exact plugin/version/channel/heartbeat layout. It does not ask for a bridge folder. Drive-qualified and UNC path layout, case-insensitive environment keys, spaces and Unicode have fixture coverage. Native network shares, redirected profiles, NTFS ACLs, reparse points and file-lock behavior remain acceptance items. Unix mode tests cannot establish Windows ACL privacy.

Client generators use the current native node.exe and absolute server path as separate arguments; spaces/backslashes survive JSON/TOML serialization. Existing client configuration must be preserved during manual merge. Source and test paths must remain on the same Windows computer/account as Premiere. WSL/Linux, remote containers and a cloud-only chat are not supported ways to launch this local Windows bridge.

File tool paths stay forward-slash relative to the deliberately approved media folder. Since 0.4.0 the panel has an optional red/green Files button for deliberate folder selection; 0.4.2 adds clear hover/press/busy feedback. This does not change the grant boundary. The Node broker rejects Windows device names, alternate streams, trailing-dot/space aliases and invalid characters, in addition to traversal, links/junctions, containment and no-overwrite checks. A successful read of a cached folder grant must not request it again; a missing grant prompts only for a real authorized file task.

## Install from PowerShell or Command Prompt

Install Git, native Node.js 22+, Creative Cloud Desktop and a supported native Windows Premiere (manifest minimum 25.6). Run Premiere normally at least once. Use a normal user terminal, not WSL, a remote container or an elevated agent. Commands below work in PowerShell and Command Prompt; if PowerShell blocks npm.ps1, use npm.cmd in place of npm rather than changing execution policy.

```sh
git clone --branch v0.4.2 --depth 1 https://github.com/ywdagency/premiere-mcp-bridge.git
cd premiere-mcp-bridge
npm ci
npm run onboard -- --release
```

The last command validates the exact official CCX/checksum against this source. It does not install or configure. If validation passes, install and generate read-only Codex configuration:

```sh
npm run onboard -- --release --install --read-only
```

Adobe may ask for installation consent. The installer uses Adobe UPIA /install, without a shell or automatic elevation. If UPIA is missing, install/repair Creative Cloud normally; do not delete an existing plugin or bypass an installer rejection. You can instead double-click the [reviewed CCX](https://github.com/ywdagency/premiere-mcp-bridge/releases/tag/v0.4.2) in Creative Cloud and run npm run setup -- --read-only in the exact source clone. Installation alone does not configure an agent.

For Claude Code use npm run onboard -- --release --install --client json --read-only and merge the returned mcpServers object into this clone's ignored .mcp.json, preserving other servers. Other local clients use the [client guide](clients.md); generated JSON must be merged into that client's configuration, and configured:false means this manual merge is still required. Do not copy another computer's paths.

In Premiere enable Developer Mode under the Plugins preferences, then open Window → UXP Plugins → Premiere MCP Bridge. Open/trust the source clone in your agent and reconnect its MCP process. If an old plugin runtime is still loaded, save your work yourself and restart Premiere when convenient; panel Reload only restarts transport. Never uninstall or remove plugin data as an upgrade shortcut.

```sh
npm run doctor
```

Success requires actual running version 0.4.2 and no missing commands. Ask your agent to list its tools (19 in read-only mode), call premiere_get_capabilities and premiere_get_project, and inspect the active sequence/clips if present. A null project/sequence is valid. Do not import, create, edit, save, export, request a media grant or revoke approval as an installation check. Never report successful connection merely because Adobe accepted the package.

## Help verify Windows

Whether it works or fails, [send a Windows test report](https://github.com/ywdagency/premiere-mcp-bridge/issues/new?template=windows_test.md). Include Windows/Node/Premiere/bridge/client versions, source tag, CCX checksum, installation method, doctor result/error code and whether the 19 tools and safe reads work. Copy only the sanitized summary; report unattempted checks as not tested. Screenshots, raw logs, configurations, owner paths, project/media names, transcripts, tokens and SID/ACL dumps can disclose private data and should stay private. For vulnerabilities use [private security reporting](../SECURITY.md), not a public issue.

The first useful contribution is the read-only installation/connection result. The deeper acceptance table below is for separately authorized disposable testing, not permission to run mutations on someone's project. Do not bypass client/OS safeguards to obtain a pass. No native Windows rows are verified by this release.

## Checks that require Windows

| Check | Required observation |
| --- | --- |
| Actual installer | Native UPIA or manual CCX accepts the reviewed package under a standard user; consent/failure behavior is recorded |
| Actual discovery | Panel heartbeat is found under the real Windows UXP data location, without folder selection; stale/multiple hosts reject |
| Agent connection | At least one real Windows agent launches native node.exe; 19 read-only/43 full tools are listed and doctor passes |
| Safe native reads | Capabilities, project, active sequence and paginated clips/ticks/timecodes work without changing selection/playback/context |
| Filesystem boundary | Per-user IPC ACLs exclude untrusted users; file symlinks/directory junctions, DOS aliases, ADS, case variants and output collisions cannot bypass containment |
| Windows paths | Test a clone/profile/media path with spaces and Unicode; separately test UNC/redirected profiles if support is intended |
| Grant and lifecycle | Actual folder consent for a disposable file task, Stop/Launch/Reload, normal restart and same-ID upgrade retain approval; explicit revocation is separately owner-authorized |
| Isolated editing | On a disposable approved project: import, create a sequence, move/trim, explicit save/export and read back results; never use the owner's working edit |
| Recovery and cleanup | Disconnect/reconnect, exact-operation recovery, locked/missing files and cancelled consent fail clearly; old receipts/config remain unchanged and test files are removed |

Run npm test on Windows as well. The Unix permission-mode case is explicitly skipped there. File-symlink creation can require Windows OS Developer Mode or privilege; the test reports that skip while still checking ordinary directory junctions. Any skip must be recorded, not reported as complete filesystem security coverage. Premiere's own Developer Mode is a separate setting.

Report Windows/Node/Premiere/plugin versions, exact source/CCX hash, actual client, doctor/tool counts, pass/fail/skip per row and test limitations. Keep owner paths, project/media names, SID/ACL dumps, tokens, raw logs and screenshots private. Fixtures prepared on a Mac are not an actual Windows result; do not describe Windows as stable or verified until the applicable native rows have evidence.

Sources checked 2026-10-31: [Adobe Premiere installation and Windows UPIA syntax](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/), [Node Windows path behavior](https://nodejs.org/api/path.html#windows-vs-posix), [Microsoft Windows filename/device rules](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file), [yauzl bounded ZIP reading](https://github.com/thejoshwolfe/yauzl). The actual Premiere storage path and native behavior still require the host check above.

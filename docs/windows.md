# Windows preparation and native acceptance

Status: Windows onboarding is prepared in the development source and tested with platform fixtures on macOS. It is not present in the immutable public v0.3.11 source tag, whose installer CLI accepts macOS only. No Windows/Premiere installation or native Windows filesystem/client behavior has been verified. The public release/feed stays unchanged until a separately reviewed release is authorized.

## What is prepared

The manifest's seven-file CCX has no OS-specific plugin binary. This source validates the archive in Node on either OS without zip/unzip, PowerShell extraction or executing downloaded contents. It checks the reviewed checksum, exact entries, duplicate/linked/encrypted entries, expanded-size bounds, consistent local/central headers, version and rebuilt bytes before invoking Adobe. The same previously reviewed macOS CCX must still match; this is not Windows host proof.

The Windows installer resolves Adobe UPIA from the standard CommonProgramFiles environment locations and invokes UnifiedPluginInstallerAgent.exe with a separate /install argument and the validated private snapshot. It does not search PATH, use a shell, uninstall, erase data, elevate an agent, restart Premiere or save a project. Missing Adobe software or an installer error stops before configuration; do not retry an uncertain install blindly or try another executable after Adobe has started.

Automatic discovery uses the current Windows account's %APPDATA%/Adobe/UXP/PluginsStorage/PPRO, then the exact plugin/version/channel/heartbeat layout. It does not ask for a bridge folder. Drive-qualified and UNC path layout, case-insensitive environment keys, spaces and Unicode have fixture coverage. Native network shares, redirected profiles, NTFS ACLs, reparse points and file-lock behavior remain acceptance items. Unix mode tests cannot establish Windows ACL privacy.

Client generators use the current native node.exe and absolute server path as separate arguments; spaces/backslashes survive JSON/TOML serialization. Existing client configuration must be preserved during manual merge. Source and test paths must remain on the same Windows computer/account as Premiere. WSL/Linux, remote containers and a cloud-only chat are not supported ways to launch this local Windows bridge.

File tool paths stay forward-slash relative to the deliberately approved media folder. There is no new panel setting. The Node broker rejects Windows device names, alternate streams, trailing-dot/space aliases and invalid characters, in addition to traversal, links/junctions, containment and no-overwrite checks. A successful read of a cached folder grant must not request it again; a missing grant prompts only for a real authorized file task.

## Running the development candidate on Windows

Use a supported native Windows Premiere installation, Creative Cloud Desktop, Git and Node.js 22+. Obtain the exact reviewed development commit from the maintainer; the v0.3.11 tag does not contain these CLI changes. Do not claim a new public Windows installer exists or switch silently to an unreviewed branch/latest asset.

In native PowerShell or Command Prompt, open that candidate clone and run:

```sh
npm ci
npm test
npm run onboard -- --release
```

The candidate still has version 0.3.11 and its plugin payload is unchanged, so --release intentionally validates the existing exact-version public CCX against the candidate build. This does not certify it for Windows. If validation passes and the owner requests installation, use:

```sh
npm run onboard -- --release --install --read-only
```

This invokes Adobe and writes only the clone's Codex configuration. For another client add the documented --client selector; its JSON is returned for a controlled manual merge, not silently configured. Adobe may ask for normal installation consent. If UPIA is absent, install/repair Creative Cloud Desktop normally; a reviewed CCX can also be double-clicked in Creative Cloud. Do not bypass an installer rejection, request admin access for the agent or delete an existing installation to force the test.

Enable Premiere Developer Mode, open Window → UXP Plugins → Premiere MCP Bridge, trust the candidate clone/client entry and reconnect its local MCP process. A stale runtime needs a normal human-controlled restart after work is saved. Then run npm run doctor; executing version, missing commands and actual calls must be checked, not inferred from Adobe's registration.

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

Report Windows/Node/Premiere/plugin versions, exact source/CCX hash, actual client, doctor/tool counts, pass/fail/skip per row and test limitations. Keep owner paths, project/media names, SID/ACL dumps, tokens, raw logs and screenshots private. Fixtures prepared on a Mac are not an actual Windows result; do not change public support claims until the native rows have evidence.

Sources checked 2026-10-31: [Adobe Premiere installation and Windows UPIA syntax](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/), [Node Windows path behavior](https://nodejs.org/api/path.html#windows-vs-posix), [Microsoft Windows filename/device rules](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file), [yauzl bounded ZIP reading](https://github.com/thejoshwolfe/yauzl). The actual Premiere storage path and native behavior still require the host check above.

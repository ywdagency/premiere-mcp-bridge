# Troubleshooting and known limits

Start with `premiere_get_capabilities` and `premiere_get_project` with `{}`. These reads do not activate or change a project. Keep Premiere idle during diagnosis. Exact installed versions matter: the manifest minimum is 25.6, while the recorded native checks use Premiere 26.5 on macOS ARM64. See [compatibility](adobe-uxp-compatibility.md) and [native evidence](live-verification-26.5.md).

| Symptom | Check and recovery |
| --- | --- |
| No `premiere_` tools in the agent | Build the checkout, check the generated absolute Node/server paths, then restart the client's MCP process. In Codex, open this clone as a trusted project so its local config is loaded. Check client MCP logs for startup errors. |
| Tools exist, but `PLUGIN_NOT_LOADED` or a timeout occurs | Open Premiere, load/install the plugin, and open its panel once. If stopped, use Launch. Panel Running means the plugin transport is ready; it does not confirm an agent process is connected. |
| Multiple active bridges are discovered | Stop the unintended plugin/host instance. `PREMIERE_MCP_HOST_VERSION` can select a major host version; it does not resolve two instances of the same major version. Avoid simultaneously loaded development and installed registrations. |
| Panel Reload does not restore missing agent tools | Reload restarts only the plugin transport. Restart/reconnect the MCP server in the client if its external Node process exited. |
| Changed code or manifest is not visible | Rebuild first. Use UDT Reload for JavaScript; manifest changes require UDT Unload/Load. These are different from the panel's transport Reload. Actual plugin unload loses session ownership and handles. |
| Project or active sequence is null | Open the intended project/sequence manually. Inspection does not choose one for you. |
| A file request returns `MEDIA_FOLDER_REQUIRED` | The valid request triggered a native folder dialog and stopped before file I/O. Approve the intended folder, then issue a new request. A write with this confirmed preflight rejection needs a new UUID. Cancellation leaves access denied. |
| `WRITES_DISABLED` or write tools are absent | Check that the plugin is running. `PREMIERE_MCP_READ_ONLY=1` omits write tools in the server; change that configuration and restart its process only when editing is intended. There is no separate Enable Editing control. |
| A source sequence or asset is protected | Use a fresh verified BACKUP/WORK chain. Exact human-requested in-place edits can use the documented verified-backup authorization; never infer permission from a saved WORK name after unload. Retained backups and shared media remain protected. |
| A handle or clip precondition is stale | Read fresh context and clip boundaries. Handles expire or invalidate after affected writes and actual plugin unload. Panel transport Reload preserves them. |
| A write times out or reports an unknown outcome | Recover with the identical operation ID and arguments. Inspect its receipt and host state. Never repeat it under a new UUID just because the response was lost. |
| A documented API is missing | Search/describe the exact member and probe the connected runtime. Catalog presence and minimum-version metadata are not native behavior tests. |
| A job reports success but no finished movie appears | Some EncoderManager Promises confirm queue acceptance. Inspect native render events/AME state. Unload does not cancel queued work. Do not resubmit an unknown job. |

For a minimal transport check, `npm run mcp:smoke -- --metadata-only` reads capabilities, project and active-sequence metadata without clip enumeration. It does not edit or save, but prints project metadata: keep its raw output private. A successful stdio handshake alone does not prove Premiere is reachable. The [client guide](clients.md) explains configuration and reconnecting.

## Known issues and unsupported claims

Installed/executing 0.3.8 is verified on macOS Apple Silicon / Premiere 26.5. Native checks cover batch imports and recovery, backups/edits, markers, effect animation and explicit source authorization/revocation. Versioned 0.3.7 checks cover persistence and clean lifecycle. A fresh source/dependency/client checkout plus same-user official installation and SDK reads also pass; this is distinct from a pristine new Mac and from dedicated sessions in every client app. See [current evidence](release/final-review-0.3.8.md).

Windows discovery code exists but has no recorded Windows Premiere verification. The 25.6 baseline is a version gate, not a claim of every-feature testing on that host. Installer registration does not itself establish executing JavaScript; compare doctor/capabilities with the checkout version. A public release download is not available while the release is draft/unpublished.

In Premiere 26.5, `TickTime.timeToTimecode`, `TickTime.timecodeToTime` and `new MogrtText` were absent despite older Since labels. Convenience clip tools use Node timecode formatting. Read the current [machine-readable evidence](../data/live-verification.json) before describing support.

Single-item move/trim tools do not coordinate linked audio/video, ripple or move between tracks. Convenience trim supports inward edits of forward 1x clips. Generic native actions have their own semantics. Exact ticks are integer strings; source In/Out are relative to the project item, not embedded media timecode. See [clip timing](clip-inspection.md).

Global preferences/cache operations, dirty-close choices, AME queue submission, transcription, scene detection, MOGRT insertion, preset creation and every effect/codec have not all been live-tested. Native output preflight is not an atomic no-overwrite guarantee. Keep granted folders trusted. Concurrent manual editing can invalidate reads; a saved operation receipt must never be used to restore an old source snapshot.

Import diagnostics include original host exception text and can expose file paths or names to the client and its logs. Sanitize both the outer error and nested diagnostics before sharing.

Report a reproducible problem using the repository's bug template, with versions, a sanitized error code and synthetic reproduction data. Exclude real projects, media, paths, transcripts and raw logs. Use [private reporting](../SECURITY.md) for security findings.

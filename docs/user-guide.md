# Use Premiere MCP Bridge

The plugin connects Premiere to a local AI client. You give the client a task in ordinary language; the client discovers MCP tools and calls them. The Premiere panel controls the bridge connection. It is not a chat window, and it does not contain an automatic editing policy.

## Install and make the first connection

Follow [installation](installation.md) for the exact reviewed version. You need macOS, Node.js 22+, Creative Cloud Desktop, Premiere and a local MCP-capable client. Adobe and the AI client have their own accounts/licensing. This preview was natively checked on Premiere 26.5 / Apple Silicon; other configurations are not collectively verified.

Install the matching CCX through the documented CLI, enable Premiere Developer Mode, then open Window → UXP Plugins → Premiere MCP Bridge. Open/trust the source clone in Codex and reconnect its MCP process; other clients merge the JSON described in [client setup](clients.md). The server runs on the same computer and user account as Premiere. No bridge URL, API key or connection folder is needed.

Start with the documented --read-only installation/configuration. After opening the panel, run npm run doctor from that clone. A passing doctor confirms executing version and connection, not every editing operation.

Example first prompt:

> Check the bridge and Premiere versions, then tell me whether a project and active sequence are open. Do not edit, activate, export or save anything.

Example inspection prompt:

> Read the active sequence and its clips, including every required page. Summarize the tracks and exact timeline positions. Do not request media paths or change the timeline.

## Panel and client controls

| Control | What it does |
| --- | --- |
| Stop | Blocks bridge access and clears the external-file grant. |
| Launch | Resumes the plugin transport with editing available. It does not launch Premiere or the AI client. |
| Reload in the plugin panel | Restarts transport and preserves session handles, jobs, working ownership and receipts. It does not load newly installed JavaScript or refresh the client's tool list. |
| Reconnect/restart MCP in the client | Starts the client's server process again and refreshes tools/configuration. |
| npm run doctor | Reads the executing version and basic project context. A version mismatch means setup is unfinished. |

The panel's Running state means the plugin transport is ready; it does not prove that a particular agent is connected. After a CCX upgrade, an older loaded JavaScript runtime may need a normal owner-controlled Premiere quit/reopen. Save work yourself before restarting. See [troubleshooting](troubleshooting.md).

## Enable an editing workflow

An inspection-only server omits write tools. When ready to edit, run npm run setup from the same clone and reconnect the client; no plugin reinstall is needed to change this client mode. Return to inspection-only with npm run setup -- --read-only and reconnect again. Other client generators accept the same flag and return configuration for manual merge.

Name the intended sequence and describe the result. Normal edits should preserve the input, a separate verified BACKUP and a separate WORK copy. Ask the agent to inspect the current timeline, verify the backup independently and report the result. Do not edit the same project concurrently with the agent; a context-change rejection is a reason to inspect current state, not restore an old snapshot.

Example editing prompt, to submit only when you intend an edit:

> From the active sequence, create and verify a separate BACKUP and a WORK copy. On WORK, move the first video clip and its corresponding audio one frame later, preserving their alignment and source ranges. Verify the result and keep both originals. Do not save the project.

Move/trim convenience tools affect one track item at a time and do not automatically synchronize linked A/V or ripple other clips. The agent must inspect and handle all intended counterparts. Broader native actions have their own documented semantics.

Existing-source edits require your explicit instruction for that exact sequence and a verified direct backup created in the current session. The agent can grant that limited permission with premiere_authorize_sequence and revoke it with premiere_revoke_sequence_authorization. This does not permit deleting the source or changing shared media. Copies/authorizations are session-scoped; a saved WORK name is not permission after plugin unload.

## Files, saves and exports

Connection alone does not need a folder. A deliberate import/output operation needs a separate native media-folder approval. The agent can inspect the existing grant with premiere_get_file_access; it requests its private path only when needed. Approve the intended working folder in Adobe's dialog. Commands use paths relative to that folder and still validate each file. Do not grant an entire disk just to connect.

There is no folder/path setting in the panel. An agent should reuse an existing approval and determine its path itself. The saved project's folder can be the preferred destination when it is inside the approved folder, but saving a project there does not itself grant the plugin file access. With no existing approval, a deliberate file request opens Adobe's native dialog; ordinary timeline work does not need it.

Saving is a separate instruction. For example: “Save this exact project now; keep all backups.” Saves persist current manual changes too. Export/transcription/analysis jobs are also separate requests with file/preset/host requirements. A queued job is not always a finished render, and reloading the plugin does not cancel Adobe/AME work.

## If a command fails

If the client has no tools, inspect its configuration/trust and reconnect it. If tools report PLUGIN_NOT_LOADED, check Premiere, the installed panel and Launch. If doctor reports a version mismatch, compare the source/installer/running versions rather than choosing a folder or changing permissions.

After a write timeout, tell the agent to recover the identical request/operation ID and inspect the outcome. A new ID is a new operation and can duplicate work. Do not repeatedly ask it to retry an unknown edit or import. Existing-source protection, stale context and unsupported API errors are documented in [troubleshooting](troubleshooting.md).

For a public bug report, include versions, the tool/error code and a synthetic reproduction. Remove personal paths, names, transcripts and raw logs. Security reports use [SECURITY.md](../SECURITY.md), not public issues. The preview's [verification scope](release/final-review-0.3.8.md) is separate from catalog coverage.

## Updates

There is no automatic updater. Choose a reviewed published version, check out its matching source tag, install its dependencies and run the documented onboard validation before --install. Regenerate the client configuration and reconnect after an update or moving the clone. Preserve receipts, your projects and retained backups. Never mix an old source checkout with a newer CCX or silently install a floating latest binary.

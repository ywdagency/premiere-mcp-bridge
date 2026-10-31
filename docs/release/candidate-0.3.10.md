# Candidate0.3.10 — remembered folder approval

This local, unpublished candidate keeps a previously approved folder/token when Stop is pressed, restores the same persistent storage key on startup/Launch/Reload, and supplies premiere_forget_file_access for explicit revocation. It adds no panel controls and retains localFileSystem:request, plugin identity and all per-file Entry/Node checks.

It exposes 43 full MCP tools (40 host commands) or 19 read-only tools. The new revoke command requires an active project, confirm:true and operation UUID, changes only plugin permission state and does not save/edit/delete files or cancel native jobs. Completed UUID recovery does not repeat revocation against a later grant.

Restoration never opens a picker. If a token cannot resolve, it remains stored for later recovery; an actual file operation can request a replacement. Stop/forget invalidate late in-flight picker/restore results. An executing 0.3.8 runtime cannot gain this behavior through panel transport Reload alone.

Local tests exercise the actual compiled bundle with synthetic UXP storage. These are not proof of native Adobe update dialogs, persistent storage on another Mac or executing 0.3.10 in Premiere. Keep the published 0.3.8 tag/assets unchanged. To test the local candidate, validate its reviewed CCX/checksum against this exact built checkout before explicit installation; then use an owner-controlled runtime activation and doctor. No public 0.3.10 release exists; onboard --release must fail rather than fall back to 0.3.8.

## Local verification and installation

All 167 local tests pass. The production-bundle lifecycle tests include an immutable published 0.3.8 bundle followed by this candidate, sharing the same saved token and approved folder; a text read after restoration passes both Entry and Node checks without another picker. This is simulated UXP/VM upgrade evidence, not a native Adobe restart/update proof.

Adobe UDT 2.3.0 offline packaging produced the seven-file CCX; onboard verifies the exact rebuilt payload and request-only permissions. SHA-256: c25f644a33bc8a97763b119bcdf5f7f1e8b8d082f668dca79510b4a5ceeceaaf. Adobe UPIA confirms 0.3.10 installed/enabled; all 663 existing completed operation receipts remain byte-identical. The post-install MCP read still executes 0.3.8, so live activation and native Stop/Launch persistence remain pending. No project/timeline changes, hidden restart, public release or Actions run occurred.

For owner-controlled activation, save work and fully quit Premiere and UDT, then reopen Premiere and its installed panel. Close the old runtime normally: its Stop button still clears remembered file approval. Reconnect the client to the matching source/configuration and run doctor; require executing 0.3.10 before using the new revoke command. Do not uninstall/delete plugin data as an upgrade step.

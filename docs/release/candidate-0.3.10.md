# Local 0.3.10 verification — remembered file approval

Status: installed and executing on the reference Mac, not publicly released. The public preview remains v0.3.8. This build exposes 43 full MCP tools (40 host commands) or 19 inspection-only tools.

## Behavior and boundaries

Stop suspends transport while retaining the approved folder/token. Startup, Launch, Reload and normal same-ID updates restore the existing storage key without a picker. Restoration failure retains the token for a later attempt; only an actual file operation can request replacement approval. Stop and explicit forgetting invalidate late picker/token/restore results.

premiere_forget_file_access revokes remembered approval only after a human request, with confirm:true, the exact active projectId and an operation UUID. It adds no panel setting, file deletion, timeline edit, implicit save or cancellation of submitted Adobe jobs. Receipt replay does not revoke a later newly approved folder. The plugin identity and localFileSystem:request permission remain unchanged, with both Entry and current-request Node checks on file operations.

## Evidence

All 167 automated tests passed. Production-bundle lifecycle tests cover Stop/Launch, restart, invalid/transient tokens, explicit revocation and late asynchronous completion. A separate run uses the immutable published 0.3.8 bundle before this version, sharing the same saved token/root; a text read after restoration passes Entry and Node checks without another picker. This is VM/synthetic-storage upgrade evidence, not an Adobe first-install dialog test.

Adobe UDT 2.3.0 offline packaging produced the seven-file CCX; onboard verified the exact rebuilt payload and request-only permissions. SHA-256: c25f644a33bc8a97763b119bcdf5f7f1e8b8d082f668dca79510b4a5ceeceaaf. Adobe UPIA confirmed installation/enabled status, preserving all 663 existing completed receipts byte-identically.

After the owner restarted Premiere and reconnected MCP, live read-only capabilities reported executing 0.3.10/all 40 expected host commands. Doctor passed with no missing commands; project and active-sequence reads passed. File-access diagnostics returned granted:true, pathIncluded:false and approvalRequiredOnFileRequest:false, with no picker or host write from this check. The saved approval was present after the real installation/restart transition.

Native Stop/Launch itself was not automated; its race/retention behavior is covered by bundle tests. The host advertised the new forget command, while the current chat's tool catalog had not exposed it at verification time; clients must reconnect to the matching Node source/profile. Do not claim every client or a pristine new Mac was tested, or relabel the 0.3.8 editing tests as a full 0.3.10 native regression.

## Installation identity

Validate the reviewed local CCX/checksum against this exact built checkout before explicit installation. No public 0.3.10 release exists, so onboard --release must fail instead of falling back to 0.3.8. Preserve plugin data/identity during an update, then confirm the executing version through doctor. When upgrading from 0.3.8, close that runtime normally: its old Stop still clears approval. An uninstall, moved folder or Adobe/OS invalidation can require renewed consent.

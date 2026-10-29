# Premiere MCP Bridge 0.3.4 — first public preview draft

Status: unpublished copy for owner review, aligned with merged source version 0.3.4. Verify the tag, commit and attached installer before publishing.

Premiere MCP Bridge by YWD Agency connects local MCP-compatible AI agents to Adobe Premiere through a UXP plugin and Node stdio server. Inspect a project, read timeline metadata and perform explicit operations on bridge-created working sequences with the AI client you choose.

## Included in this preview

The current implementation exposes 33 MCP tools, including project/sequence/clip inspection, working-copy creation and bounded clip operations, plus a typed native adapter. Search and describe a pinned official Adobe DOM catalog offline, resolve opaque native handles, apply scoped action batches and inspect supported job/event outcomes. The catalog contains 73 types and 707 entries; it is broader than executable or live-tested behavior.

Automatic local discovery removes the connection-folder setup. Editing is available while the plugin runs. Stop revokes access; Launch resumes; panel Reload restarts transport while retaining session ownership and records. The compact panel reports plugin transport state and version. It cannot confirm or restart the client's Node process.

Source sequences and shared source assets retain ownership protection. Writes require the active project identity and a caller-generated operation UUID; durable receipts support recovery without blind replay. External files require an on-demand native folder grant and current-request path checks. No implicit project saving or arbitrary code execution is exposed.

Version 0.3.4 includes bounded original import-failure diagnostics and the tested source-item ownership and job-preflight fixes. Diagnostic messages may contain private host paths or filenames and must be sanitized before public sharing.

English-only onboarding, documented Codex/Claude Desktop/Cursor/VS Code configuration paths, troubleshooting, API/architecture guidance and contributor templates accompany the preview. See [the README](../../README.md) for source installation and the first read-only command. A CCX, if attached after verification, installs the Premiere plugin only; the Node server/client configuration are separate.

## Tested scope and known limits

The merged 0.3.4 source passes all 105 automated tests, including build, real filesystem IPC and MCP SDK stdio with host fixtures. All four main-branch CI jobs passed on macOS/Ubuntu with Node 22/24. The setup generators and a production-dependency archive were checked separately. Native evidence comes from Premiere 26.5/macOS ARM64 and identifies each actual build. The 0.3.4 installer is recorded as installed, but current capabilities still report 0.3.3; activation and live import-diagnostics verification remain pending. Cold startup and the completed external-folder dialog are not certified by these automated checks.

The manifest minimum is Premiere 25.6; Node.js 22+ is required. Windows Premiere remains unverified. Claude Desktop, Cursor and VS Code configuration was checked against official documentation, with end-to-end client sessions still pending. Every Adobe API, export format, codec, effect and host version is not claimed supported.

Some documented APIs are absent in Premiere 26.5. Single-clip move/trim does not synchronize linked audio/video. Native jobs may outlive plugin unload, and AME queue acceptance is not render completion. File preflight is not filesystem-atomic no-overwrite protection. Keep Premiere idle during commands and recover uncertain writes with the original UUID/payload. See [known limits](../troubleshooting.md) and [native evidence](../live-verification-26.5.md).

The bridge has no cloud relay or telemetry service; tool results still reach the selected AI client and its provider. [Security/data handling](../../SECURITY.md) explains the boundary. Bridge code is [MIT](../../LICENSE); bundled Adobe reference material retains [Apache-2.0](../../data/ADOBE-LICENSE.txt) and its copyright notice. This is an independent YWD Agency project, not an Adobe product or Marketplace release.

## Feedback

Use the repository bug/feature templates with synthetic reproduction data, exact versions and sanitized errors. Do not attach private projects, media, transcripts, absolute paths or raw diagnostic dumps. Security findings need the private reporting route described in [SECURITY.md](../../SECURITY.md).

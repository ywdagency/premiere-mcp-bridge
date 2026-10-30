# Premiere MCP Bridge 0.3.7 — source preview candidate

Status: unpublished draft. This patch adds read-only diagnostics for the existing file-folder grant, including opt-in native-path disclosure. Its installer/runtime and disposable native workflows still require verification; do not describe it as a tested public installer release.

Premiere MCP Bridge by YWD Agency connects local MCP clients to Adobe Premiere through a UXP plugin and Node stdio server. Use the agent you choose to inspect a project and request explicit edits. Start with [source installation](../../README.md) and [client configuration](../clients.md).

## Included

The candidate exposes 42 MCP tools: 39 bridge/native commands and three offline reference tools. The pinned Adobe DOM catalog contains 73 types and 707 entries, with a per-member matrix separating execution routes from native evidence. Catalog or routing coverage does not mean every native workflow works.

Existing sequences can be explicitly authorized for one plugin session after a directly cloned, independently verified backup. Revocation removes permission; retained backups, original deletion and shared source media remain protected. Working copies remain the default editing route. Neither authorization nor an import implicitly saves the project.

Six new named adapters support selected/all After Effects composition import, selected/all project sequence import, project close, sequence-tab close and growing-media refresh pause. They require exact project identity and a write UUID, return pollable jobs and grant no imported-content edit ownership. Project close preserves native dirty/Cancel prompts: a human may choose Save in that prompt. Typed `OpenProjectOptions` drafts preserve caller-selected open behavior. These new workflows await native verification.

Import diagnostics preserve bounded original native exception details, which may contain private names or paths. Automatic local discovery, Stop/Launch and transport-only Reload remain available. English onboarding, Codex/Claude Desktop/Cursor/VS Code generators, recovery guidance and licensing notices accompany the source.

## Verification and limits

Automated tests cover strict Node/UXP contracts, backup and source protection, project-job recovery, real filesystem IPC, actual SDK stdio, setup generation and the seven-file release stage. Tests use host fixtures. See [candidate audit](public-readiness.md) and the candidate branch's checks for exact evidence.

The earlier 0.3.6 runtime has confirmed activation, doctor, protected reads and exact-time checks on Premiere 26.5/macOS Apple Silicon. These are separate from the new 0.3.7 payload. Its installation/activation, native file diagnostics and disposable import/edit/save/export scenarios remain pending. See [current status](candidate-0.3.7.md) and the versioned [live report](../live-verification-26.5.md).

The manifest minimum is Premiere 25.6 and Node.js 22+ is required. Windows Premiere and dedicated Claude Desktop/Cursor/VS Code application sessions remain unverified. Some catalog members are unavailable in 26.5. Single-item move/trim does not synchronize linked audio/video; native queue acceptance does not prove a completed render. File preflight does not guarantee atomic no-overwrite. Recover uncertain writes with the original UUID and identical payload.

No cloud bridge, telemetry service, arbitrary JavaScript, shell, QE or ExtendScript endpoint is exposed. Tool outputs still reach your selected AI client/provider; review [security/data handling](../../SECURITY.md). Use synthetic data and sanitized diagnostics for public feedback. Report vulnerabilities privately to the contact in SECURITY.md.

Bridge code is MIT; bundled Adobe reference material retains its Apache-2.0 license and copyright. This is an independent YWD Agency project, not an Adobe product or Marketplace listing. No release assets, tag or public release have been published by this preparation.

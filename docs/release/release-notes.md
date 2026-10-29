# Premiere MCP Bridge 0.3.6 — source preview candidate

Status: unpublished draft. Candidate 0.3.6 is locally tested and prepared for review; the CCX is installed, but actual JavaScript activation and native verification remain pending. Do not describe this as a tested installer release.

Premiere MCP Bridge by YWD Agency connects local MCP clients to Adobe Premiere through a UXP plugin and Node stdio server. Use the agent you choose to inspect a project and request explicit edits. Start with [source installation](../../README.md) and [client configuration](../clients.md).

## Included

The candidate exposes 41 MCP tools: 38 bridge/native commands and three offline reference tools. The pinned Adobe DOM catalog contains 73 types and 707 entries, with a per-member matrix separating execution routes from native evidence. Catalog or routing coverage does not mean every native workflow works.

Existing sequences can be explicitly authorized for one plugin session after a directly cloned, independently verified backup. Revocation removes permission; retained backups, original deletion and shared source media remain protected. Working copies remain the default editing route. Neither authorization nor an import implicitly saves the project.

Six new named adapters support selected/all After Effects composition import, selected/all project sequence import, project close, sequence-tab close and growing-media refresh pause. They require exact project identity and a write UUID, return pollable jobs and grant no imported-content edit ownership. Project close preserves native dirty/Cancel prompts: a human may choose Save in that prompt. Typed `OpenProjectOptions` drafts preserve caller-selected open behavior. These new workflows await native verification.

Import diagnostics preserve bounded original native exception details, which may contain private names or paths. Automatic local discovery, Stop/Launch and transport-only Reload remain available. English onboarding, Codex/Claude Desktop/Cursor/VS Code generators, recovery guidance and licensing notices accompany the source.

## Verification and limits

Automated tests cover strict Node/UXP contracts, backup and source protection, project-job recovery, real filesystem IPC, actual SDK stdio, setup generation and the seven-file release stage. Tests use host fixtures. See [candidate audit](public-readiness.md) and the candidate branch's checks for exact evidence.

The installed 0.3.5 runtime has confirmed activation and MCP reads on Premiere 26.5/macOS Apple Silicon. Its explicit authorization/content behavior is not live-verified. Candidate 0.3.6 passed final CCX archive inspection and official installation. MCP still reports the older 0.3.5 runtime; cold startup/identity confirmation, native folder approval/cancellation, safe synthetic import and the assisted native scenarios remain pending. Earlier native checks are recorded by their actual versions in [the live report](../live-verification-26.5.md).

The manifest minimum is Premiere 25.6 and Node.js 22+ is required. Windows Premiere and dedicated Claude Desktop/Cursor/VS Code application sessions remain unverified. Some catalog members are unavailable in 26.5. Single-item move/trim does not synchronize linked audio/video; native queue acceptance does not prove a completed render. File preflight does not guarantee atomic no-overwrite. Recover uncertain writes with the original UUID and identical payload.

No cloud bridge, telemetry service, arbitrary JavaScript, shell, QE or ExtendScript endpoint is exposed. Tool outputs still reach your selected AI client/provider; review [security/data handling](../../SECURITY.md). Use synthetic data and sanitized diagnostics for public feedback. Report vulnerabilities privately to the contact in SECURITY.md.

Bridge code is MIT; bundled Adobe reference material retains its Apache-2.0 license and copyright. This is an independent YWD Agency project, not an Adobe product or Marketplace listing. No release assets, tag or public release have been published by this preparation.

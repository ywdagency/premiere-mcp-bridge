# Release candidate 0.3.8

This unpublished Premiere-only candidate retains 42 MCP tools, 39 host commands and 19 read-only tools. It fixes overlapping UXP file-proof lifecycles and rejects sparse marker argument prefixes before native calls. Automatic connection, the compact panel, request-only filesystem permission, source protection and exact-UUID recovery remain intact.

The [0.3.8 regression report](native-check-0.3.8.md) confirms actual activation, ten-file import, protection/recovery, backups/edit/marker checks and readable outputs. Node defaults to a 30-second budget; the matching-source CCX is unchanged by Node-only recovery improvements.

The [0.3.7 native report](native-check-0.3.7.md) records genuine isolated project creation, individual imports, verified backups, move/trim, full-argument markers, Save/Save As, selected sequence import, clean lifecycle, ownership protection and readable XML/OTIO outputs. Batch preflight failed before import. The [0.3.8 patch](candidate-0.3.8.md) is installed, activated and the native batch regression passes. A complete 707-entry or visual/audio certification is not claimed.

## Preparation and installation

Use Node.js 22+ in the reviewed source checkout:

```sh
npm ci
npm test
node scripts/stage-release.mjs
npm pack --dry-run --json
```

The staging helper checks source/build version identity and copies exactly seven allowlisted plugin files to artifacts/release/0.3.8/plugin with SHA-256 inventory. Package that staged manifest with Adobe UDT's supported packaging implementation, inspect the actual CCX and validate it through onboard before explicit installation. A CCX installs only the plugin; the Node server and client setup are separate. Follow [installation](../installation.md) and [agent quickstart](../agent-quickstart.md). No tag or downloadable release exists yet; never invent published assets.

## Gates

| Gate | Status |
| --- | --- |
| Strict contracts, proof queue, early marker validation | Implemented; final automated checks recorded in candidate evidence. |
| Exact 0.3.8 CCX/hash and disclosure audit | Verified seven-file payload; final source/npm/history disclosure checks recorded separately. |
| Official install and actual executing 0.3.8 | Enabled installation and actual runtime/doctor confirmed. |
| Maximum batch, failed-request queue release and marker guard | Native tests pass with the 30-second Node budget. |
| Positive explicit authorization, dirty prompt choices, preset/MOGRT/transcription/AME fixtures | Not native-verified by this run; keep their limits explicit. |
| Other clients, Windows host, visual/audio/interchange fidelity | Unverified beyond documented fixture/structural checks. |
| Exact-head CI, public protections, publication | Recheck CI; public visibility, merge, tag/assets and release need the owner's decision after native gates. |

Keep raw projects, paths, receipts and run files private. Retain backups and saved synthetic results. No AE operation, owner-project save, global cache/preference change, existing AME queue work, arbitrary-code endpoint or automatic updater is part of preparation. Historical [0.3.6 audit](public-readiness.md) and [CLI report](onboarding.md) retain their original scopes.

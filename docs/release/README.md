# Release candidate 0.3.7

This unpublished Premiere-only patch adds non-prompting file-access diagnostics to the verified CLI onboarding path. The source exposes 42 tools (39 host commands and three offline reference tools), or 19 in read-only mode. It preserves automatic connection, the lifecycle-only panel, request-only filesystem permission and per-file Entry/Node checks. See [current patch status](candidate-0.3.7.md).

The owner activated the earlier 0.3.6 build; doctor and bounded native read/time checks pass for that exact payload. Those results are recorded in the [0.3.6 report](native-check-0.3.6.md). They do not certify the new 0.3.7 payload or native write behavior. The [historical onboarding audit](onboarding.md) and [historical readiness audit](public-readiness.md) retain their original versions and checksums. A new 0.3.7 installer/hash and runtime check are required before its fixture workflows can proceed.

## Review materials

| Material | Source |
| --- | --- |
| Install from source and connect an agent | [README](../../README.md), [client setup](../clients.md) |
| Exact contracts, coverage and limits | [Commands](../commands.md), [native API](../native-api.md), [API expansion](../api-expansion.md) |
| Native evidence and remaining scenarios | [Live report](../live-verification-26.5.md), [assisted verification plan](../live-test-plan.md) |
| Source/package disclosure audit | [Candidate readiness](public-readiness.md) |
| Distribution copy | [Release notes](release-notes.md), [positioning](positioning.md), [synthetic demo](demo.md) |
| Data, vulnerability reports and licensing | [Security](../../SECURITY.md), [third-party notices](../third-party-notices.md) |
| Historical clean-history migration | [0.3.4 migration audit](migration-0.3.4.md) |

## Reproducible preparation

Use Node.js 22+ from a fresh source checkout:

```sh
npm ci
npm test
node scripts/stage-release.mjs
npm pack --dry-run --json
```

CI runs the same build/tests, plugin staging and npm inventory on macOS/Ubuntu with Node 22/24. The staging helper checks package/manifest/built-protocol identity, copies exactly seven plugin files to `artifacts/release/0.3.7/plugin`, and records relative-path SHA-256 hashes beside it. A missing/mismatched built identity is rejected. Existing stages are never overwritten. It does not install, launch, reload, save or publish anything.

Build a CCX with Adobe's UXP Developer Tools Package operation against that staged manifest, then inspect the actual archive and its generated metadata. Do not package the repository root or load a duplicate plugin ID. Keep the stable installation ID for upgrades. Adobe recommends UDT packaging; see [Adobe's package guide](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/). This project makes no Marketplace, signing or notarization claim.

A CCX installs only the UXP plugin. The local Node server and client configuration are separate. The documented source checkout is the reproducible route because GitHub source archives exclude ignored builds, and an npm review tarball does not include a lockfile for `npm ci`. Keep `package.json` private; npm publication is not part of this release.

## Remaining release gates

| Gate | Status |
| --- | --- |
| 0.3.7 identity, strict file diagnostics and documentation | Prepared; record the final full-suite and CI results for the exact head. |
| Exact seven-file 0.3.7 CCX/checksum and disclosure audit | Required; earlier 0.3.6 assets are a different payload. |
| Official installation and executing 0.3.7 command inventory | Required; earlier executing runtime was 0.3.6. |
| Native diagnostic with restored grant, UDT-closed launch, native approval/cancel | Pending assisted verification; never infer a pass from fixtures. |
| Disposable import, edits/backups, authorization/recovery, saves/lifecycle/exports | Pending isolated native workflows. |
| All client applications and Windows Premiere | Unverified; generator/stdio tests are narrower evidence. |
| Public visibility, protections, tag/assets and release | Await completed native evidence and explicit owner instruction. |

Keep raw host evidence private. No merge, public visibility, tag, upload, npm publication or automatic updater is part of preparation. The [assisted plan](../live-test-plan.md) is not blanket permission for private-project, AE or destructive global operations.

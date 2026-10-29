# Release candidate 0.3.6

This is an unpublished source-preview candidate for `ywdagency/premiere-uxp-bridge`. The repository remains private. Package, lockfile, manifest and runtime identity agree on 0.3.6. The candidate combines explicit sequence authorization from 0.3.5 with six new project import/lifecycle adapters, typed project-open options and the per-member verification matrix. The installed 0.3.5 runtime is a different build: its activation and MCP reads are recorded, while its sequence-authorization behavior remains unverified.

Automated fixture, real filesystem IPC and SDK stdio checks cover this candidate. They do not establish native Premiere behavior. Candidate 0.3.6 has not been installed or run in Premiere. Historical native checks retain their original build versions in [the live report](../live-verification-26.5.md).

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

CI runs the same build/tests, plugin staging and npm inventory on macOS/Ubuntu with Node 22/24. The staging helper checks package/manifest/built-protocol identity, copies exactly seven plugin files to `artifacts/release/0.3.6/plugin`, and records relative-path SHA-256 hashes beside it. A missing/mismatched built identity is rejected. Existing stages are never overwritten. It does not install, launch, reload, save or publish anything.

Build a CCX with Adobe's UXP Developer Tools Package operation against that staged manifest, then inspect the actual archive and its generated metadata. Do not package the repository root or load a duplicate plugin ID. Keep the stable installation ID for upgrades. Adobe recommends UDT packaging; see [Adobe's package guide](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/). This project makes no Marketplace, signing or notarization claim.

A CCX installs only the UXP plugin. The local Node server and client configuration are separate. The documented source checkout is the reproducible route because GitHub source archives exclude ignored builds, and an npm review tarball does not include a lockfile for `npm ci`. Keep `package.json` private; npm publication is not part of this release.

## Remaining release gates

| Gate | Status |
| --- | --- |
| Version, English onboarding, client generators, contracts and automated tests | Prepared for this candidate; see the audit. |
| Minimal plugin stage and npm source/runtime package | Audited separately; neither is an installed CCX. |
| Candidate branch and four-platform/version CI | Required for the exact pushed candidate; inspect its latest checks. |
| Final CCX archive and installed 0.3.6 identity | Pending; preserve durable receipts and avoid interrupting manual work. |
| UDT-closed launch, cold startup, folder approval/cancel, synthetic import | Pending assisted verification. |
| Explicit sequence authorization/revocation and six new project adapters | Pending native tests using disposable synthetic projects. |
| All client applications and Windows Premiere | Unverified; generator/stdio tests are narrower evidence. |
| Public visibility and applicable GitHub protections | Await owner instruction; recheck available controls before changing visibility. |
| Tag, release assets and publication | Await final native evidence and explicit owner instruction. |

The [live plan](../live-test-plan.md) includes native close/save prompts, import partial outcomes and jobs that may outlive plugin reload. It is a plan, not permission to execute it. Keep final artifacts tied to the reviewed commit, record their checksums and promote only sanitized actual evidence. Public visibility, merging, tagging and release publication have not been performed by this preparation.

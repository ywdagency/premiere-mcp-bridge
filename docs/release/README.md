# Release verification and maintenance

Local candidate: [0.4.1 folder-access panel](candidate-0.4.1.md), not published or natively activated. The candidate stages eight files, including the Figma folder SVG; released 0.3.12 has seven.

The current preview is [v0.3.12](https://github.com/ywdagency/premiere-mcp-bridge/releases/tag/v0.3.12), adding experimental Windows onboarding and portable CCX validation. It exposes 43 MCP tools or 19 in read-only mode. Windows has no native verification yet. Local tests/package validation are separate from the earlier native macOS 0.3.11 and editing reports; see [0.3.12 scope](candidate-0.3.12.md).

## Evidence

| Report | Verified scope |
| --- | --- |
| [0.3.12](candidate-0.3.12.md) | Local automated/package checks; Windows experimental and no native 0.3.12 regression |
| [0.3.11](candidate-0.3.11.md) | Exact installer/source/installed payload, native connection, restored grant and update check |
| [0.3.10](candidate-0.3.10.md) | Persistent folder approval, bundled lifecycle/upgrade tests, installation and real runtime/restored-grant reads |
| [0.3.8](native-check-0.3.8.md) | Maximum-size batch, denial/recovery, backups, edits, markers, effects/keyframes, explicit source authorization/revocation and readable interchange outputs |
| [0.3.7](native-check-0.3.7.md) | Synthetic creation/import/edit, saves, lifecycle and interchange checks; batch defect that prompted 0.3.8 |
| [0.3.6](native-check-0.3.6.md) | Exact installer/runtime identity and bounded native read/time checks |
| [Fresh-checkout/disclosure review](final-review-0.3.8.md) | Versioned installation, package/privacy and client evidence, with explicit pristine-machine limits |

Use [per-member observations](../live-verification-26.5.md), the pinned matrix and the [live test plan](../live-test-plan.md) for deeper coverage. Fixture, catalog, runtime-presence and successful native behavior are different evidence. These reports do not certify every API member, client, platform or visual/audio result.

## Prepare a reviewed build

```sh
npm ci
npm test
node scripts/stage-release.mjs
npm pack --dry-run --json
```

The staging helper checks source/build version identity and copies exactly the current allowlisted plugin/runtime/license/asset files into a new versioned snapshot. It refuses to overwrite an existing stage. Package that staged manifest with Adobe's supported UDT packaging implementation; keep proprietary packager files outside the repository/package. Validate the resulting CCX and trusted SHA-256 through onboard before explicit installation. The CCX installs only the plugin; the source provides the Node server and client setup. Follow [INSTALL.md](../../INSTALL.md) and [installation](../installation.md).

Preserve the plugin ID, saved token storage and durable receipts during updates; never uninstall or delete plugin data as a shortcut. Confirm the executing version through doctor after owner-controlled activation. Do not use an owner's working timeline as an installation test. Record native tests only on an explicitly authorized disposable fixture, retaining backups and exact-UUID recovery.

## Publish only when authorized

Use the [publication procedure](publish-checklist.md) for source/tag/asset identity, privacy review, anonymous downloads and remote settings. A local code change or successful check does not authorize a public release. Respect the owner's current Actions restrictions; skipped/disabled checks are not passing CI. Internal task logs, superseded preparation notes and promotional drafts are kept outside the tracked documentation. Git retains their history.

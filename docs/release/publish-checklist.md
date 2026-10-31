# Publication handoff — 0.3.8

This is a maintainer checklist, not authorization to publish. Current preparation keeps the repository private and the release draft unpublished. Do not merge, create a tag, change visibility, publish the draft or dispatch Actions until the owner requests publication.

## Reviewed input

Use the reviewed release PR/commit and [final private review](final-review-0.3.8.md). Code/client snapshot aef00ea passes 158 tests and actual fresh-checkout installation/SDK checks. Later guide/package-metadata changes receive separate local checks. The reviewed plugin is exactly seven files; CCX SHA-256 is 7153825fb11b08423a138b37833ef557f7e7280d7c01293a4a896b5cca0218b1.

Required release assets are premiere-mcp-bridge-0.3.8.ccx and premiere-mcp-bridge-0.3.8.ccx.sha256. Keep the checksum's exact filename entry and match both source and compiled payload; version equality alone is insufficient. Do not upload npm caches, receipts, raw logs, Adobe packager binaries or private audit archives. No npm registry publication is needed.

## At authorized publication

Update candidate-only installation/status wording and land the reviewed PR on main. Preserve the reviewed runtime/client tree and retain the same version across package, manifest, built protocol and CCX. If GitHub Actions must remain suppressed, use its documented skip-ci commit marker for the push/merge; never describe skipped checks as passing or disable protections to force a merge.

Review current intended remote refs, history, logs/artifacts/caches and license notices before changing visibility. Push only the reviewed branch/tag, never all local refs or a mirror. Unrelated local branches are not part of this release. The private repository's unavailable plan-dependent protections must be rechecked when public access is authorized; configure available main protections and private vulnerability reporting without silently adding runner workflows.

Bind the release draft's target to the exact reviewed source commit on main before publishing v0.3.8. Do not let it point to the old main snapshot. Keep prerelease:true for the first macOS/Premiere 26.5 preview. Confirm both uploaded asset names and SHA-256 by downloading them with the maintainer's authenticated access. This is an asset-integrity check, not a public-download test.

Make public visibility and release publication only under the owner's publication request. A source/public release cannot be used as a reversible privacy test: copies and forks can persist.

## Before the announcement

From a new directory and without GitHub credentials, clone the actual v0.3.8 tag, run npm ci and npm run onboard -- --release without --install. It must download the two official matching assets, verify the checksum/allowlist/payload and report installed:false/configured:false. A draft or missing release must remain an explicit failure. Do not use the maintainer's authenticated draft download as evidence of this anonymous route.

Open the published README links and check the user guide, agent guide, platform limits and security contact. The fresh-clone test on the maintainer's existing Adobe host is already recorded; a separate pristine-Mac test remains unclaimed until someone performs it. No screenshot, production editing demonstration or every-client certification is required to label this a scoped preview.

## Maintenance model

Keep MIT for bridge code/documentation and separate Apache-2.0 Adobe notices. Use explicit versioned manual updates; an automatic updater is not a launch requirement. Collect synthetic installation/bug reports before expanding the supported-platform statement or marking the preview stable.

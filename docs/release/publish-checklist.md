# Publication procedure

Obtain the owner's authorization for each release, tag, visibility change or workflow dispatch. This document is a maintainer procedure, not that authorization. The project is free under MIT with separate Adobe notices; no npm-registry publication or automatic updater is required.

## Review the exact source and assets

Use the version in package.json, manifest.json and the built protocol; they must agree. Run local tests and the [release checks](README.md), then read the versioned verification report. Preserve its distinction between fixtures, native behavior and platform/client limits. Stage only the eight allowlisted plugin files. The release attaches premiere-mcp-bridge-VERSION.ccx and its matching .ccx.sha256 file; verify checksum, exact filenames, manifest permissions and rebuilt payload before installation or upload. A matching version string alone is insufficient.

Review the intended public refs/history, source and npm archive, commit/discussion metadata, release assets and existing Actions logs/artifacts/caches for private data. Exclude local configuration, projects/media, transcripts, credentials, receipts, raw audits and extracted Adobe packaging tools. Push only the reviewed branch/tag, never all local refs or a mirror. Preserve private local work. Retain MIT/Adobe license notices and read back available branch/security protections.

## Bind the release to the reviewed commit

Land the reviewed source on main and target its exact commit before creating vVERSION or publishing the matching draft. Never let a new draft silently target older main. Use an appropriate preview flag until the supported scope justifies stable status. Write release notes around the concrete user-visible change, exact installation route, tested scope/limits and links to maintained docs; old release-body drafts are not a template for a new version.

When Actions must remain suppressed, verify repository Actions is disabled for publication and use skip-ci on the reviewed push/merge. Compare run IDs/attempts before and after; do not dispatch or rerun workflows. Do not disable required protection to force a merge or claim intentionally skipped checks passed. Preserve/report the repository's resulting Actions setting.

Download uploaded draft assets with maintainer access and compare their bytes. This proves integrity but not anonymous availability. Visibility changes and publication require the owner's request; public copies/forks can persist, so visibility is not a reversible privacy test.

## Verify the actual public installation

From a new directory without GitHub credentials, clone the exact published vVERSION tag, run npm ci and npm run onboard -- --release without --install. Require the real matching assets, checksum/eight-file/payload checks and installed:false/configured:false. Missing/draft releases must fail without a floating-latest fallback. Never substitute an authenticated draft download for this public-route check.

Check the published README, INSTALL.md, user/agent/client guides, tested limits and private security reporting. A fresh source checkout on the maintainer's existing Mac is not a pristine new-Mac installation. Record only the clients/platforms and native operations actually verified. Keep private logs local and make a concise versioned report or release note sufficient for users and contributors.

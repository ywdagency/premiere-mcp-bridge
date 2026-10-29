# First public preview: review package

Reviewed on 2026-10-29 for `ywdagency/premiere-uxp-bridge`. The owner selected a new private repository with one clean initial commit and GitHub noreply author/committer identity. Source version remains **0.3.4**. Runtime, manifest, dependencies and tests are preserved from the verified working checkout; repository links and release/migration documentation are updated. No old Git refs, PRs, workflow history, personal client configuration or private artifacts are transferred. No tag, public release or release assets are published by this migration.

The source passes all 105 automated tests. Installation/lifecycle observations remain specific to their actual builds: the 0.3.4 package is recorded as installed, while a fresh audit capabilities read still reports running 0.3.3. The owner cannot reload the plugin now, so runtime activation and live 0.3.4 import-diagnostics verification remain open. Historical native checks must not be relabeled as final-installer verification.

## Materials ready for review

| Material | Source |
| --- | --- |
| Product overview, installation and first read | [README and quickstart](../../README.md) |
| Verified configuration paths and reconnect behavior | [MCP clients](../clients.md) |
| Tools, native adapter and architecture | [Commands](../commands.md), [native API](../native-api.md), [IPC/recovery](../mcp-bridge.md) |
| Limits and diagnosis | [Troubleshooting](../troubleshooting.md), [actual native evidence](../live-verification-26.5.md) |
| Contributions, security and licensing | [Contributing](../../CONTRIBUTING.md), [security/data](../../SECURITY.md), [MIT](../../LICENSE), [Adobe notices](../../data/ADOBE-COPYRIGHT.txt) |
| GitHub collaboration | [Bug report](../../.github/ISSUE_TEMPLATE/bug_report.md), [feature request](../../.github/ISSUE_TEMPLATE/feature_request.md), [PR template](../../.github/pull_request_template.md) |
| Release copy | [Release notes draft](release-notes.md) |
| About, topics, agency case and promotion choices | [Positioning](positioning.md) |
| Demo script and required captures | [Synthetic demo](demo.md) |
| Public-content and package audit | [Readiness evidence](public-readiness.md) |

## Distribution and reproducible preparation

The dependable initial route is a source checkout plus generated client configuration. A CCX installs only the Premiere component; the local Node server and its dependencies must still be supplied/configured. Keep `package.json` private: no npm publication is proposed. GitHub's automatic source archive does not contain ignored `dist/` or `build/`; users must run the documented build.

For the reviewed checkout, run:

```sh
npm ci
npm test
npm pack --dry-run --json
node scripts/stage-release.mjs
```

The staging helper copies exactly seven plugin files into `artifacts/release/<version>/plugin` and writes a relative-path SHA-256 inventory beside it. It checks package/manifest versions and the built protocol version when that runtime exports a shared marker, and refuses to overwrite an existing stage. Older runtimes without a shared marker record null for that evidence and still require an installed-build version check. If preparing a new snapshot of the same version, move the previous stage aside for review first; do not package stale files. This helper does not create or install a CCX, launch Premiere, change permissions or publish anything.

Use Adobe UXP Developer Tools' Package operation against the staged manifest to create a CCX. Do not package the repository root: its ignored files include personal configs and artifacts. Do not load a second instance with the same plugin ID to package it. Inspect the resulting archive, including UDT-generated metadata, against the allowlist before distribution. Adobe recommends UDT packaging and testing the resulting installer; ordinary UXP CCX packages do not require a CEP-style package signature. This project has no native hybrid add-on and claims no signing/notarization or Marketplace status. See [Adobe packaging](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/).

The existing legacy manifest ID is retained for upgrade compatibility. It is not the product name or evidence of an autonomous editor. Marketplace distribution would be a separate identity/listing decision; [Adobe distribution options](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/overview/) distinguish direct distribution from Marketplace review.

An optional local `npm pack --pack-destination artifacts/release-review --json` produces a review tarball of the source/runtime allowlist. It is neither a CCX nor an npm publication. A local extraction passed production dependency installation with scripts disabled and offline stdio/reference discovery; final client-to-installed-host use remains a release check. It does not include a lockfile suitable for `npm ci`. Prefer the source-checkout workflow for reproducible installation until the final runtime artifact is verified against the installed plugin.

The eventual GitHub release should attach a tested CCX, a SHA-256 checksum file, these release notes and, only if verified, a separate Node runtime archive. GitHub's source archives remain available for the build-from-source path. Match every artifact to one reviewed commit and version. Attach assets to a draft before publishing; [GitHub's release guidance](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) describes draft releases. No draft has been created remotely by this task.

## Verification and publication gates

- [x] Preserve the verified 0.3.4 implementation and safety fixes; prepare a new initial commit without predecessor Git/PR history.
- [x] Run a fresh dependency installation, all 105 tests/build, package/staging/version checks and main-branch CI.
- [x] Validate actual client configuration generators, Codex TOML merge and real stdio/offline reference discovery.
- [x] Audit source/history, package, all currently listed workflow logs and PR metadata for secrets and owner-specific paths.
- [ ] Activate the installed 0.3.4 plugin runtime and confirm its version through MCP without treating transport Reload as a JavaScript reload.
- [ ] Verify the final CCX with UDT closed, cold Premiere startup, native folder approval/cancellation and synthetic import when separately authorized.
- [ ] Keep per-client end-to-end status accurate. Claude Desktop, Cursor and VS Code app sessions are not claimed tested merely from their config/stdio formats.
- [x] Publish the owner-designated private security contact `dev@ywd.agency` and enable dependency vulnerability alerts, with GitHub read-back verification.
- [x] Exclude all predecessor workflow logs/caches and private artifacts from the new repository. New CI runs may create fresh dependency caches.
- [x] Use a fresh Git root with the verified GitHub noreply identity. Verify that predecessor commit objects and PR refs are absent before accepting the replacement repository.
- [ ] Enable available secret scanning/push protection and main-branch protections when repository eligibility permits. Current private-repository requests leave these disabled/unavailable; no paid upgrade or visibility change was made.
- [ ] Recheck the exact final artifact and publish only approved synthetic captures. A demo is useful launch material, not proof of native behavior.
- [ ] Obtain the owner's explicit instruction for visibility, tagging, release publication or promotion. Each is separate from this audit.

For a source-only developer preview, keep the build-from-source route and the limitations explicit. An installable release additionally needs the final runtime/installer checks above. See [the current audit](public-readiness.md) for evidence and limits.


The owner authorized removing the predecessor remote only after the private replacement passes source-equivalence, clean-history, security and CI checks. Original local backups stay private. Repository deletion does not certify erasure of provider backups. Migration outcomes are recorded in the task registry and private audit evidence.

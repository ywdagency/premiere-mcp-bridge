# Preview 0.3.12 — experimental Windows onboarding

This release adds an experimental native Windows installation/configuration route, portable bounded CCX validation and Windows storage/path guards. It includes the official Adobe manual search already published on main, without adding host tools or UXP permissions. There are 43 full MCP tools or 19 in read-only mode. Follow [INSTALL.md](../../INSTALL.md); Windows users should read the [installation and volunteer testing guide](../windows.md).

## Artifact identity

The seven-file CCX is packaged with Adobe's offline UXP packaging implementation. SHA-256: c237883b3441eed050dbe88f567514772eab9b793930aac45f143cb383c7cba0. Its manifest version is 0.3.12 and the bounded onboarding validator compares every entry against the rebuilt source. The plugin ID, persistent folder-token key, receipt format and request-only filesystem/network/HTTPS permissions are unchanged. Relative to 0.3.11, the UXP source changes only the declared version; Windows onboarding and manual reference changes run in Node.

The source tag and matching CCX/checksum are published as v0.3.12, a prerelease. Existing v0.3.11 assets and native evidence remain unchanged. Exact source/package audits exclude private artifacts, local configurations, owner paths, projects/media and proprietary packaging tools. MIT and Adobe notices remain in the installer and source package.

## Local verification

The release is checked on macOS with native Node 24.7.0. All 198 local automated tests pass (no failures or skips). They cover contracts, IPC/SDK fixtures, portable ZIP validation, Windows installer arguments/location resolution, APPDATA discovery, path aliases and JSON/TOML client serialization. Offline doctor verifies aligned package/manifest/protocol identity; it does not contact Premiere. Dependency audit reports no known vulnerabilities at review time. These checks are separate from native installation and editing evidence.

GitHub Actions remain disabled during publication; no workflow is dispatched or rerun. Publication includes an anonymous fresh exact-tag checkout, npm ci and onboard --release validation without --install; the actual result is recorded after publication. A successful public download check on macOS does not verify Windows installation.

## Experimental scope and participation

There is no real Windows installation, client connection, NTFS ACL/link/locking verification, media grant or Premiere operation result yet. Windows fixtures running on a Mac are not Windows certification. Start in read-only mode and use non-sensitive test material. The [Windows test report](https://github.com/ywdagency/premiere-mcp-bridge/issues/new?template=windows_test.md) welcomes successful installation/connection results as well as failures; report unattempted checks as not tested and keep raw logs, account paths and project data private. Security findings belong in [private reporting](../../SECURITY.md).

No new native 0.3.12 installation or live editing regression is claimed on macOS either. The actual executing-version, restored-grant and update-request checks remain [0.3.11 evidence](candidate-0.3.11.md); synthetic editing/export results remain their earlier versioned reports. This release preparation does not install/restart Premiere, alter client settings or edit/save/export the owner's project. The [Windows acceptance table](../windows.md#checks-that-require-windows) identifies remaining separately authorized host tests. Stable support requires that evidence rather than a fixture pass.

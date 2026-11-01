# Version indicator and update metadata

At rest, the panel keeps the installed version as plain text without an underline or extra icon. Since 0.4.2, hover underlines/brightens it, clicking gives brief feedback, and an in-progress browser launch shows Opening; failure shows Try again. It is always clickable: gray opens the repository, yellow opens the newer compatible release, and red opens that release when the installed version is below an explicit critical threshold. Hover text and the accessible link name explain the state and destination. Click or Enter asks UXP to open the approved HTTPS URL in the browser; Adobe may show its own consent dialog. Nothing downloads or installs automatically.

The plugin requests the fixed public [updates.json](https://raw.githubusercontent.com/ywdagency/premiere-mcp-bridge/main/updates.json) directly, independently of agent connection or Stop/Launch. Each attempt is persisted before the request, limiting checks to once every 24 hours, including failures and runtime reloads. A timer checks again if the plugin stays open for a day. Cached results are re-evaluated against the installed plugin and Premiere versions. Offline, invalid, oversized, timed-out or expired results leave a neutral version without changing bridge status. If cache writes fail, requests are skipped to avoid checking on every reload.

## Publishing an update

Publish and verify the exact release and matching CCX/checksum first, then update the root `updates.json` on `main`. Never announce a draft, unpublished installer or source-only candidate. The live main-branch feed identifies only the currently published preview; advance it after the anonymous release validation. The tagged source may retain the preceding feed until that publication step. Numeric versions are independent of GitHub's prerelease label; separate stable/preview channels are not currently offered.

```json
{
  "schemaVersion": 1,
  "latest": {
    "version": "0.4.2",
    "minimumPremiereVersion": "25.6.0",
    "releaseUrl": "https://github.com/ywdagency/premiere-mcp-bridge/releases/tag/v0.4.2"
  },
  "criticalBelow": null
}
```

Versions use numeric `major.minor.patch` and are compared numerically. `minimumPremiereVersion` is the release's actual minimum. `releaseUrl` must identify exactly `v<version>` in this repository; arbitrary domains, query parameters and executable schemes are rejected. `criticalBelow: null` means an ordinary update. A numeric threshold means installed versions strictly below it get red; versions equal to or above the threshold can still get yellow when below `latest.version`. The threshold cannot exceed the announced version. Critical status is an explicit maintainer decision, never inferred from a major version bump. If Premiere is too old for the release, the version stays gray with an explanatory tooltip.

## Permission and privacy boundary

The owner specifically authorized this check and rename. The only added network permission is `https://raw.githubusercontent.com`; code makes a fixed GET with no body, credentials, project data, logs or installation identifier. GitHub receives ordinary connection metadata, including an IP address. The only external-launch scheme is HTTPS, and code opens only the repository or validated release URL after a user gesture. No generic network/launch MCP tool is exposed. Filesystem permission remains `request`.

Adobe documents these operations for Premiere 25.6+, Manifest v5: [network operations](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/network/), [external processes](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/external-process/). Documentation establishes the intended minimum, not live-host proof. Preview 0.3.11 has an actual successful native request, a restored file grant and a previously recorded owner-confirmed gray-link browser launch. The 0.3.8 installer predates this feature. Native yellow/red rendering and a real elapsed 24-hour wait remain unverified.

The repository is now `ywdagency/premiere-mcp-bridge`, retaining its identity and stable plugin ID. GitHub redirects former web/Git URLs; active installation links use the new name. Historical release checks retain their original build scopes.

## Verification scope

Before integration with remembered file approval, the update-indicator change passed 169 automated tests and six browser cases at 320/360px, covering gray/yellow/red states, click/Enter activation and overflow. These are fixture/browser observations, not native Adobe network/consent/color verification. Those earlier observations are distinct from the current [0.3.11 installer/native verification](release/candidate-0.3.11.md).

## Read-only diagnostics

Preview 0.3.11 capabilities include updateStatus: validated indicator state/destination, fixed manifest URL, last and next attempt times, latest/minimum/critical metadata, cache/network source, request count for the current runtime and a bounded failure code. This getter is a snapshot only and never fetches, clears the daily cache, opens a browser or changes context. Native verification should require actual executing version 0.3.11 and a successful request or valid cached result. A repeated capabilities read must keep the attempt time and request count unchanged. These diagnostics do not establish visual color rendering or successful owner browser consent.

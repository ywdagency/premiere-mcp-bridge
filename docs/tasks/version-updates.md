# Daily version checks and repository rename

Registry: TASK-A0AFF31256E9.

Owner scope: GitHub-hosted updates.json, daily checks, visually plain clickable version in gray/yellow/red, and repository rename to premiere-mcp-bridge. This explicitly permits the narrow network/HTTPS permissions required for the feature. No automatic installation, telemetry or changes to open Premiere content.

- [x] Preserve existing dirty work in an isolated branch/worktree.
- [x] Rename the same public repository and update active URLs/package metadata.
- [x] Update the existing editable native Figma panel with three version states.
- [x] Add strict metadata, numeric comparison and explicit critical threshold.
- [x] Persist daily attempts including offline/reload cases, independently of agents.
- [x] Open only the repository or matching release after click/Enter.
- [x] Complete automated, browser and package verification.

Verification: all 169 tests passed; six browser cases at 320/360px covered the three colors, click/Enter activation and overflow. Package review includes updates.json and excludes private artifacts. Publication and anonymous endpoint/redirect checks are recorded separately in the registry checkpoint after merge.

The initial feed points to the published 0.3.8 CCX with no critical threshold. Other unpublished local candidates are outside this task. The shared installed plugin is not replaced or reloaded here. Native network/consent/color checks remain a later installer verification, separate from fixtures.

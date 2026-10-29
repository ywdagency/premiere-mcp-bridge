# Short demo and capture brief

This is a ready-to-record script, not an existing recording. Capture only after the final panel and installed build are approved. No owner projects/media were opened or captured for these materials. Do not create screenshots of the evolving panel for publication.

## Synthetic setup

Use a new disposable project named `Bridge Demo` and a sequence named `Demo Source`, with generated color cards/test footage and generated tone or silence. Use no recognizable people, customer assets, licensed music, transcripts or real client filenames. Put generated files in a dedicated demo folder with generic names. Close unrelated panels, notifications and recent-project lists before recording; inspect the full frame for paths and personal account details.

For the optional working-copy segment, the owner must authorize the native edit demonstration separately. This documentation task does not create, import, edit, export or save a Premiere project. The baseline read-only cut can be recorded without those operations once the synthetic project is prepared manually.

## 60–75 second script

| Time | Picture/action | Voiceover |
| --- | --- | --- |
| 0–8s | Show only the synthetic Premiere timeline and final plugin panel | “Premiere MCP Bridge connects your AI agent to Adobe Premiere through a local MCP server.” |
| 8–20s | In the chosen local client, enter the first-read prompt below. Show actual tool calls and the sanitized host/project result | “The agent starts by checking the host and project. These reads do not change the timeline.” |
| 20–34s | Request `premiere_get_sequence_clips` with `{"limit":5}`. Show a readable bounded result next to generated cards | “It can inspect clips with exact timing, using documented tools instead of arbitrary scripts.” |
| 34–48s | Read-only cut: `premiere_api_search` with `{"query":"Sequence getVideoTrack","limit":3}`; show source/policy metadata | “API discovery is separate from runtime support. The bridge reports documented contracts and what has actually been tested.” |
| 48–62s | Return to final panel and synthetic timeline; show connection controls without modifying the host | “The plugin runs inside Premiere; your client runs the Node server. Working-sequence protection and explicit file grants define the editing boundary.” |
| 62–75s | Keep the recorded view clean; add repository URL and short version/platform caption during finishing | “Built by YWD Agency. Start with the macOS quickstart, check the tested scope and build your own creative workflow.” |

First-read prompt:

> Use `premiere_get_capabilities` and `premiere_get_project` with empty arguments. Report only the host version, bridge version and whether Bridge Demo is open. Do not activate, edit, export or save anything.

Clip prompt:

> Read the first five clips using `premiere_get_sequence_clips`. Summarize track and timeline positions. Do not request media paths or change Premiere state.

Optional replacement for 34–48 seconds, only with a separate authorized synthetic edit session: duplicate `Demo Source` as `Demo Working Copy`, show the two sequence names and their editable flags, then perform one visibly simple, supported change on the copy. Resolve the current project ID, exact sequence/clip preconditions and a fresh operation UUID from the live tools; never hardcode a copied ID or silently save. Record before/after observations and keep the source intact. Do not imply this optional segment has already been verified for the final build.

## Required capture set

| Capture | Purpose and acceptance |
| --- | --- |
| Final installed panel in Premiere | Actual current version visible; show Stop/Launch and Reload in the settled layout; no real project/media behind it |
| First successful client read | Tool names and concise synthetic result readable; no full capabilities dump, user paths or account details |
| Bounded timeline inspection | Synthetic cards aligned with the five-clip summary; no fabricated response |
| Optional source/copy comparison | Only if separately authorized and recorded; source and working-copy identity distinguishable |

Keep a master recording and a short web-friendly cut. Caption the actual bridge/Premiere/macOS/client versions and whether the cut is inspection-only. Do not retouch a failed command into a successful result. Crops/redactions may remove private UI; they must not change product behavior. Future social graphics or composited layouts belong in editable native Figma content using the approved design workflow; none were produced here.

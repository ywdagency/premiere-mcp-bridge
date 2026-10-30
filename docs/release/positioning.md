# Product positioning and launch copy

Local drafts for owner review. Nothing here has been applied to GitHub metadata, sent to people, posted to social media or published on a website. Use launch copy only after the repository/release is actually public and the final build is verified.

## Positioning

**Premiere MCP Bridge — connect your AI agent to your editing workflow.**

A local, agent-independent MCP bridge for Adobe Premiere. It gives editors and creative developers a documented way to inspect projects and perform explicit operations on sequence copies, while keeping editorial decisions with the user.

Primary audience: editors comfortable using AI tools, creative technologists prototyping production workflows and developers integrating desktop creative software. Lead with a concrete workflow and the two-component installation. The strongest distinction is a documented, bounded connection to a real creative host, with inspectable contracts and separate native evidence.

Avoid claims of an autonomous editor, automatic story selection, full Premiere API execution, all-version/all-client compatibility, render-complete exports, zero-risk editing, Adobe certification or quantified productivity gains. No adoption, client delivery or saved-hours metric has been established.

## GitHub About and topics

Suggested About description:

> Connect AI agents to Adobe Premiere through a local MCP bridge. Inspect timelines, work on sequence copies, and build explicit creative workflows with UXP.

Use the repository name `premiere-uxp-bridge`. Use its own README/releases as the initial destination; do not add an unbuilt landing page. Suggested topics are `mcp`, `mcp-server`, `model-context-protocol`, `adobe-premiere-pro`, `uxp`, `creative-tools`, `video-editing`, `typescript`, `nodejs` and `ai-tools`.

GitHub topics aid discovery and must describe the actual project. GitHub allows at most 20, using lowercase letters/numbers/hyphens and at most 50 characters each; topic names themselves are public even for private repositories. These suggestions have not been applied. See [GitHub topics guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics).

For a future social preview, the copy is **“Your AI agent. Your Premiere workflow.”**, with a supporting line **“Local MCP · Documented UXP tools · Working-sequence protection”** and restrained YWD Agency attribution. GitHub recommends a 1280×640 image under 1 MB. This is a text brief, not a produced asset. Any visual production must use the project's approved Figma workflow and YWD brand library, with native editable layers; no redesign is requested here. See [GitHub social preview requirements](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).

## YWD Agency case study draft

### Connecting AI agents to a creative desktop workflow

**Challenge.** AI agents need reliable access to the state of a creative application before they can help with production work. For Adobe Premiere, that means more than a chat interface: the integration must represent native timing, distinguish inspection from mutation and recover from uncertain outcomes without repeating an edit.

**Solution.** YWD Agency built Premiere MCP Bridge: a UXP plugin inside Premiere and an agent-independent Node MCP server on the user's machine. A shared command catalog defines strict inputs at both boundaries. A typed native adapter exposes documented member IDs and opaque object references. Working-sequence ownership, explicit file grants, native transactions and durable operation receipts constrain operations without embedding an editorial policy.

**Demonstrated result.** Candidate 0.3.7 exposes 42 MCP tools and the pinned Adobe DOM catalog of 73 types/707 entries. File diagnostics make a restored grant inspectable without a panel setting. Earlier 0.3.6 has actual activation and bounded read/time evidence. The current patch still needs native installation and disposable write verification. These are engineering results, not adoption, performance or full API coverage claims.

**What this shows about YWD.** Practical integration of AI tooling with creative software: protocol design, desktop constraints, permission boundaries, recovery behavior and reusable developer documentation. The public preview is intended to make that work inspectable and useful to other builders. No customer endorsement, production deployment or commercial outcome is implied.

Evidence: [command contracts](../../src/command-catalog.ts), [architecture](../mcp-bridge.md), [native report](../live-verification-26.5.md), [license](../../LICENSE), [release audit](public-readiness.md). Reconfirm counts and the final build before publishing this case on any agency channel.

## Launch announcement drafts

### Product-first

We built Premiere MCP Bridge at YWD Agency to connect AI agents to Adobe Premiere through local MCP. Inspect a timeline, discover documented native APIs and perform explicit operations on working sequence copies with the client you choose.

The first preview targets macOS, with native evidence from Premiere 26.5. The repository includes setup, limits and contributor guidance. It is an explicit tool bridge; you keep control of the edit.

Explore the code and quickstart: https://github.com/ywdagency/premiere-uxp-bridge

### Engineering-first

What does it take to connect an AI agent to a desktop editing application responsibly? For Premiere MCP Bridge, we made command contracts, working-copy ownership and uncertain-write recovery part of the integration.

YWD Agency's local UXP + Node MCP bridge exposes a pinned API reference alongside typed tools, and reports catalog coverage separately from native tests. The preview includes reproducible fixtures and an honest record of what ran in Premiere 26.5.

Code, architecture and limits: https://github.com/ywdagency/premiere-uxp-bridge

## Promotion choices for the owner

| Choice | Concrete prepared action | Useful signal |
| --- | --- | --- |
| Quiet developer preview | Publish reviewed README/release/demo, set accurate About/topics, then share the repository through the owner's chosen personal/agency channel | Successful fresh installs and reproducible issues from relevant users |
| Workflow demonstration | Publish the short synthetic demo with the product-first copy, linking directly to installation and limitations | Viewers can repeat the first read and understand working-copy scope |
| Engineering case | Publish the case study and engineering-first copy, explaining one concrete recovery/ownership design decision with links to code/evidence | Relevant technical discussion, contributions and integration inquiries |

Recommended sequence is a quiet preview followed by the demonstrated workflow once installation feedback is addressed. This is an editorial recommendation, not a guarantee of reach or a request to dispatch promotion. The owner chooses channels, timing and audience. No directory submission, unsolicited outreach, star campaign or external messaging has been performed.

GitHub discoverability preparation is limited to clear purpose, accurate topics, a readable quickstart, usable issue templates and reviewable releases. Before public visibility, review history and Actions logs as well as current files: [GitHub's visibility documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) explains the public exposure change. Do not treat a visibility toggle as a reversible privacy test.

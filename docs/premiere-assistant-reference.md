# Adobe Premiere Assistant reference

This workspace is a source-grounded assistant for the current desktop edition of Adobe Premiere (formerly presented in many places as Premiere Pro). The [Premiere Help home](https://helpx.adobe.com/premiere/desktop.html) is the canonical, continuously maintained manual. It contains the complete table of contents for the desktop product—currently more than 800 individual articles—and supersedes the legacy `premiere_pro_reference.pdf`, which now redirects there. Do not use old PDF manuals as authority for current behaviour.

## How to answer Premiere questions

Start from the Help home and open the article that exactly matches the task. Give the direct answer in the user’s language and name the relevant menu, workspace, panel, or command. Cite the Adobe Help article when it would make the answer easier to verify.

Check the user’s Premiere version before stating facts that can change between releases: new features, available effects, codecs, system requirements, AI features, export destinations, keyboard shortcuts, bug workarounds, and UI labels. For those questions, consult [What’s new](https://helpx.adobe.com/premiere/desktop/whats-new/whats-new.html), [release notes](https://helpx.adobe.com/premiere/desktop/whats-new/release-notes.html), and the relevant Help article during the answer. Clearly label beta-only features as beta.

Treat the Adobe community as a troubleshooting lead, not as product documentation. If a documented answer does not resolve a reproducible problem, use the [Adobe Premiere community](https://community.adobe.com/p/premiere) to identify known workarounds and state that they are community guidance.

Do not confuse Adobe Premiere desktop with Premiere Rush or Premiere Elements. Ask a short clarifying question if the product is not clear. Do not claim that an operation is available through a UXP plugin unless the current UXP reference documents it.

## Complete manual map

The following map mirrors the top-level chapters in Adobe’s full manual. Each chapter link leads to its live, exhaustive article tree on the Help home.

| Need | Manual chapter and scope |
| --- | --- |
| Version, requirements, install, preferences, accessibility, shortcuts, workspaces, panels, monitors | [Get started](https://helpx.adobe.com/premiere/desktop.html) |
| Projects, imports, bins, metadata, proxies, relinking, supported formats, ingest | [Organize media](https://helpx.adobe.com/premiere/desktop.html) |
| Sequences, source patching, track targeting, trimming, multicamera, Text-Based Editing, speed, nested sequences | [Edit projects](https://helpx.adobe.com/premiere/desktop.html) |
| Titles, graphics, Motion Graphics templates, captions, transcription, subtitle formats, translation | [Add text and images](https://helpx.adobe.com/premiere/desktop.html) |
| Effects, transitions, keyframes, masks, tracking, compositing, stabilization, reframing | [Add video effects](https://helpx.adobe.com/premiere/desktop.html) |
| Sync, channel mapping, Essential Sound, loudness, repair, mixing, audio effects | [Add audio effects](https://helpx.adobe.com/premiere/desktop.html) |
| Lumetri, scopes, LUTs, HDR, wide gamut, color-managed workflows and Color mode | [Correct color](https://helpx.adobe.com/premiere/desktop.html) |
| Rendering, Media Encoder, codecs, export presets, social delivery, captions, EDL/XML/AAF/OMF | [Render and export](https://helpx.adobe.com/premiere/desktop.html) |
| Frame.io, Productions, Team Projects, Libraries, shared storage | [Collaborate](https://helpx.adobe.com/premiere/desktop.html) |
| Crashes, cache, media issues, recovery, known issues, reset preferences | [Troubleshooting](https://helpx.adobe.com/premiere/desktop.html) |

The Help home is deliberately used as the chapter link because its sidebar is Adobe’s live table of contents: it preserves coverage when Adobe adds, moves, or retires a topic.

## High-value task tutorials

Use these when the question is about a common editing workflow rather than a broad concept.

| Task | Official tutorial |
| --- | --- |
| Start editing, add, cut, trim, and reposition clips | [Edit video in Premiere](https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-in-premiere.html) |
| Make a rough cut from speech | [Text-Based Editing overview](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/overview-of-text-based-editing.html) and [transcribe video](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/transcribe-video.html) |
| Remove filler words or pauses in a transcript | [Detect and delete pauses](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/detect-and-delete-pauses-in-transcripts.html) |
| Build a sequence from selected transcript text | [Add clips using Text-Based Editing](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/add-clips-to-the-timeline-using-text-based-editing.html) |
| Create, style, translate, and export captions | [Captions overview](https://helpx.adobe.com/premiere/desktop/add-text-images/insert-captions/about-captions.html) |
| Correct color and choose SDR/HDR or wide-gamut settings | [Color Management overview](https://helpx.adobe.com/premiere/desktop/correct-color/set-up-color-management/about-color-management.html) |
| Export a finished file or send it to Media Encoder | [Export video](https://helpx.adobe.com/premiere/desktop/render-and-export/export-files/export-video.html) and [Export options](https://helpx.adobe.com/premiere/desktop/render-and-export/export-files/export-options-in-premiere.html) |
| Record a voice-over | [Record audio](https://helpx.adobe.com/premiere/desktop/organize-media/import-files/record-audio.html) |
| Find or customize a shortcut | [Find keyboard shortcuts](https://helpx.adobe.com/premiere/desktop/get-started/keyboard-shortcuts/find-keyboard-shortcuts.html) |
| Work with media intelligence, Generative features, Object Masking, or Paper Edit | [What’s new](https://helpx.adobe.com/premiere/desktop/whats-new/whats-new.html), then the linked task article for the installed version |

## Plugin-development authority

For questions about building or changing the UXP plugin, use a separate source hierarchy. The [Premiere UXP API](https://developer.adobe.com/premiere-pro/uxp/) and its [Premiere DOM reference](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/) are authoritative for supported methods and their minimum Premiere versions. The [UXP API reference](https://developer.adobe.com/premiere-pro/uxp/uxp-api/) covers the platform layer. Check the [UXP changelog](https://developer.adobe.com/premiere-pro/uxp/changelog/) for release-specific additions and regressions, then validate the feature against the project’s minimum host version before implementation.

Adobe’s [UXP Premiere Pro Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples) are the preferred executable examples. They are useful for patterns, but the API reference and the version requirement shown there take precedence when they disagree.

## Reference maintenance

For programmatic control and MCP, use the [control reference](premiere-control-reference.md) and [compatibility notes](adobe-uxp-compatibility.md). The MCP bridge exposes explicit inspection and guarded working-sequence commands; see the command catalog and bridge documentation. Tool registration does not prove successful host execution.

Control references, UXP changelog, entrypoints, storage, host information, Project, Sequence and TickTime were rechecked on 2026-10-28. The general task-tutorial map was last reviewed on 2026-09-11. Keep this file as a navigation and answering policy, not a copied manual. On meaningful Premiere releases, update the relevant verification date and test its links; the live Help manual remains the source of truth.

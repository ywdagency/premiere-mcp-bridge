# Joint live verification plan

This is a **plan**, not evidence. No native writes, project import/close/save,
installation, reload or AE operation were performed by the API-expansion work.
The owner subsequently requested final build checks. Execute only the authorized
Premiere fixture scope; this does not authorize work in the separate AE bridge,
changes to private projects or application controls through a fallback UI route.

## Fixtures and evidence

Premiere operation and verification use MCP data only. Do not inspect application
windows, capture screenshots or export/extract frames as a visual-verification
substitute. Picture, motion appearance and audible quality require owner review.

Confirm host/plugin versions and that manual editing is stopped. Use separate
disposable Premiere and AE projects, never the owner's real work for lifecycle,
export or global-setting checks. Create and verify retained sequence backups
before edits as required by the editing skill. Do not remove those backups without
owner instruction. Save/open/close tests are deliberate standalone actions.

Prepare short synthetic video/audio, mono/stereo sources, a still, non-ASCII names,
a second `.prproj` with known sequence GUIDs, an `.aep` with two known composition
names and a compatible `.mogrt`. Include proxies, audio-only/empty sequences,
captions/transcripts and offline media where relevant. Missing codecs, language
packs or fixtures yield `blocked-by-fixture`, never an invented pass.

Create the private checklist without touching an application:

```sh
node scripts/prepare-live-verification.mjs
```

The ignored `artifacts/api-verification/` run records contain all 707 IDs marked
`not-run`. Prior checks are context only. Record tool/member/arguments, operation
UUID, before/after state, job/receipt outcome and private evidence paths. Add
variants and expected/observed results per member. Never publish raw project/media
names or run files. Promote sanitized verified claims into
`data/live-verification.json` and the host report, then regenerate the matrix.

## Scenarios and required postconditions

| ID | Scope | Verify |
| --- | --- | --- |
| P01 | Project context, selected/all AE imports, selected/all sequence imports, pauseGrowing, explicit open/save/Save As/close | Inventories match chosen scope; imported content protected; no unsolicited save; Cancel preserves dirty project; reopening invalidates ownership/handles. Close only a disposable project after jobs finish. |
| P02 | Create/clone/from-media/from-preset/subsequence; settings, work area, selection | Correct ownership, preserved input/backup and settings; context changes only by explicit commands. Test nesting/shared media independently. |
| P03 | Video insert/overwrite/clone/move/trim/remove/ripple/speed/reverse | Exact ticks, retained source ranges, track, gaps/overlaps, ripple extent and linked A/V offsets. Native Actions differ from narrower convenience tools. |
| P04 | Audio tracks/items, mute and exposed audio parameters | Timing/channel/track state; audible-quality claims require owner-supplied listening review. |
| P05 | Effect add/order/remove and typed parameter values | IDs/counts, clamped values, source protection through MCP; rendered appearance/audio remain owner-reviewed. |
| P06 | Scalar/point animation and supported interpolation | Key count/ticks/values, sampled values, animation enable/disable and interpolation. |
| P07 | Transition creation/options/add/remove | Match name, alignment, duration, placement and structural boundary metadata; appearance remains owner-reviewed. |
| P08 | Media/bins/subclips/proxy/relink/interpretation/LUT/metadata | Only intended owned assets change; shared sources/unowned descendants rejected; invalid grants/paths never reach native file operations. |
| P09 | File/library MOGRT insertion and exposed parameters | Correct template/time, parameter types through MCP; rendered appearance remains owner-reviewed. Probe version-dependent classes; missing fonts/assets recorded. |
| P10 | Caption inventory/items/mute/rename | Actual exposed data distinguished from empty/unsupported results; no unproven caption text authoring. |
| P11 | Marker types/color/text/timing/removal | Exact read-back, intended IDs only; returned text remains data. |
| P12 | Transcript reads/export/languages/transcribe/import | Actual text/segments/language and owned asset identity; shared source protected. |
| P13 | Frame/sequence/file/item exports, XML/AAF/OTIO, AME | Output exists, opens and has expected dimensions/duration/content; false is failure, queued is not finished. Keep owner's existing queue out of tests. |
| P14 | Events/jobs | Callback identity, cursors/drop counters, native completion and unsubscribe; unload does not imply job cancellation. |
| P15 | Source Monitor | Explicit item/playhead/playback changes; reads leave visible context unchanged. |
| P16 | Application/preferences/cache/scratch/ingest | Record old values and restoration first; destructive/unbounded tests need a scoped owner decision. Cache purge cannot be undone. |
| P17 | Object-mask presence/C2PA | Fixtures with/without data; unavailable APIs recorded, no invented mask authoring endpoint. |
| P18 | Constructors/enums/time/geometry | Native types, exact ticks, frame alignment, negative/subframe/long time and installed-version differences. |
| P19 | Transport and recovery across writes | Journal before native call; same UUID/payload replays original job/result; conflict rejects; timeout/reload never silently retries. Pending project job blocks competing writes. |
| P20 | Two independent bridges | Either host can be absent; names/URIs/session references isolated; no implicit launch/save/restart/edit in the other application. |

A completed scenario does not pass every API in its domain. Record representative
valid/invalid arguments and important variants per member. Test callback plumbing
through its consuming operation; label declarative alternatives separately from
native execution. Use `unsupported-host`, `blocked-by-fixture`, `failed` and
`passed` distinctly.

## Failure and recovery

Stop an affected scenario at the first mismatch. Inspect state and receipts;
recover with the original UUID/payload, never repeat uncertain work under a new
ID. Do not revert manual changes against an old snapshot. Cancellation is not
rollback. Record a minimal synthetic reproducer, fix the contract and run local
tests before repeating that scenario in the host.

After Premiere, use the AE bridge's actual catalog to prepare its own member run.
Cover supported project/composition/layer/property/keyframe/effect/text/shape/
camera/light/import/render APIs, rather than copying Premiere's classes/units.

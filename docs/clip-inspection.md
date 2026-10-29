# Clip inspection and time semantics

`premiere_get_sequence_clips` reads a bounded page from video tracks followed by audio tracks, in native track-item order. Empty tracks are included in the track summary. The default page is ten items and the maximum is twenty. `nextOffset` is null at the end. Up to 128 tracks and 100000 items may be inventoried; filter larger projects by track.

Each item includes a zero-based observational locator, project-item ID, bounded display name, timeline start/end, duration, project-item-relative source In/Out, speed and reverse state. Locators are not stable IDs. Pass the active `sequenceId` between pages, keep Premiere idle and reread after every edit.

Raw TickTime strings are authoritative. There are 254016000000 ticks per second. Node uses BigInt for formatting, including 29.97/59.94 drop-frame boundaries and subframe remainders. Timeline labels include the sequence zero point. Source offsets and durations are formatted at the sequence rate and are explicitly not embedded camera/source timecodes. Unsupported display formats retain raw ticks and report unavailable labels instead of inventing a timecode.

The reader detects active-context switches and several structural changes while reading. It is not an atomic snapshot: same-count edits may occur between asynchronous getters. Transitions, captions, effects, source media bytes and nested sequence contents are outside this read surface. A project-item ID identifies the underlying asset, not a unique timeline instance; writes also compare locator and all observed timing boundaries.

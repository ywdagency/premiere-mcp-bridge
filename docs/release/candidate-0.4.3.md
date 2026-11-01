# Local candidate 0.4.3

This unpublished local candidate adds optional `videoTrackIndex` to existing-sequence authorization. A direct owner request remains required. The direct backup is retained and protected; source/backup/source structural comparison reads only the selected video track and sequence timing/counts. A scoped grant cannot authorize audio, another video track or sequence-wide edits.

Supported native scoped operations are clip/effect actions on the selected video track, overwrite with audio suppressed (`audioTrackIndex:-1`), and non-ripple exact-track video removal. Track ID changes and observed clips moved between tracks reject before editing. Explicit full-sequence authorization remains available with its existing broader comparison. Verification-only native errors now have a confirmed preflight error code.

Fixtures cover an unavailable unrelated audio getter, source/backup mismatch, consent, protected backups, scope bounds, source deletion, sequence-wide edits, stale clips, track identity, video-only overwrite, ripple/audio removal rejection, and revocation. These are synthetic contract tests, not native Premiere certification. Package/runtime installation and live behavior must be recorded separately; no publication is implied.

The stable plugin ID and all manifest permissions are unchanged. No new network, filesystem, UI, implicit-save, source-media ownership or deletion permission is introduced.

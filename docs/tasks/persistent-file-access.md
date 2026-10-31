# Persist file approval

Registry TASK-9A0453418A32. Owner requests remembered folder permission across Stop, restart and update, with no new panel settings. Preserve the same plugin ID/storage key, deliberate first approval and per-file checks. Explicit revocation is separate from pausing transport. Validate production bundle lifecycle, pending-picker/restore races, cancellation, invalid tokens, restart and same-ID upgrade with synthetic storage. Prepare a distinct local 0.3.10 candidate without publishing a release, Actions, host project writes or a hidden restart.

Implementation, local tests and installed 0.3.10 package are complete. Native runtime activation is awaiting the owner: Premiere still executes 0.3.8. Preserve its remembered grant by closing normally rather than using the old Stop behavior before this first activation. Recheck capabilities/doctor after restart and reconnect; do not claim that installation alone activated the fix.

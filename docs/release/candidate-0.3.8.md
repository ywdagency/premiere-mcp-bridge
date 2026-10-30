# Candidate 0.3.8 — serialized file authorization

This unpublished Premiere-only patch follows actual [0.3.7 native tests](native-check-0.3.7.md).
A single media import worked, while a batch failed before native import with UXP
filesystem error-2. Native proof creation/polling/cleanup overlapped within one
request. File authorization now uses a request-bound serial queue; a failed or
ended request cannot start its queued checks or hold the next request indefinitely.
The UXP Entry grant and independent Node path checks are unchanged.

Full-argument Comment markers worked, but sparse middle optional arguments
caused a native action error. The adapter now rejects that known unsafe form
before host invocation, at the MCP and UXP boundaries. It supplies no invented
Adobe defaults and still permits trailing omissions according to the catalog.

The source retains 42 MCP tools /39 host commands,19 read-only tools and the pinned
707-entry reference. No manifest permissions, network listener, arbitrary-code
endpoint, extra panel setting or automatic updater is added. The installed 0.3.7
runtime's successful synthetic operations are versioned evidence, not proof this
patch is running. A new 0.3.8 CCX/hash, official install and actual activation must
be verified before repeating the batch scenario.

Native follow-up must exercise a maximum-size batch, failure recovery/queue
release, sparse-marker rejection and successful full-argument marker creation
on disposable fixtures. Retain the verified 0.3.7 backups and keep the user's
original project untouched. Broader native fixtures and explicit authorization
remain separate gates. Do not claim a public functional release is ready yet.

Prepared evidence: all 156 automated tests pass; six focused proof/marker tests pass after the final build. The 131-file source and seven-file CCX pass path, secret and local-link checks. The CCX matches the built stage; SHA-256 `7153825fb11b08423a138b37833ef557f7e7280d7c01293a4a896b5cca0218b1`. Native patch verification remains pending.

Actual activation and native batch/guard regression now pass; see the [0.3.8 report](native-check-0.3.8.md). The 10-file call takes about 15 seconds, so Node defaults to 30 seconds. Matching older marker receipts remain recoverable despite stricter new-call validation. These Node-only improvements leave the audited CCX unchanged. Final source suite: 157 tests pass.

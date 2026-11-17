// Partial, versioned native observations never imply an end-to-end workflow pass.
export function nativeObservationFields(verification, id) {
  const run = verification.renderBatch046;
  const observation = run?.nativeMemberObservations?.find(entry => entry.id === id);
  return observation ? { latestNativeObservation: {
    bridgeVersion: run.bridgeVersion,
    hostVersion: run.hostVersion,
    checkedAt: run.checkedAt,
    report: run.report,
    outcome: observation.outcome,
    scope: observation.scope,
  } } : {};
}

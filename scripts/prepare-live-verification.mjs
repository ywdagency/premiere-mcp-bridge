// Private checklist only: no MCP, Adobe, install or UI dependencies.
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildMatrix } from "./api-coverage-matrix.mjs";

const matrix = buildMatrix();
const directory = new URL("../artifacts/api-verification/", import.meta.url);
await mkdir(directory, { recursive: true });
const runId = randomUUID();
const output = new URL(`${runId}.json`, directory);
const record = {
  schemaVersion: 1,
  runId,
  createdAt: new Date().toISOString(),
  status: "prepared-not-run",
  host: null,
  pluginVersion: null,
  fixtureProject: null,
  catalogCommit: matrix.provenance.commit,
  scenarioIds: Array.from(
    { length: 20 },
    (_, i) => `P${String(i + 1).padStart(2, "0")}`,
  ),
  scenarios: Array.from({ length: 20 }, (_, i) => ({
    id: `P${String(i + 1).padStart(2, '0')}`, state: 'not-run', expected: null, observed: null, evidence: [],
  })),
  members: matrix.members.map((member) => ({
    memberId: member.id,
    scenario: member.scenario,
    route: member.route,
    adapterStatus: member.adapterStatus,
    previousEvidence: member.verification.state,
    state: "not-run",
    variants: [],
    expected: null,
    observed: null,
    evidence: [],
  })),
  notice:
    "Private checklist; no native operation executed. A domain scenario does not verify all its members.",
};
await writeFile(output, JSON.stringify(record, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
console.log(fileURLToPath(output));

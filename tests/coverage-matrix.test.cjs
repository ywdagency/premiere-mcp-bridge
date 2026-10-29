const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { COMMAND_LIST } = require("../build/lib/runtime.cjs");

test("exhaustive expansion matrix stays aligned with the catalog, routes, versions and separate native evidence", async () => {
  const { buildMatrix } = await import("../scripts/api-coverage-matrix.mjs");
  const matrix = buildMatrix();
  const stored = JSON.parse(
    readFileSync(
      resolve(__dirname, "../data/api-coverage-matrix.json"),
      "utf8",
    ),
  );
  assert.deepEqual(stored, matrix);
  assert.equal(matrix.members.length, 707);
  assert.equal(new Set(matrix.members.map((entry) => entry.id)).size, 707);
  const routes = new Set(
    COMMAND_LIST.map((entry) => `premiere_${entry.command}`),
  );
  for (const member of matrix.members) {
    if (member.route)
      assert.ok(routes.has(member.route), `Unregistered route: ${member.id}`);
    assert.ok(member.scenario && member.source);
    if (
      member.adapterStatus === "internal" ||
      member.adapterStatus === "declarative-alternative"
    ) {
      assert.equal(member.route, null);
      assert.ok(member.reason);
    }
  }
  for (const id of [
    "Project#importAEComps",
    "Project#importAllAEComps",
    "Project#importSequences",
    "Project#close",
    "Project#closeSequence",
    "Project#pauseGrowing",
  ]) {
    const member = matrix.members.find((entry) => entry.id === id);
    assert.equal(member.policy, "dedicated");
    assert.equal(member.verification.state, "pending-live-check");
  }
  const missing = matrix.members.find((entry) => entry.id === "new MogrtText");
  assert.equal(missing.verification.state, "observed-unavailable");
  assert.notEqual(missing.adapterStatus, "not-adapted"); // Catalog/routing is separate from runtime support.
});

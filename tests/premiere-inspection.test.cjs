const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectPremiere } = require("../build/lib/premiere-inspection.cjs");
const { parseRequest, parseMarker, validateArgs } = require("../build/lib/bridge-protocol.cjs");
const id = "26ea76a8-d901-46c5-a478-a2904eb22862";

function fixture() {
  const reads = [];
  // Unknown property access fails, including any accidental mutation method.
  const guarded = (value) => new Proxy(value, { get(target, key) {
    if (!(key in target)) throw new Error(`Unexpected host capability: ${String(key)}`);
    reads.push(key);
    return target[key];
  } });
  const sequence = guarded({ guid: "sequence-1", name: "Essay", then: undefined,
    getEndTime: async () => ({ ticks: "900719925474099300000", seconds: 12.5 }),
    getPlayerPosition: async () => ({ ticks: "0", seconds: 0 }),
    getTimebase: async () => "10594584000",
    getVideoTrackCount: async () => 2, getAudioTrackCount: async () => 3
  });
  const project = guarded({ guid: "project-1", name: "Interview", path: "/private/customer/project.prproj", then: undefined,
    getActiveSequence: async () => sequence, getSequences: async () => [sequence]
  });
  const host = { name: "premierepro", version: "26.2.2", uxpVersion: "9.2.1", getActiveProject: async () => project };
  return { host, project, sequence, reads };
}

test("project read omits path unless explicitly requested and calls only getters", async () => {
  const { host, reads } = fixture();
  const result = await inspectPremiere(host, "get_project", {});
  assert.equal(result.readOnly, true);
  assert.equal(result.project.sequenceCount, 1);
  assert.equal(result.project.activeSequence.id, "sequence-1");
  assert.equal("path" in result.project, false);
  assert.equal(reads.includes("path"), false);
  assert.equal((await inspectPremiere(host, "get_project", { includePath: true })).project.path, "/private/customer/project.prproj");
});

test("sequence read awaits Promise track counts and preserves exact tick strings", async () => {
  const { host } = fixture();
  const result = await inspectPremiere(host, "get_active_sequence", {});
  assert.equal(result.activeSequence.videoTrackCount, 2);
  assert.equal(result.activeSequence.audioTrackCount, 3);
  assert.equal(result.activeSequence.endTime.ticks, "900719925474099300000");
  assert.equal(result.activeSequence.timebaseTicksPerFrame, "10594584000");
  assert.equal(result.activeSequence.playhead.seconds, 0);
});

test("no active context returns null rather than switching or opening projects", async () => {
  const { host, project } = fixture();
  host.getActiveProject = async () => null;
  assert.equal((await inspectPremiere(host, "get_project", {})).project, null);
  assert.equal((await inspectPremiere(host, "get_active_sequence", {})).activeSequence, null);
  host.getActiveProject = async () => ({ ...project, getActiveSequence: async () => null });
  assert.equal((await inspectPremiere(host, "get_active_sequence", {})).activeSequence, null);
});

test("detects active project or sequence changes during asynchronous reads", async () => {
  const { host, project, sequence } = fixture();
  let reads = 0;
  host.getActiveProject = async () => (++reads === 1 ? project : null);
  await assert.rejects(inspectPremiere(host, "get_project", {}), { code: "ACTIVE_CONTEXT_CHANGED" });
  host.getActiveProject = async () => ({ ...project, getActiveSequence: async () => (++reads === 1 ? sequence : null) });
  reads = 0;
  await assert.rejects(inspectPremiere(host, "get_project", {}), { code: "ACTIVE_CONTEXT_CHANGED" });
});

test("rejects older hosts and avoids leaking paths through host exception messages", async () => {
  const { host } = fixture();
  host.version = "25.5.0";
  await assert.rejects(inspectPremiere(host, "get_project", {}), { code: "UNSUPPORTED_HOST" });
  host.version = "25.6.0";
  host.getActiveProject = async () => { throw new Error("/secret/source.prproj"); };
  await assert.rejects(inspectPremiere(host, "get_project", {}), (error) =>
    error.code === "HOST_READ_FAILED" && !error.message.includes("secret"));
});

test("both dispatch boundaries reject unregistered commands, code, paths and unknown fields", async () => {
  const { host } = fixture();
  for (const command of ["eval", "create_review", "execute_javascript", "setActiveSequence", "__proto__"]) {
    assert.throws(() => validateArgs(command, {}), { code: "COMMAND_NOT_ALLOWED" });
    await assert.rejects(inspectPremiere(host, command, {}), { code: "COMMAND_NOT_ALLOWED" });
  }
  assert.throws(() => validateArgs("get_active_sequence", { includePath: true }));
  assert.throws(() => validateArgs("get_project", { code: "app.save()" }));
  assert.throws(() => validateArgs("get_project", { includePath: "true" }));
});

test("protocol rejects wrong identity, expiry, version and extra arguments", () => {
  const now = Date.now();
  const request = { version: 1, bridgeId: id, id, command: "get_project", args: {}, expiresAt: now + 1000 };
  assert.deepEqual(parseRequest(request, id, now), request);
  for (const changed of [{ expiresAt: now }, { expiresAt: now + 30001 }, { version: 2 }, { bridgeId: "foreign" },
    { id: "../../outside" }, { script: "anything" }, { args: { includePath: 1 } }]) {
    assert.throws(() => parseRequest({ ...request, ...changed }, id, now));
  }
  assert.throws(() => parseMarker({ version: 1, name: "foreign", bridgeId: id }));
});

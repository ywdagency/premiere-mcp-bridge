const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { apiFixture } = require("./helpers/api-fixture.cjs");
const { folderAdapter } = require("./helpers/bridge-fixture.cjs");
const {
  createDispatcher,
  validateArgs,
  UxpBridge,
  PremiereApi,
} = require("../build/lib/runtime.cjs");
const deadline = () => Date.now() + 5000;
const settle = () => new Promise((resolve) => setImmediate(resolve));
const guid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function fixture() {
  const f = apiFixture();
  f.calls = [];
  f.project.path = "/granted/current.prproj";
  f.module.Guid = { fromString: (value) => ({ toString: () => value }) };
  f.module.CloseProjectOptions = class {
    setPromptIfDirty(v) {
      this.promptIfDirty = v;
      return this;
    }
    setShowCancelButton(v) {
      this.showCancelButton = v;
      return this;
    }
    setSaveWorkspace(v) {
      this.saveWorkspace = v;
      return this;
    }
    setIsAppBeingPreparedToQuit(v) {
      this.isAppBeingPreparedToQuit = v;
      return this;
    }
  };
  for (const name of [
    "importAEComps",
    "importAllAEComps",
    "importSequences",
    "close",
    "closeSequence",
    "pauseGrowing",
  ])
    f.project[name] = async (...args) => {
      f.calls.push({ name, args });
      return true;
    };
  const dispatch = createDispatcher(f.inspectHost, f.control, f.api);
  f.invoke = (command, args = {}) =>
    dispatch({
      command,
      args: {
        projectId: f.project.guid,
        operationId: randomUUID(),
        ...args,
      },
      expiresAt: deadline(),
    });
  return f;
}

test("AE selected/all imports and project sequence imports use exact native signatures, never grant edit ownership", async () => {
  const f = fixture();
  const selected = await f.invoke("import_ae_comps", {
    path: "comps.aep",
    compNames: ["Title / Intro", "Title 🎞️"],
  });
  await settle();
  assert.deepEqual(f.calls[0], {
    name: "importAEComps",
    args: ["/granted/comps.aep", ["Title / Intro", "Title 🎞️"], f.root],
  });
  assert.equal(f.api.job({ jobId: selected.jobId }).state, "native_succeeded");
  const all = await f.invoke("import_all_ae_comps", { path: "comps.aep" });
  await settle();
  assert.deepEqual(f.calls[1], {
    name: "importAllAEComps",
    args: ["/granted/comps.aep", f.root],
  });
  assert.equal(
    f.api.job({ jobId: all.jobId }).result.importedOwnershipGranted,
    false,
  );
  await f.invoke("import_sequences", {
    path: "other.prproj",
    sequenceIds: [guid],
  });
  await settle();
  assert.equal(f.calls[2].args[1][0].toString(), guid);
  await f.invoke("import_sequences", {
    path: "other.prproj",
    allSequences: true,
  });
  await settle();
  assert.deepEqual(f.calls[3], {
    name: "importSequences",
    args: ["/granted/other.prproj"],
  });
  assert.deepEqual(f.control.capabilities().workingSequences, []);
  assert.equal(f.api.ownedAssets.size, 0);
});

test("import rejects malformed names, paths, ambiguous all-selection and GUIDs before the native call", async () => {
  const f = fixture();
  for (const compNames of [
    [],
    ["same", "same"],
    ["bad\0name"],
    Array(51).fill("x"),
  ])
    await assert.rejects(
      f.invoke("import_ae_comps", { path: "comps.aep", compNames }),
    );
  let paths = 0;
  f.apiHost.path = async () => {
    paths++;
    return "/granted/file";
  };
  for (const path of [
    "/absolute.aep",
    "../escape.aep",
    "file:comps.aep",
    "a\\b.aep",
    "script.jsx",
    "folder//x.aep",
  ])
    await assert.rejects(f.invoke("import_all_ae_comps", { path }), {
      code: "INVALID_API_ARGUMENT",
    });
  for (const args of [
    {},
    { allSequences: false },
    { sequenceIds: ["not-a-guid"] },
    { allSequences: true, sequenceIds: [guid] },
    { sequenceIds: [guid, guid] },
  ])
    await assert.rejects(
      f.invoke("import_sequences", { path: "other.prproj", ...args }),
    );
  assert.equal(paths, 0);
  assert.equal(f.calls.length, 0);
});

test("target bin handles must have the right type and project; granted paths never authorize a changed active context", async () => {
  const f = fixture();
  const context = await f.context();
  const bin = await f.read("Project#getRootItem", context.project);
  await f.invoke("import_all_ae_comps", {
    path: "comps.aep",
    targetBin: bin.$ref,
  });
  await settle();
  assert.equal(f.calls[0].args[1], f.root);
  const fresh = await f.context();
  await assert.rejects(
    f.invoke("import_all_ae_comps", {
      path: "comps.aep",
      targetBin: fresh.sequence.$ref,
    }),
    { code: "INVALID_API_ARGUMENT" },
  );
  const foreign = await f.read("Project#getRootItem", fresh.project);
  f.api.handle(foreign.$ref).scope.projectId = "other-project";
  await assert.rejects(
    f.invoke("import_all_ae_comps", {
      path: "comps.aep",
      targetBin: foreign.$ref,
    }),
    { code: "ACTIVE_CONTEXT_CHANGED" },
  );
  f.apiHost.path = async () => {
    f.apiHost.getActiveProject = async () => ({ guid: "different" });
    return "/granted/comps.aep";
  };
  await assert.rejects(f.invoke("import_all_ae_comps", { path: "comps.aep" }), {
    code: "ACTIVE_CONTEXT_CHANGED",
  });
  assert.equal(f.calls.length, 1);
});

test("missing native API, same-project import and disabled/expired gates reject without executing a project operation", async () => {
  const f = fixture();
  delete f.project.importAllAEComps;
  await assert.rejects(f.invoke("import_all_ae_comps", { path: "comps.aep" }), {
    code: "HOST_MEMBER_UNAVAILABLE",
  });
  await assert.rejects(
    f.invoke("import_sequences", {
      path: "current.prproj",
      allSequences: true,
    }),
    { code: "INVALID_API_ARGUMENT" },
  );
  f.apiHost.writesEnabled = () => false;
  await assert.rejects(f.invoke("project_close", { confirm: true }), {
    code: "WRITES_DISABLED",
  });
  f.apiHost.writesEnabled = () => true;
  await assert.rejects(
    f.api.closeProject(
      { projectId: f.project.guid, confirm: true },
      Date.now() - 1,
    ),
    { code: "REQUEST_EXPIRED" },
  );
  assert.equal(f.calls.length, 0);
});

test("close always retains dirty prompt/Cancel, never saves workspace or quits; native cancel retains working ownership", async () => {
  const f = fixture();
  const working = await f.working();
  await assert.rejects(f.invoke("project_close", { confirm: false }), {
    code: "EXPLICIT_AUTHORIZATION_REQUIRED",
  });
  f.project.close = async (options) => {
    assert.deepEqual(
      { ...options },
      {
        promptIfDirty: true,
        showCancelButton: true,
        saveWorkspace: false,
        isAppBeingPreparedToQuit: false,
      },
    );
    return false;
  };
  const cancelled = await f.invoke("project_close", { confirm: true });
  await settle();
  assert.equal(
    f.api.job({ jobId: cancelled.jobId }).state,
    "native_returned_false",
  );
  assert.equal(f.control.isWorking(f.project.guid, working.guid), true);
  const context = await f.context();
  f.project.close = async () => true;
  const closed = await f.invoke("project_close", { confirm: true });
  await settle();
  assert.equal(f.api.job({ jobId: closed.jobId }).state, "native_succeeded");
  assert.equal(f.control.isWorking(f.project.guid, working.guid), false);
  assert.throws(() => f.api.handle(context.project.$ref), {
    code: "HANDLE_EXPIRED",
  });
});

test("sequence tab close works for a protected original without deleting it or widening content access; 26.2 gate applies", async () => {
  const f = fixture();
  const before = f.sequences.slice();
  const job = await f.invoke("close_sequence", { sequenceId: f.source.guid });
  await settle();
  assert.equal(f.calls[0].name, "closeSequence");
  assert.equal(f.calls[0].args[0], f.source);
  assert.deepEqual(f.sequences, before);
  assert.equal(f.control.mayEdit(f.project.guid, f.source.guid), false);
  assert.equal(f.api.job({ jobId: job.jobId }).state, "native_succeeded");
  await assert.rejects(f.invoke("close_sequence", { sequenceId: "missing" }), {
    code: "SEQUENCE_NOT_FOUND",
  });
  f.inspectHost.version = "26.1.0";
  await assert.rejects(
    f.invoke("close_sequence", { sequenceId: f.source.guid }),
    { code: "UNSUPPORTED_HOST" },
  );
  assert.equal(f.calls.length, 1);
});

test("opening a project consumes only an owned typed options draft and rechecks active context after file authorization", async () => {
  const f = fixture();
  f.module.OpenProjectOptions = class {
    setAddToMRUList(value) {
      this.addToMRUList = value;
      return this;
    }
  };
  f.module.Project.open = async (...args) => {
    f.calls.push({ name: "open", args });
    return f.project;
  };
  const options = (
    await f.api.construct({ memberId: "new OpenProjectOptions" })
  ).value;
  await f.api.mutate(
    {
      projectId: f.project.guid,
      memberId: "OpenProjectOptions#setAddToMRUList",
      target: options.$ref,
      parameters: { addToMRUList: false },
    },
    deadline(),
  );
  await f.invoke("project_open", {
    path: "other.prproj",
    openOptions: options.$ref,
  });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].args[0], "/granted/other.prproj");
  assert.equal(f.calls[0].args[1].addToMRUList, false);
  await assert.rejects(
    f.invoke("project_open", {
      path: "other.prproj",
      openOptions: options.$ref,
      createNew: true,
    }),
    { code: "INVALID_API_ARGUMENT" },
  );
  const color = (await f.api.construct({ memberId: "new Color" })).value;
  await assert.rejects(
    f.invoke("project_open", { path: "other.prproj", openOptions: color.$ref }),
    { code: "INVALID_API_ARGUMENT" },
  );
  f.api.handle(options.$ref).scope.ownedValue = false;
  await assert.rejects(
    f.invoke("project_open", {
      path: "other.prproj",
      openOptions: options.$ref,
    }),
    { code: "INVALID_API_ARGUMENT" },
  );
  f.apiHost.path = async () => {
    f.apiHost.getActiveProject = async () => ({ guid: "changed" });
    return "/granted/other.prproj";
  };
  await assert.rejects(f.invoke("project_open", { path: "other.prproj" }), {
    code: "ACTIVE_CONTEXT_CHANGED",
  });
  assert.equal(f.calls.length, 1);
});

test("late preparation failures leave no orphan project job or native invocation", async () => {
  for (const reason of ["disabled", "project-changed", "path-denied"]) {
    const f = fixture();
    f.apiHost.path = async () => {
      if (reason === "disabled") f.apiHost.writesEnabled = () => false;
      if (reason === "project-changed")
        f.apiHost.getActiveProject = async () => ({ guid: "changed" });
      if (reason === "path-denied") throw new Error("Denied");
      return "/granted/comps.aep";
    };
    await assert.rejects(
      f.invoke("import_all_ae_comps", { path: "comps.aep" }),
    );
    assert.equal(f.calls.length, 0);
    assert.equal(f.api.jobs.size, 0);
  }
});

test("close rejects hosts that cannot prove the required prompt/cancel options", async () => {
  const f = fixture();
  f.module.CloseProjectOptions.prototype.setPromptIfDirty = () => {};
  await assert.rejects(f.invoke("project_close", { confirm: true }), {
    code: "CLOSE_OPTIONS_UNVERIFIABLE",
  });
  assert.equal(f.calls.length, 0);
});

test("pending project jobs block generic and convenience mutations but allow context and job reads", async () => {
  const f = fixture();
  let finish;
  f.project.importAllAEComps = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const started = await f.invoke("import_all_ae_comps", { path: "comps.aep" });
  assert.equal(started.state, "running");
  const context = await f.context();
  assert.ok(context.project.$ref);
  await assert.rejects(f.invoke("create_sequence", { name: "blocked" }), {
    code: "PROJECT_OPERATION_IN_PROGRESS",
  });
  await assert.rejects(f.api.save({ projectId: f.project.guid }, deadline()), {
    code: "PROJECT_OPERATION_IN_PROGRESS",
  });
  await assert.rejects(f.invoke("project_close", { confirm: true }), {
    code: "PROJECT_OPERATION_IN_PROGRESS",
  });
  assert.equal(f.api.job({ jobId: started.jobId }).state, "running");
  finish(false);
  await settle();
  assert.equal(
    f.api.job({ jobId: started.jobId }).result.partialImportPossible,
    true,
  );
  const paused = await f.invoke("project_set_growing_media_paused", {
    paused: true,
  });
  await settle();
  assert.equal(f.api.job({ jobId: paused.jobId }).state, "native_succeeded");
  assert.deepEqual(f.calls.at(-1), { name: "pauseGrowing", args: [true] });
});

test("native exception/rejection/nonboolean outcomes stay uncertain and are never retried or leaked", async () => {
  for (const implementation of [
    () => {
      throw new Error("/private/secret.aep");
    },
    () => Promise.reject(new Error("/private/secret.aep")),
    async () => undefined,
  ]) {
    const f = fixture();
    let count = 0;
    f.project.importAllAEComps = (...args) => {
      count++;
      return implementation(...args);
    };
    const started = await f.invoke("import_all_ae_comps", {
      path: "comps.aep",
    });
    await settle();
    const job = f.api.job({ jobId: started.jobId });
    assert.equal(job.state, "failed");
    assert.equal(job.error.code, "OPERATION_OUTCOME_UNKNOWN");
    assert.ok(!JSON.stringify(job).includes("/private/secret"));
    assert.equal(count, 1);
  }
});

test("job capacity and running native jobs prevent lifecycle work without native execution", async () => {
  const f = fixture();
  f.api.jobs.set("existing", {
    state: "running",
    scope: { projectId: f.project.guid },
  });
  await assert.rejects(f.invoke("project_close", { confirm: true }), {
    code: "JOB_IN_PROGRESS",
  });
  f.api.jobs.clear();
  for (let i = 0; i < 100; i++)
    f.api.jobs.set("job-" + i, { state: "native_succeeded", scope: {} });
  await assert.rejects(f.invoke("import_all_ae_comps", { path: "comps.aep" }), {
    code: "JOB_LIMIT",
  });
  assert.equal(f.calls.length, 0);
});

test("new contracts reject UUID omission, unknown executable fields and malformed names at the UXP boundary", () => {
  const args = {
    projectId: "p",
    operationId: randomUUID(),
    path: "file.aep",
    compNames: ["Title / Intro"],
  };
  assert.doesNotThrow(() => validateArgs("import_ae_comps", args));
  for (const changed of [
    { ...args, operationId: undefined },
    { ...args, code: "eval()" },
    { ...args, compNames: ["x".repeat(257)] },
    { ...args, compNames: ["bad\0name"] },
  ])
    assert.throws(() => validateArgs("import_ae_comps", changed), {
      code: "INVALID_REQUEST",
    });
});

test("durable IPC records a job before native import, replays its ID once and does not resurrect a lost job after reload", async (t) => {
  const { FileBridge, prepareBridge } = await import("../mcp/file-bridge.mjs");
  const directory = await fs.mkdtemp(
    join(tmpdir(), "premiere-project-operation-"),
  );
  await prepareBridge(directory);
  const f = fixture();
  const args = {
    projectId: f.project.guid,
    operationId: randomUUID(),
    path: "comps.aep",
  };
  let calls = 0;
  f.project.importAllAEComps = async () => {
    calls++;
    const receipt = JSON.parse(
      await fs.readFile(
        join(directory, `operation-${args.operationId}.json`),
        "utf8",
      ),
    );
    assert.equal(receipt.state, "started");
    return true;
  };
  let uxp = new UxpBridge(f.inspectHost, () => {}, f.control, f.api);
  await uxp.start(folderAdapter(directory));
  t.after(async () => {
    uxp.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const bridge = new FileBridge(directory, { timeoutMs: 10000, pollMs: 5 });
  const first = await bridge.call("import_all_ae_comps", args);
  const replay = await bridge.call("import_all_ae_comps", args);
  assert.equal(replay.jobId, first.jobId);
  assert.equal(calls, 1);
  uxp.stop();
  const freshApi = new PremiereApi(f.apiHost, f.control);
  uxp = new UxpBridge(f.inspectHost, () => {}, f.control, freshApi);
  await uxp.start(folderAdapter(directory));
  assert.equal(
    (await bridge.call("import_all_ae_comps", args)).jobId,
    first.jobId,
  );
  await assert.rejects(bridge.call("api_get_job", { jobId: first.jobId }), {
    code: "JOB_NOT_FOUND",
  });
  await assert.rejects(
    bridge.call("import_all_ae_comps", { ...args, path: "other.aep" }),
    { code: "OPERATION_ID_CONFLICT" },
  );
  assert.equal(calls, 1);
});

test("real MCP discovers all six named contracts, validates composition names and hides writes in read-only mode", async (t) => {
  const { Client, InMemoryTransport } = await import(
    "@modelcontextprotocol/client"
  );
  const { createAdapter } = await import("../mcp/adapter.mjs");
  let calls = 0;
  for (const readOnly of [false, true]) {
    const server = createAdapter({
      readOnly,
      bridge: {
        call: async () => {
          calls++;
          return { jobId: "fixture-job" };
        },
      },
    }).createServer();
    const client = new Client({ name: "project-contract-test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    t.after(async () => {
      await client.close();
      await server.close();
    });
    await server.connect(b);
    await client.connect(a);
    const tools = (await client.listTools()).tools;
    assert.equal(
      tools.length,
      readOnly
        ? tools.filter((tool) => tool.annotations.readOnlyHint).length
        : 43,
    );
    const matrix = await client.readResource({
      uri: "premiere://api/coverage-matrix",
    });
    assert.equal(JSON.parse(matrix.contents[0].text).members.length, 707);
    for (const name of [
      "import_ae_comps",
      "import_all_ae_comps",
      "import_sequences",
      "project_close",
      "close_sequence",
      "project_set_growing_media_paused",
    ])
      assert.equal(
        tools.some((tool) => tool.name === `premiere_${name}`),
        !readOnly,
      );
    if (readOnly) continue;
    const result = await client.callTool({
      name: "premiere_import_ae_comps",
      arguments: {
        projectId: "p",
        operationId: randomUUID(),
        path: "file.aep",
        compNames: ["Name / 1"],
      },
    });
    assert.equal(result.structuredContent.jobId, "fixture-job");
    const invalid = await client.callTool({
      name: "premiere_import_ae_comps",
      arguments: {
        projectId: "p",
        operationId: randomUUID(),
        path: "file.aep",
        compNames: ["bad\0name"],
      },
    });
    assert.equal(invalid.isError, true);
  }
  assert.equal(calls, 1);
});

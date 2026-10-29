const test = require("node:test");
const assert = require("node:assert/strict");

async function connect(t, options = {}) {
  const { Client, InMemoryTransport } = await import(
    "@modelcontextprotocol/client"
  );
  const { createAdapter } = await import("../mcp/adapter.mjs");
  const adapter = createAdapter(options);
  const server = adapter.createServer();
  const client = new Client({
    name: "adapter-contract-test",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { adapter, server, client };
}

test("adapter discovery and offline references do not call the native host", async (t) => {
  let calls = 0;
  const bridge = {
    call() {
      calls++;
      throw new Error("Host must stay offline");
    },
  };
  const { adapter, client } = await connect(t, { bridge });
  assert.equal(adapter.manifest.contract, "adobe-local-mcp-adapter");
  assert.equal(adapter.manifest.contractVersion, 1);
  assert.equal(adapter.manifest.id, "premiere");
  const tools = (await client.listTools()).tools;
  assert.ok(tools.length >= 33);
  assert.ok(
    tools.every((tool) => tool.name.startsWith(adapter.manifest.toolPrefix)),
  );
  assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length);
  assert.ok(
    tools
      .find((tool) => tool.name === "premiere_move_clip")
      .inputSchema.required.includes("operationId"),
  );
  const resources = (await client.listResources()).resources;
  const templates = (await client.listResourceTemplates()).resourceTemplates;
  assert.ok(resources.length > 0 && templates.length > 0);
  assert.ok(
    resources.every(
      (resource) => new URL(resource.uri).protocol === "premiere:",
    ),
  );
  assert.ok(
    templates.every((template) => template.uriTemplate.startsWith("premiere:")),
  );
  const reference = await client.callTool({
    name: "premiere_api_coverage",
    arguments: {},
  });
  assert.equal(reference.structuredContent.members, 707);
  const resource = await client.readResource({ uri: "premiere://api/index" });
  assert.equal(JSON.parse(resource.contents[0].text).types, 73);
  assert.equal(calls, 0);
});

test("independent adapter sessions preserve native arguments, results and error uncertainty", async (t) => {
  const observed = [];
  const a = await connect(t, {
    bridge: {
      async call(command, args, signal) {
        observed.push({ command, args, signal });
        if (command === "create_sequence") {
          throw Object.assign(
            new Error("The original write outcome is unknown."),
            {
              code: "OPERATION_OUTCOME_UNKNOWN",
            },
          );
        }
        return { project: { id: "host-a", name: "<untrusted name>" } };
      },
    },
  });
  const b = await connect(t, {
    bridge: {
      async call() {
        return { project: { id: "host-b" } };
      },
    },
  });
  assert.notEqual(a.server, b.server);
  const result = await a.client.callTool({
    name: "premiere_get_project",
    arguments: { includePath: false },
  });
  assert.deepEqual(result.structuredContent, {
    project: { id: "host-a", name: "<untrusted name>" },
  });
  assert.equal(
    result.content[0].text,
    JSON.stringify(result.structuredContent),
  );
  assert.deepEqual(observed[0].args, { includePath: false });
  assert.equal(observed[0].command, "get_project");
  assert.ok(observed[0].signal instanceof AbortSignal);
  const operationId = "11111111-1111-4111-8111-111111111111";
  const args = { operationId, projectId: "host-a", name: "disposable" };
  const failure = await a.client.callTool({
    name: "premiere_create_sequence",
    arguments: args,
  });
  assert.equal(failure.isError, true);
  assert.equal(
    failure.structuredContent.error.code,
    "OPERATION_OUTCOME_UNKNOWN",
  );
  assert.equal(failure.structuredContent.operationId, operationId);
  assert.deepEqual(observed[1].args, args);
  assert.equal(observed.length, 2); // No retry or fallback after an uncertain write.
  await a.client.close();
  const other = await b.client.callTool({
    name: "premiere_get_project",
    arguments: {},
  });
  assert.equal(other.structuredContent.project.id, "host-b");
});

test("read-only adapter rejects writes and foreign tools without forwarding to host", async (t) => {
  let calls = 0;
  const { client } = await connect(t, {
    readOnly: true,
    bridge: {
      async call() {
        calls++;
        return {};
      },
    },
  });
  const tools = (await client.listTools()).tools;
  assert.ok(tools.length > 0);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint));
  for (const name of [
    "premiere_create_sequence",
    "ae_context",
    "arbitrary_eval",
  ]) {
    try {
      const result = await client.callTool({ name, arguments: {} });
      assert.equal(result.isError, true);
    } catch (error) {
      assert.match(error.message, /not found|unknown|not registered/i);
    }
  }
  assert.equal(calls, 0);
});

test("MCP cancellation reaches the originating adapter transport without retry", async (t) => {
  let calls = 0;
  let started;
  let cancelled;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const aborted = new Promise((resolve) => {
    cancelled = resolve;
  });
  const { client } = await connect(t, {
    bridge: {
      async call(command, args, signal) {
        calls++;
        started();
        await new Promise((resolve) =>
          signal.addEventListener(
            "abort",
            () => {
              cancelled();
              resolve();
            },
            { once: true },
          ),
        );
        throw Object.assign(new Error("Cancelled"), {
          code: "REQUEST_CANCELLED",
        });
      },
    },
  });
  const controller = new AbortController();
  const pending = client.callTool(
    { name: "premiere_get_project", arguments: {} },
    {
      signal: controller.signal,
    },
  );
  const rejection = assert.rejects(pending, /abort|cancel/i);
  await entered;
  controller.abort();
  await rejection;
  await Promise.race([
    aborted,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("Native transport did not receive cancellation")),
        1000,
      );
      timer.unref();
    }),
  ]);
  assert.equal(calls, 1);
});

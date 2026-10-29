// Read-only live check. Run only after connecting the UXP plugin to the bridge folder.
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";

const client = new Client({ name: "premiere-bridge-smoke", version: "0.2.0" });
try {
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [fileURLToPath(new URL("./server.mjs", import.meta.url))],
    env: { ...process.env }
  }));
  const { tools } = await client.listTools();
  assert.ok(tools.some((tool) => tool.name === "premiere_get_capabilities"));
  const capabilities = await client.callTool({ name: "premiere_get_capabilities", arguments: {} });
  if (capabilities.isError) throw new Error(capabilities.content[0]?.text ?? "Plugin capabilities unavailable");
  const results = { capabilities: capabilities.structuredContent };
  for (const name of ["premiere_get_project", "premiere_get_active_sequence"]) {
    const response = await client.callTool({ name, arguments: {} });
    if (response.isError) throw new Error(response.content[0]?.text ?? "Premiere read failed");
    const data = response.structuredContent;
    assert.equal(data.readOnly, true);
    assert.equal(typeof data.host.version, "string");
    results[name] = data;
  }
  const repeat = await client.callTool({ name: "premiere_get_project", arguments: {} });
  assert.ok(!repeat.isError);
  assert.deepEqual(repeat.structuredContent.project, results.premiere_get_project.project,
    "Project metadata changed during the check. Retry with Premiere idle.");
  if (!process.argv.includes("--metadata-only")) {
    const response = await client.callTool({ name: "premiere_get_sequence_clips", arguments: { limit: 10 } });
    if (response.isError) throw new Error(response.content[0]?.text ?? "Premiere clip read failed");
    assert.equal(response.structuredContent.readOnly, true);
    const sequenceId = results.premiere_get_active_sequence.activeSequence?.id ?? null;
    assert.equal(response.structuredContent.activeSequence?.id ?? null, sequenceId);
    results.premiere_get_sequence_clips = response.structuredContent;
  }
  console.log(JSON.stringify({ verification: "live-host-read-only", tools: tools.map((t) => t.name), results }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}

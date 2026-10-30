// Read-only, privacy-preserving connection diagnosis. No installer/UI operations.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { FileBridge } from "../mcp/file-bridge.mjs";
import catalog from "../build/lib/command-catalog.cjs";
import protocol from "../build/lib/bridge-protocol.cjs";

export async function doctor({
  offline = false,
  bridge = new FileBridge(process.env.PREMIERE_MCP_BRIDGE_DIR ?? "auto"),
} = {}) {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
  );
  const aligned =
    pkg.version === manifest.version && pkg.version === protocol.PLUGIN_VERSION;
  const nodeSupported = Number(process.versions.node.split(".")[0]) >= 22;
  const report = {
    ok: aligned && nodeSupported,
    nodeSupported,
    nodeVersion: process.versions.node,
    expectedVersion: pkg.version,
    sourceVersionsMatch: aligned,
    mode: offline ? "offline-only" : "live-read-only",
    nativeVerified: false,
  };
  if (!aligned || !nodeSupported || offline) return report;
  try {
    const capabilities = await bridge.call("get_capabilities", {});
    report.runningVersion = /^\d+\.\d+\.\d+$/.test(
      capabilities.bridgeVersion ?? "",
    )
      ? capabilities.bridgeVersion
      : "invalid";
    report.runtimeVersionMatches = capabilities.bridgeVersion === pkg.version;
    const registered = new Set(
      (capabilities.commands ?? []).map((command) => command.name),
    );
    report.missingCommands = catalog.COMMAND_LIST.map(
      (entry) => "premiere_" + entry.command,
    ).filter((name) => !registered.has(name));
    if (!report.runtimeVersionMatches || report.missingCommands.length) {
      return {
        ...report,
        ok: false,
        code: "RUNTIME_VERSION_MISMATCH",
        next: "Installer registration is not runtime activation. Save your work yourself, quit/reopen Premiere when convenient with UDT closed, open the installed panel and rerun doctor. Do not uninstall or remove plugin data.",
      };
    }
    const project = await bridge.call("get_project", {});
    const sequence = await bridge.call("get_active_sequence", {});
    return {
      ...report,
      projectOpen: !!project.project,
      activeSequencePresent: !!sequence.activeSequence,
      nativeVerified: false,
      verification: "connection-and-version-only",
      next: "Connection/version reads passed. This does not verify editing, import or export; use the disposable release test plan.",
    };
  } catch (error) {
    return {
      ...report,
      ok: false,
      code:
        typeof error.code === "string" && /^[A-Z_]{1,64}$/.test(error.code)
          ? error.code
          : "CONNECTION_CHECK_FAILED",
      next: "Open Premiere and the installed bridge panel, then rerun doctor. See docs/troubleshooting.md. No private host error text is printed.",
    };
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.slice(2).some((arg) => arg !== "--offline")) {
    console.error("Usage: npm run doctor -- [--offline]");
    process.exitCode = 1;
  } else {
    const result = await doctor({
      offline: process.argv.includes("--offline"),
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }
}

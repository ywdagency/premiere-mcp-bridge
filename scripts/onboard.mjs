// Local installation utility only. Never exposed as an MCP tool.
import {
  readFile,
  writeFile,
  mkdtemp,
  rm,
  lstat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setup, clientConfig } from "./setup.mjs";
import { withPublishedRelease } from "./download-release.mjs";
import { readCcxPayload } from "./ccx-payload.mjs";
import { supportedPlatform, installReviewedPackage } from "./install-platform.mjs";
import protocol from "../build/lib/bridge-protocol.cjs";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export { MAC_UPIA as UPIA } from "./install-platform.mjs";
export const PAYLOAD = [
  "manifest.json",
  "data/ADOBE-COPYRIGHT.txt",
  "data/ADOBE-LICENSE.txt",
  "dist/main.js",
  "index.html",
  "LICENSE",
  "styles.css",
];

export async function withVerifiedPackage(
  { ccx, sha256, root = ROOT },
  action,
) {
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(sha256))
    throw new Error(
      "Provide the SHA-256 from the reviewed release checksum, not a checksum generated from an unknown download.",
    );
  const stat = await lstat(ccx);
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024)
    throw new Error("Expected a regular CCX file under 16 MiB.");
  const bytes = await readFile(ccx);
  if (
    bytes.length > 16 * 1024 * 1024 ||
    createHash("sha256").update(bytes).digest("hex") !== sha256.toLowerCase()
  )
    throw new Error("CCX checksum mismatch. Nothing was installed.");
  const temporary = await mkdtemp(join(tmpdir(), "premiere-install-"));
  try {
    const snapshot = join(temporary, "reviewed.ccx");
    await writeFile(snapshot, bytes, { mode: 0o600, flag: "wx" });
    const archivedFiles = await readCcxPayload(bytes, PAYLOAD);
    const manifest = JSON.parse(
      await readFile(join(root, "manifest.json"), "utf8"),
    );
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (
      pkg.version !== manifest.version ||
      pkg.version !== protocol.PLUGIN_VERSION
    )
      throw new Error("Source package and plugin versions differ.");
    for (const name of PAYLOAD) {
      const archived = archivedFiles.get(name);
      const source = await readFile(join(root, name));
      const matches =
        name === "manifest.json"
          ? isDeepStrictEqual(
              JSON.parse(archived.toString("utf8")),
              JSON.parse(source.toString("utf8")),
            )
          : archived.equals(source);
      if (!matches)
        throw new Error(
          "CCX payload does not match this built checkout: " + name,
        );
    }
    return await action({
      snapshot,
      version: manifest.version,
      sha256: sha256.toLowerCase(),
      files: archivedFiles.size,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function onboard(argv = process.argv.slice(2), dependencies = {}) {
  if (argv.length === 1 && argv[0] === "--help")
    return {
      usage:
        "npm run onboard -- (--release | --ccx FILE --sha256 HASH) [--install] [--client codex|claude|cursor|vscode|json] [--read-only]",
      default:
        "Validate only; --install explicitly invokes Adobe and configures the client. --release downloads only the exact published checkout version.",
    };
  let ccx,
    sha256,
    install = false,
    readOnly = false,
    client = "codex",
    release = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ccx") ccx = argv[++i];
    else if (argv[i] === "--sha256") sha256 = argv[++i];
    else if (argv[i] === "--client") client = argv[++i];
    else if (argv[i] === "--install") install = true;
    else if (argv[i] === "--release") release = true;
    else if (argv[i] === "--read-only") readOnly = true;
    else
      throw new Error("Run npm run onboard -- --help for supported options.");
  }
  if (
    (!ccx && !release) ||
    (release && (ccx || sha256)) ||
    !["codex", "claude", "cursor", "vscode", "json"].includes(client)
  )
    throw new Error(
      "Choose --release or --ccx with --sha256 and a supported --client.",
    );
  const platform = dependencies.platform ?? process.platform;
  supportedPlatform(platform);
  if (release) {
    const pkg = JSON.parse(
      await readFile(join(dependencies.root ?? ROOT, "package.json"), "utf8"),
    );
    return withPublishedRelease(
      pkg.version,
      ({ ccx, sha256 }) =>
        onboard(
          [
            "--ccx",
            ccx,
            "--sha256",
            sha256,
            "--client",
            client,
            ...(install ? ["--install"] : []),
            ...(readOnly ? ["--read-only"] : []),
          ],
          dependencies,
        ),
      dependencies.fetcher,
    );
  }
  const installWithAdobe =
    dependencies.installWithAdobe ??
    (snapshot => installReviewedPackage(snapshot, {platform}));
  const configure =
    dependencies.configure ??
    (async (args) => {
      if (client === "codex") return setup(args);
      return JSON.parse(
        clientConfig(client, {
          nodePath: process.execPath,
          serverPath: join(ROOT, "mcp/server.mjs"),
          directory: "auto",
          readOnly,
        }),
      );
    });
  return withVerifiedPackage(
    { ccx: resolve(ccx), sha256, root: dependencies.root ?? ROOT },
    async (review) => {
      const summary = {
        version: review.version,
        sha256: review.sha256,
        files: review.files,
        installed: false,
        configured: false,
      };
      if (!install)
        return {
          ...summary,
          next: "Verified only. Add --install to invoke Adobe and configure the selected MCP client.",
        };
      await installWithAdobe(review.snapshot);
      const configuration = await configure([
        "--client",
        client,
        ...(readOnly ? ["--read-only"] : []),
      ]);
      return {
        ...summary,
        installed: true,
        configured: client === "codex",
        ...(configuration ? { clientConfiguration: configuration } : {}),
        next: "Open the Premiere MCP Bridge panel in Premiere, reconnect the MCP client, then run npm run doctor. Adobe confirmation or a normal owner-controlled Premiere restart may be needed; this command does not restart it.",
      };
    },
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await onboard(), null, 2));
  } catch (error) {
    const message =
      typeof error.message === "string" &&
      /^(Provide |Expected |CCX |Source |Choose |Only |A published |Release |Run npm |Installer )/.test(
        error.message,
      )
        ? error.message
        : "Check the CCX path, trusted checksum, matching source build and Adobe Creative Cloud installer.";
    console.error(
      "Onboarding did not complete. " +
        message +
        " No restart, uninstall or project save was requested.",
    );
    process.exitCode = 1;
  }
}

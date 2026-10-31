import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPOSITORY = "ywdagency/premiere-uxp-bridge";
async function bounded(response, maximum) {
  if (!response.ok)
    throw new Error(
      "A published matching release is unavailable. Use a reviewed local CCX until publication.",
    );
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maximum)
      throw new Error("Release response exceeds its size limit.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
export async function withPublishedRelease(version, action, fetcher = fetch) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("Expected an exact numeric release version.");
  const tag = "v" + version;
  const metadata = JSON.parse(
    (
      await bounded(
        await fetcher(
          "https://api.github.com/repos/" +
            REPOSITORY +
            "/releases/tags/" +
            tag,
          {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "Premiere-MCP-Bridge",
            },
            signal: AbortSignal.timeout(30000),
          },
        ),
        1024 * 1024,
      )
    ).toString("utf8"),
  );
  if (metadata.draft || !metadata.published_at || metadata.tag_name !== tag)
    throw new Error("Only a published matching release can be downloaded.");
  const filename = "premiere-mcp-bridge-" + version + ".ccx";
  const find = (name) => {
    const matches = (metadata.assets ?? []).filter(
      (asset) => asset.name === name,
    );
    if (
      matches.length !== 1 ||
      matches[0].browser_download_url !==
        "https://github.com/" +
          REPOSITORY +
          "/releases/download/" +
          tag +
          "/" +
          name
    )
      throw new Error("Expected exactly one official release asset: " + name);
    return matches[0].browser_download_url;
  };
  const checksumUrl = find(filename + ".sha256");
  const packageUrl = find(filename);
  const checksum = (
    await bounded(
      await fetcher(checksumUrl, { signal: AbortSignal.timeout(30000) }),
      4096,
    )
  )
    .toString("utf8")
    .trim();
  const match = /^([a-f0-9]{64})\s+\*?([^\r\n]+)$/i.exec(checksum);
  if (!match || match[2] !== filename)
    throw new Error("Release checksum does not identify the expected CCX.");
  const bytes = await bounded(
    await fetcher(packageUrl, { signal: AbortSignal.timeout(120000) }),
    16 * 1024 * 1024,
  );
  const temporary = await mkdtemp(join(tmpdir(), "premiere-download-"));
  try {
    const ccx = join(temporary, filename);
    await writeFile(ccx, bytes, { mode: 0o600, flag: "wx" });
    return await action({ ccx, sha256: match[1] });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

// Stages exact reviewed assets; never creates a tag, release or remote upload.
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, withVerifiedPackage } from "./onboard.mjs";

export async function prepareAssets({ ccx, sha256, root = ROOT }) {
  return withVerifiedPackage({ ccx, sha256, root }, async (review) => {
    const destination = join(
      root,
      "artifacts/public-release",
      "v" + review.version,
    );
    await mkdir(join(root, "artifacts/public-release"), { recursive: true });
    await mkdir(destination); // Refuse to overwrite a prior review snapshot.
    const filename = "premiere-mcp-bridge-" + review.version + ".ccx";
    await copyFile(review.snapshot, join(destination, filename));
    await writeFile(
      join(destination, filename + ".sha256"),
      review.sha256 + "  " + filename + "\n",
      { flag: "wx" },
    );
    return {
      version: review.version,
      directory: relative(root, destination),
      assets: [filename, filename + ".sha256"],
      sha256: review.sha256,
      published: false,
    };
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--ccx" || args[2] !== "--sha256")
    throw new Error(
      "Usage: npm run release:assets -- --ccx FILE --sha256 REVIEWED_HASH",
    );
  console.log(
    JSON.stringify(
      await prepareAssets({ ccx: args[1], sha256: args[3] }),
      null,
      2,
    ),
  );
}

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const {zipBuffer} = require('./helpers/zip-fixture.cjs');

async function fixture(t) {
  const { ROOT, PAYLOAD, onboard } = await import("../scripts/onboard.mjs");
  const dir = await fs.mkdtemp(join(tmpdir(), "premiere-onboarding-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ccx = join(dir, "reviewed fixture.ccx");
  const entries = await Promise.all(PAYLOAD.map(async name => ({name, bytes:await fs.readFile(join(ROOT,name))})));
  await fs.writeFile(ccx, await zipBuffer(entries));
  const bytes = await fs.readFile(ccx);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const calls = [];
  const dependencies = {
    platform: "darwin",
    installWithAdobe: async (path) => {
      assert.ok((await fs.stat(path)).isFile());
      calls.push("install");
    },
    configure: async (args) => {
      calls.push(args);
    },
  };
  return {
    ROOT,
    PAYLOAD,
    dir,
    ccx,
    sha256,
    bytes,
    entries,
    onboard,
    calls,
    dependencies,
    args: ["--ccx", ccx, "--sha256", sha256],
  };
}

test("reviewed seven-file CCX check is non-installing and installation uses the same validated private snapshot", async (t) => {
  const f = await fixture(t);
  const check = await f.onboard(f.args, f.dependencies);
  assert.equal(check.installed, false);
  assert.equal(check.configured, false);
  assert.deepEqual(f.calls, []);
  const result = await f.onboard(
    [...f.args, "--install", "--read-only"],
    f.dependencies,
  );
  assert.equal(result.installed, true);
  assert.equal(result.configured, true);
  assert.deepEqual(f.calls, ["install", ["--client", "codex", "--read-only"]]);
});

test('Windows onboarding validates the same archive and reaches only the explicit injected installer', async t => {
  const f=await fixture(t);
  const dependencies={...f.dependencies,platform:'win32'};
  const check=await f.onboard(f.args,dependencies);
  assert.equal(check.installed,false); assert.deepEqual(f.calls,[]);
  const installed=await f.onboard([...f.args,'--install'],dependencies);
  assert.equal(installed.installed,true);
  assert.equal(f.calls[0],'install');
});

test('portable CCX validation rejects duplicates, missing files, linked entries and compressed oversized payloads', async t => {
  const f=await fixture(t);
  const cases=[
    f.entries.slice(1),
    f.entries.map((e,i)=>i===f.entries.length-1?{...e,name:f.entries[0].name}:e),
    f.entries.map((e,i)=>i===0?{...e,mode:0o120777}:e),
    f.entries.map((e,i)=>i===0?{...e,bytes:Buffer.alloc(8*1024*1024+1)}:e),
  ];
  for(const entries of cases) {
    const bytes=await zipBuffer(entries); await fs.writeFile(f.ccx,bytes);
    const hash=createHash('sha256').update(bytes).digest('hex');
    await assert.rejects(f.onboard(['--ccx',f.ccx,'--sha256',hash,'--install'],f.dependencies),/CCX/);
  }
  assert.deepEqual(f.calls,[],'Rejected archives must never install or configure');
});

test('local/central filename disagreement and encrypted metadata reject before Adobe invocation', async t => {
  const f=await fixture(t);
  const mismatch=Buffer.from(f.bytes);
  assert.equal(mismatch.readUInt32LE(0),0x04034b50);
  mismatch[30]=mismatch[30]===109?77:109;
  const encrypted=Buffer.from(f.bytes);
  const central=encrypted.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  assert.ok(central>=0);encrypted.writeUInt16LE(encrypted.readUInt16LE(central+8)|1,central+8);
  for(const bytes of [mismatch,encrypted,Buffer.from('not a zip')]) {
    await fs.writeFile(f.ccx,bytes);
    await assert.rejects(f.onboard(['--ccx',f.ccx,'--sha256',createHash('sha256').update(bytes).digest('hex'),'--install'],f.dependencies),/CCX/);
  }
  assert.deepEqual(f.calls,[]);
});

test("bad checksum, unexpected entries, unknown client and unsupported platform never call the installer or configure clients", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.onboard(
      ["--ccx", f.ccx, "--sha256", "0".repeat(64), "--install"],
      f.dependencies,
    ),
    /checksum/,
  );
  await assert.rejects(
    f.onboard([...f.args, "--client", "unknown", "--install"], f.dependencies),
    /client/,
  );
  await assert.rejects(
    f.onboard([...f.args, "--install"], {
      ...f.dependencies,
      platform: "linux",
    }),
    /macOS/,
  );
  await fs.writeFile(f.ccx, await zipBuffer([...f.entries,{name:'unexpected.txt',bytes:Buffer.from('not allowed')}]));
  const sha = createHash("sha256")
    .update(await fs.readFile(f.ccx))
    .digest("hex");
  await assert.rejects(
    f.onboard(["--ccx", f.ccx, "--sha256", sha, "--install"], f.dependencies),
    /unexpected/,
  );
  assert.deepEqual(f.calls, []);
});

test("payload mismatch blocks installation, and Adobe failure never writes client config", async (t) => {
  const f = await fixture(t);
  const changedRoot = join(f.dir, "changed");
  for (const name of ["package.json", ...f.PAYLOAD]) {
    await fs.mkdir(require("node:path").dirname(join(changedRoot, name)), {
      recursive: true,
    });
    await fs.copyFile(join(f.ROOT, name), join(changedRoot, name));
  }
  await fs.appendFile(
    join(changedRoot, "dist/main.js"),
    "\n// different payload",
  );
  await assert.rejects(
    f.onboard([...f.args, "--install"], {
      ...f.dependencies,
      root: changedRoot,
    }),
    /payload/,
  );
  await assert.rejects(
    f.onboard([...f.args, "--install"], {
      ...f.dependencies,
      installWithAdobe: async () => {
        throw new Error("Adobe unavailable");
      },
    }),
    /unavailable/,
  );
  assert.deepEqual(f.calls, []);
});

test("non-Codex client configuration is returned for manual merge and is never reported as configured", async (t) => {
  const f = await fixture(t);
  const result = await f.onboard(
    [...f.args, "--install", "--client", "claude"],
    {
      ...f.dependencies,
      configure: async () => ({ mcpServers: { premiere: {} } }),
    },
  );
  assert.equal(result.installed, true);
  assert.equal(result.configured, false);
  assert.ok(result.clientConfiguration.mcpServers.premiere);
});

test("doctor distinguishes matching runtime from installation, rejects missing commands and emits no project data", async () => {
  const { doctor } = await import("../scripts/doctor.mjs");
  const { COMMAND_LIST } = require("../build/lib/runtime.cjs");
  const version = require("../package.json").version;
  const calls = [];
  const bridge = {
    async call(command) {
      calls.push(command);
      if (command === "get_capabilities")
        return {
          bridgeVersion: version,
          commands: COMMAND_LIST.map((c) => ({
            name: "premiere_" + c.command,
          })),
        };
      return command === "get_project"
        ? { project: { name: "PRIVATE PROJECT", path: "/private/media" } }
        : { activeSequence: { name: "PRIVATE SEQUENCE" } };
    },
  };
  const ok = await doctor({ bridge });
  assert.equal(ok.ok, true);
  assert.equal(ok.nativeVerified, false);
  assert.equal(ok.activeSequencePresent, true);
  assert.ok(!JSON.stringify(ok).includes("PRIVATE"));
  assert.ok(!JSON.stringify(ok).includes("/private/media"));
  const mismatch = await doctor({
    bridge: {
      async call(command) {
        assert.equal(command, "get_capabilities");
        return { bridgeVersion: "0.0.0", commands: [] };
      },
    },
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "RUNTIME_VERSION_MISMATCH");
  const failed = await doctor({
    bridge: {
      async call() {
        throw new Error("/private/secret");
      },
    },
  });
  assert.equal(failed.ok, false);
  assert.ok(!JSON.stringify(failed).includes("/private/secret"));
  const offline = await doctor({
    offline: true,
    bridge: {
      call() {
        assert.fail("Offline doctor must not contact host");
      },
    },
  });
  assert.equal(offline.ok, true);
});

test("setup is a pure configuration step even with an unavailable bridge directory", async (t) => {
  const dir = await fs.mkdtemp(join(tmpdir(), "premiere-config-only-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const absent = join(dir, "must-not-exist");
  const output = execFileSync(
    process.execPath,
    [
      resolve(__dirname, "../scripts/setup.mjs"),
      "--client",
      "json",
      "--bridge-dir",
      absent,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  assert.ok(JSON.parse(output).mcpServers.premiere);
  await assert.rejects(fs.stat(absent), { code: "ENOENT" });
});

test("published download pins the checkout version/assets/checksum and never contacts Adobe during validation", async (t) => {
  const f = await fixture(t);
  const version = require("../package.json").version;
  const name = "premiere-mcp-bridge-" + version + ".ccx";
  const prefix =
    "https://github.com/ywdagency/premiere-mcp-bridge/releases/download/v" +
    version +
    "/";
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    if (url.startsWith("https://api.github.com/"))
      return new Response(
        JSON.stringify({
          tag_name: "v" + version,
          draft: false,
          published_at: "2026-01-01",
          assets: [name, name + ".sha256"].map((name) => ({
            name,
            browser_download_url: prefix + name,
          })),
        }),
      );
    if (url.endsWith(".sha256"))
      return new Response(f.sha256 + "  " + name + "\n");
    return new Response(f.bytes);
  };
  const result = await f.onboard(["--release"], { ...f.dependencies, fetcher });
  assert.equal(result.installed, false);
  assert.equal(urls.length, 3);
  assert.ok(urls[0].endsWith("/tags/v" + version));
  assert.deepEqual(f.calls, []);
  await assert.rejects(
    f.onboard(["--release"], {
      ...f.dependencies,
      fetcher: async () => new Response("", { status: 404 }),
    }),
    /unavailable/,
  );
  await assert.rejects(
    f.onboard(["--release"], {
      ...f.dependencies,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            draft: true,
            tag_name: "v" + version,
            published_at: null,
          }),
        ),
    }),
    /published/,
  );
  assert.deepEqual(f.calls, []);
});

test("public release asset staging produces the exact names/checksum expected by onboarding and refuses overwrite", async (t) => {
  const f = await fixture(t);
  const { prepareAssets } = await import(
    "../scripts/prepare-release-assets.mjs"
  );
  const stagingRoot = join(f.dir, "source");
  for (const name of ["package.json", ...f.PAYLOAD]) {
    await fs.mkdir(require("node:path").dirname(join(stagingRoot, name)), {
      recursive: true,
    });
    await fs.copyFile(join(f.ROOT, name), join(stagingRoot, name));
  }
  const result = await prepareAssets({
    ccx: f.ccx,
    sha256: f.sha256,
    root: stagingRoot,
  });
  const archive = join(stagingRoot, result.directory, result.assets[0]);
  assert.ok((await fs.readFile(archive)).equals(f.bytes));
  assert.equal(
    (await fs.readFile(archive + ".sha256", "utf8")).trim(),
    f.sha256 + "  " + result.assets[0],
  );
  assert.equal(result.published, false);
  await assert.rejects(
    prepareAssets({ ccx: f.ccx, sha256: f.sha256, root: stagingRoot }),
    { code: "EEXIST" },
  );
});

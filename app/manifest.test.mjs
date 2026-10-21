import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const agentDir = await mkdtemp(path.join(os.tmpdir(), "pi-web-manifest-"));
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = agentDir;
test.after(async () => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await rm(agentDir, { recursive: true, force: true });
});

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const manifest = (await jiti.import("./manifest.ts")).default;
const { dynamic } = await jiti.import("./manifest.ts");

test("manifest reads the app name at runtime without changing other metadata", () => {
  const original = process.env.PI_WEB_APP_NAME;
  try {
    assert.equal(dynamic, "force-dynamic");
    delete process.env.PI_WEB_APP_NAME;
    const defaults = manifest();
    assert.equal(defaults.name, "Pi Web");
    assert.equal(defaults.short_name, "Pi Web");

    // Reuse the same imported function: the environment must not be captured
    // at module load time (or baked into a statically generated manifest).
    for (const [value, expected] of [
      ["", "Pi Web"],
      [" \t\n ", "Pi Web"],
      ["Work Pi", "Work Pi"],
      ["  工作 Pi 🚀 \n", "工作 Pi 🚀"],
      ["Another Pi", "Another Pi"],
    ]) {
      process.env.PI_WEB_APP_NAME = value;
      assert.deepEqual(manifest(), {
        ...defaults,
        name: expected,
        short_name: expected,
      });
    }
  } finally {
    if (original === undefined) delete process.env.PI_WEB_APP_NAME;
    else process.env.PI_WEB_APP_NAME = original;
  }
});

test("manifest installs with the icon Settings › General chose", async () => {
  // The switch reads the same file the manifest does, so the choice is what a
  // home screen added from any device installs with.
  assert.deepEqual(manifest().icons.map((icon) => icon.src), [
    "/icons/icon-192.png",
    "/icons/icon-512.png",
  ]);

  await writeFile(path.join(agentDir, "pi-web-app-icon.json"), JSON.stringify({ id: "mbp" }));
  assert.deepEqual(manifest().icons, [
    { src: "/icons/mbp/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/mbp/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ]);

  await rm(path.join(agentDir, "pi-web-app-icon.json"), { force: true });
});

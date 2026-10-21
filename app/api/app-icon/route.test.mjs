import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const agentDir = await mkdtemp(path.join(os.tmpdir(), "pi-web-app-icon-route-"));
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
const { GET, PUT } = await jiti.import("./route.ts");

const preferencePath = path.join(agentDir, "pi-web-app-icon.json");

function put(body, headers = { host: "localhost", "Content-Type": "application/json" }) {
  return PUT(new Request("http://localhost/api/app-icon", {
    method: "PUT",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

test("saves the chosen icon for this instance, and the default as no file", async () => {
  assert.deepEqual(await (await GET()).json(), { id: "default" });
  // The default without a file is already the answer: nothing is written.
  assert.deepEqual(await (await put({ id: "default" })).json(), { id: "default" });
  await assert.rejects(readFile(preferencePath, "utf8"), { code: "ENOENT" });

  const mbp = await put({ id: "mbp" });
  assert.equal(mbp.status, 200);
  assert.deepEqual(await mbp.json(), { id: "mbp" });
  assert.deepEqual(JSON.parse(await readFile(preferencePath, "utf8")), { id: "mbp" });
  assert.deepEqual(await (await GET()).json(), { id: "mbp" });

  assert.deepEqual(await (await put({ id: "default" })).json(), { id: "default" });
  await assert.rejects(readFile(preferencePath, "utf8"), { code: "ENOENT" });
});

test("refuses an unknown icon, a foreign origin and a non-JSON body", async () => {
  await writeFile(preferencePath, JSON.stringify({ id: "mbp" }));
  assert.equal((await put({ id: "../mbp" })).status, 400);
  assert.equal((await put({})).status, 400);
  assert.equal((await put("{")).status, 400);
  assert.equal((await put({ id: "default" }, { host: "localhost", "Content-Type": "text/plain" })).status, 415);
  assert.equal((await put({ id: "default" }, { host: "localhost", origin: "https://evil.example", "Content-Type": "application/json" })).status, 403);
  // A refused request changes nothing.
  assert.deepEqual(JSON.parse(await readFile(preferencePath, "utf8")), { id: "mbp" });
});

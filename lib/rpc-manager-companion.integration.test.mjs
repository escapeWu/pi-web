import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true });
const READ_ONLY = ["find", "grep", "ls", "read"];

test("a companion session loads no extensions, takes its tools over the file's pin and records its parent", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "pi-web-companion-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const previousDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  t.after(() => { if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousDir; });
  await mkdir(join(dir, "extensions"), { recursive: true });
  await writeFile(join(dir, "extensions", "exttool.ts"), `export default function (pi) {
  pi.registerTool({ name: "ext_tool", label: "ext", description: "ext", parameters: { type: "object", properties: {} },
    execute: async () => ({ content: [{ type: "text", text: "EXT" }] }) });
}
`);
  await writeFile(join(dir, "models.json"), JSON.stringify({ providers: { fake: {
    baseUrl: "http://127.0.0.1:9", apiKey: "dummy", api: "openai-completions",
    models: [{ id: "m1", name: "M1", reasoning: false, input: ["text"], contextWindow: 1000, maxTokens: 100 }],
  } } }));
  await writeFile(join(dir, "settings.json"), JSON.stringify({ defaultProvider: "fake", defaultModel: "m1" }));

  const { startRpcSession } = await jiti.import("./rpc-manager.ts");
  const { appendSessionToolSelection, readSessionToolSelection } = await jiti.import("./session-tool-selection.ts");

  const normal = await startRpcSession("__new__normal", "", dir, {});
  t.after(() => normal.session.shutdown());
  await normal.session.waitUntilReady();
  assert.ok(normal.session.inner.getActiveToolNames().includes("ext_tool"), "the extension loads in a normal session");

  const parent = join(dir, "parent.jsonl");
  const fresh = await startRpcSession("__new__companion", "", dir, { toolNames: READ_ONLY, companion: true, parentSession: parent });
  t.after(() => fresh.session.shutdown());
  await fresh.session.waitUntilReady();
  assert.deepEqual([...fresh.session.inner.getActiveToolNames()].sort(), READ_ONLY);
  assert.equal(fresh.session.inner.sessionManager.getHeader()?.parentSession, parent);

  // A copy of a session that pinned every tool still gets the read-only tools.
  const source = SessionManager.create(dir, join(dir, "sessions"));
  appendSessionToolSelection(source, ["read", "bash", "edit", "write"]);
  source.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
  source.appendMessage({
    role: "assistant", content: [{ type: "text", text: "hi" }], api: "openai-completions", provider: "fake", model: "m1",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop", timestamp: Date.now(),
  });
  const copy = await startRpcSession(source.getSessionId(), source.getSessionFile(), undefined, { toolNames: READ_ONLY, companion: true });
  t.after(() => copy.session.shutdown());
  await copy.session.waitUntilReady();
  assert.deepEqual([...copy.session.inner.getActiveToolNames()].sort(), READ_ONLY);
  assert.deepEqual(readSessionToolSelection(copy.session.inner.sessionManager.getEntries()), READ_ONLY);
});

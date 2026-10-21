import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { APP_ICON_DEFAULT, appIconFiles, isAppIconId } = await jiti.import("./app-icon.ts");
const { readAppIconPreference, writeAppIconPreference } = await jiti.import("./app-icon-preference.ts");

test("names each variant's three files, keeping the default's paths", () => {
  assert.deepEqual(appIconFiles("default"), {
    icon192: "/icons/icon-192.png",
    icon512: "/icons/icon-512.png",
    appleTouch: "/icons/apple-touch-icon.png",
  });
  assert.deepEqual(appIconFiles("mbp"), {
    icon192: "/icons/mbp/icon-192.png",
    icon512: "/icons/mbp/icon-512.png",
    appleTouch: "/icons/mbp/apple-touch-icon.png",
  });

  assert.equal(isAppIconId("mbp"), true);
  assert.equal(isAppIconId("default"), true);
  // Anything else is the default, never a path built from the value.
  assert.equal(isAppIconId("../../etc"), false);
  assert.equal(isAppIconId(null), false);
});

test("stores the choice whole, and the default as no file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-web-app-icon-"));
  const path = join(dir, "pi-web-app-icon.json");
  try {
    assert.equal(readAppIconPreference(path), APP_ICON_DEFAULT);

    writeAppIconPreference("mbp", path);
    assert.equal(readAppIconPreference(path), "mbp");
    assert.equal(JSON.parse(await readFile(path, "utf8")).id, "mbp");

    writeAppIconPreference(APP_ICON_DEFAULT, path);
    assert.equal(existsSync(path), false);
    assert.equal(readAppIconPreference(path), APP_ICON_DEFAULT);

    // A file this build cannot read is the default, not a failed page.
    await writeFile(path, "not json at all");
    assert.equal(readAppIconPreference(path), APP_ICON_DEFAULT);
    await writeFile(path, JSON.stringify({ id: "../mbp" }));
    assert.equal(readAppIconPreference(path), APP_ICON_DEFAULT);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

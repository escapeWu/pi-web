import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadSubject() {
  return import("./file-upload.ts");
}

test("reads the configured file limit and falls back safely for invalid values", async (t) => {
  const { getMaxUploadFileBytes } = await loadSubject();
  const previous = process.env.PI_WEB_UPLOAD_MAX_FILE_MB;
  t.after(() => {
    if (previous === undefined) delete process.env.PI_WEB_UPLOAD_MAX_FILE_MB;
    else process.env.PI_WEB_UPLOAD_MAX_FILE_MB = previous;
  });
  delete process.env.PI_WEB_UPLOAD_MAX_FILE_MB;
  assert.equal(getMaxUploadFileBytes(), 50 * 1024 * 1024);
  for (const value of ["1", "75", "100", " 25 "]) {
    process.env.PI_WEB_UPLOAD_MAX_FILE_MB = value;
    assert.equal(getMaxUploadFileBytes(), Number(value) * 1024 * 1024);
  }
  for (const value of ["", "0", "-1", "1.5", "50MB", "101", "Infinity", "9007199254740993"]) {
    process.env.PI_WEB_UPLOAD_MAX_FILE_MB = value;
    assert.equal(getMaxUploadFileBytes(), 50 * 1024 * 1024, value);
  }
});

test("validates upload names without accepting paths or duplicates", async () => {
  const { validateUploadFileNames } = await loadSubject();

  assert.equal(validateUploadFileNames(["one.txt", "two file.md"]), null);
  assert.match(validateUploadFileNames(["../secret.txt"]), /must not contain a path/);
  assert.match(validateUploadFileNames(["folder\\secret.txt"]), /must not contain a path/);
  assert.match(validateUploadFileNames(["same.txt", "same.txt"]), /Duplicate/);
  assert.match(validateUploadFileNames([]), /No files/);
});

test("finds conflicts and prevents replacing directories", async (t) => {
  const { inspectUploadTargets } = await loadSubject();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-upload-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.writeFileSync(path.join(root, "file.txt"), "old");
  fs.mkdirSync(path.join(root, "directory"));

  assert.deepEqual(
    inspectUploadTargets(root, ["new.txt", "file.txt", "directory"]),
    {
      conflicts: ["file.txt", "directory"],
      nonReplaceable: ["directory"],
    },
  );
});

test("prevents replacing symbolic links", async (t) => {
  const { inspectUploadTargets } = await loadSubject();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-upload-link-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.writeFileSync(path.join(root, "file.txt"), "old");
  try {
    fs.symlinkSync("file.txt", path.join(root, "link.txt"));
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("Creating symbolic links requires additional privileges on this platform");
      return;
    }
    throw error;
  }

  assert.deepEqual(
    inspectUploadTargets(root, ["link.txt"]),
    {
      conflicts: ["link.txt"],
      nonReplaceable: ["link.txt"],
    },
  );
});

test("parses only supported conflict strategies", async () => {
  const { parseUploadConflictStrategy } = await loadSubject();

  assert.equal(parseUploadConflictStrategy(null), "error");
  assert.equal(parseUploadConflictStrategy("overwrite"), "overwrite");
  assert.equal(parseUploadConflictStrategy("skip"), "skip");
  assert.equal(parseUploadConflictStrategy("rename"), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { compactText, indexChunks, findCompact, endWithPunctuation } = await createJiti(import.meta.url).import("./text-anchor.ts");

test("only letters and digits count, whatever the markdown made of the rest", () => {
  assert.equal(compactText("The **deploy** window, 9am!"), "thedeploywindow9am");
  assert.equal(compactText("# comment\n- item"), "commentitem");
  assert.equal(compactText("  \n\t "), "");
});

test("scripts without spaces and compatibility forms compare equal", () => {
  assert.equal(compactText("部署窗口 在周五"), "部署窗口在周五");
  assert.equal(compactText("ＡＢＣ１２"), "abc12");
});

function find(chunks, text) {
  const match = findCompact(indexChunks(chunks), compactText(text));
  return match && [match.startChunk, match.startOffset, match.endChunk, match.endOffset];
}

test("a passage inside one text node is found with its offsets", () => {
  assert.deepEqual(find(["Intro. The deploy window opens. Outro."], "the deploy window opens"), [0, 7, 0, 30]);
});

test("a passage across nodes starts and ends in the right ones", () => {
  assert.deepEqual(find(["Alpha ", "beta ", "gamma delta"], "beta gamma"), [1, 0, 2, 5]);
  assert.deepEqual(find(["one", "two", "three"], "twothree"), [1, 0, 2, 5]);
});

test("offsets count UTF-16 units, so astral characters do not shift the end", () => {
  assert.deepEqual(find(["😀 hello world"], "hello"), [0, 3, 0, 8]);
});

test("a passage that is not there, or is empty, is not found", () => {
  assert.equal(find(["nothing here"], "something else"), null);
  assert.equal(find(["nothing here"], "..."), null);
});

test("a passage keeps the punctuation right after it, but not the words or spaces", () => {
  assert.equal(endWithPunctuation("on Friday. Next", 9), 10);
  assert.equal(endWithPunctuation("(see Friday).", 11), 13);
  assert.equal(endWithPunctuation("on Friday next", 9), 9);
  assert.equal(endWithPunctuation("on Friday", 9), 9);
});

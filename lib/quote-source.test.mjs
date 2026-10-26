import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { findQuoteSourceIndex } = await createJiti(import.meta.url).import("./quote-source.ts");

const texts = [
  null, // a user message: never a source
  "First finding is about caching.\n\nSecond finding: the deploy window matters.",
  null,
  "Because it blocks **Friday**.",
  "Second finding: the deploy window matters.", // said again later
];

test("the nearest earlier message that says the passage is its source", () => {
  assert.equal(findQuoteSourceIndex(texts, 4, "Second finding: the deploy window matters."), 1);
  assert.equal(findQuoteSourceIndex(texts, 5, "Second finding: the deploy window matters."), 4);
});

test("markdown that came and went does not matter, only letters and digits", () => {
  assert.equal(findQuoteSourceIndex(texts, 5, "Because it blocks Friday."), 3);
});

test("a quote is of something already said, so later messages are not looked at", () => {
  assert.equal(findQuoteSourceIndex(texts, 3, "Because it blocks Friday."), -1);
});

test("nothing found, or nothing to look for, is -1", () => {
  assert.equal(findQuoteSourceIndex(texts, 5, "words said nowhere"), -1);
  assert.equal(findQuoteSourceIndex(texts, 5, " ... "), -1);
  assert.equal(findQuoteSourceIndex([], 0, "anything"), -1);
});

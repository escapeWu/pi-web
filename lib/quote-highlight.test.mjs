import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { addQuoteHighlight, pruneQuoteHighlights, quoteHighlightCount } = await createJiti(import.meta.url).import("./quote-highlight.ts");

/**
 * A range that holds its passage until `lose()`. A node taken out of the page
 * leaves its range closed up and empty, though still in the page; a whole
 * subtree gone leaves it outside the page.
 */
function passageRange() {
  const range = {
    state: "whole",
    commonAncestorContainer: { get isConnected() { return range.state !== "detached"; } },
    toString: () => (range.state === "whole" ? "passage" : ""),
    lose(state) { range.state = state; },
  };
  return range;
}

test("a mark lasts while its quote stands in the composer", () => {
  addQuoteHighlight("> one", passageRange());
  addQuoteHighlight("> two", passageRange());
  assert.equal(quoteHighlightCount(), 2);

  pruneQuoteHighlights("typed\n\n> one\n\n> two\n\n");
  assert.equal(quoteHighlightCount(), 2);

  pruneQuoteHighlights("> one");
  assert.equal(quoteHighlightCount(), 1, "deleting a quote drops its mark");

  pruneQuoteHighlights("");
  assert.equal(quoteHighlightCount(), 0, "sending clears the composer and the rest");
});

test("a chat mark whose page text was replaced goes with the next check", () => {
  const kept = passageRange();
  const detached = passageRange();
  const closedUp = passageRange();
  addQuoteHighlight("> kept", kept);
  addQuoteHighlight("> detached", detached);
  addQuoteHighlight("> closed up", closedUp);
  detached.lose("detached");
  closedUp.lose("closed");
  pruneQuoteHighlights("> kept\n> detached\n> closed up");
  assert.equal(quoteHighlightCount(), 1);
  pruneQuoteHighlights("");
});

test("a file mark waits for its page to be drawn again instead of going", () => {
  const fromFile = passageRange();
  addQuoteHighlight("> from a file", fromFile, "/project/notes.md");
  fromFile.lose("closed");
  pruneQuoteHighlights("typing on\n\n> from a file\n\n");
  assert.equal(quoteHighlightCount(), 1, "the file's tab is away; the quote is still in the composer");
  pruneQuoteHighlights("");
  assert.equal(quoteHighlightCount(), 0);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

const { buildQuoteReference, blockInsertion, inlineCode, splitQuoteHeader, QUOTE_FILE_LABELS } = await createJiti(import.meta.url).import("./quote-reference.ts");

test("a sent quote splits into the file its header names and the passage", () => {
  assert.deepEqual(
    splitQuoteHeader("Quoted from docs/my plan.md\n\nalpha\n\nbeta"),
    { filePath: "docs/my plan.md", body: "alpha\n\nbeta" },
  );
  assert.deepEqual(splitQuoteHeader("引用自 notes.md\n\n部署窗口"), { filePath: "notes.md", body: "部署窗口" });
  assert.deepEqual(splitQuoteHeader("Quoted from notes.md"), { filePath: "notes.md", body: "" });
});

test("a chat quote has no header, even when its first words are a label", () => {
  assert.deepEqual(splitQuoteHeader("just a passage\nof two lines"), { filePath: null, body: "just a passage\nof two lines" });
  assert.deepEqual(splitQuoteHeader("Quoted from"), { filePath: null, body: "Quoted from" });
});

test("every language's header label is one a sent quote is recognised by", () => {
  for (const file of ["en", "zh-CN", "zh-TW"]) {
    const source = readFileSync(new URL(`./i18n/messages/${file}.ts`, import.meta.url), "utf8");
    const label = /"chat\.quoteFromFile": "([^"]+)"/.exec(source)?.[1];
    assert.ok(QUOTE_FILE_LABELS.includes(label), `${file}: ${label}`);
  }
});

test("a chat selection is a bare blockquote", () => {
  assert.equal(buildQuoteReference(" first line\nsecond line \n"), "> first line\n> second line");
});

test("a file selection names the file in a header line", () => {
  assert.equal(
    buildQuoteReference("alpha\n\nbeta", `Quoted from ${inlineCode("docs/plan.md")}`),
    "> Quoted from `docs/plan.md`\n>\n> alpha\n>\n> beta",
  );
});

test("blank lines stay blank quote lines and CRLF is normalised", () => {
  assert.equal(buildQuoteReference("a\r\n   \r\nb"), "> a\n>\n> b");
});

test("an empty selection builds nothing, header or not", () => {
  assert.equal(buildQuoteReference("  \n "), "");
  assert.equal(buildQuoteReference("", "Quoted from `x`"), "");
});

test("the code span outgrows backticks in a path", () => {
  assert.equal(inlineCode("a/b.md"), "`a/b.md`");
  assert.equal(inlineCode("a`b.md"), "``a`b.md``");
  assert.equal(inlineCode("`edge`"), "`` `edge` ``");
});

test("a block lands in a paragraph of its own with the caret below it", () => {
  assert.equal(blockInsertion("", "", "> q"), "> q\n\n");
  assert.equal(blockInsertion("typed", "", "> q"), "\n\n> q\n\n");
  assert.equal(blockInsertion("typed\n", "", "> q"), "\n> q\n\n");
  assert.equal(blockInsertion("typed\n\n", "", "> q"), "> q\n\n");
  assert.equal(blockInsertion("typed", "tail", "> q"), "\n\n> q\n\n");
  assert.equal(blockInsertion("typed", "\ntail", "> q"), "\n\n> q\n");
  assert.equal(blockInsertion("typed", "\n\ntail", "> q"), "\n\n> q");
  assert.equal(blockInsertion("typed", "", ""), "");
});

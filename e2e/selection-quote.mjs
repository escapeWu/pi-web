import assert from "node:assert/strict";
import { showSidebarFiles } from "./sidebar.mjs";

export const quoteNotesFixture = "# Quote notes\n\nThe deploy window opens at **nine** on Friday.\n\nA second paragraph with `inline code`.\n";
const PARAGRAPH = "The deploy window opens at nine on Friday.";
const FINDING = "Second finding: the deploy window matters.";

/** The passages marked for quotes that are still in the composer. */
const markedPassages = (page) => page.evaluate(
  () => [...(CSS.highlights.get("pi-quote") ?? [])].map((range) => range.toString().trim()),
);

/** A session whose user messages sent quotes: of a reply (twice), of the notes file, and of nothing that exists. */
export function quotedSessionEntries(message) {
  const reply = (id, parentId, text) => message(id, parentId, "assistant", [{ type: "text", text }]);
  return [
    message("u1", null, "user", "Summarize the plan"),
    reply("a1", "u1", `First finding is about caching.\n\n${FINDING}`),
    message("u2", "a1", "user", `> ${FINDING}\n\nWhy this one?`),
    reply("a2", "u2", "Because it blocks Friday."),
    message("u3", "a2", "user", `> Quoted from \`quote-notes.md\`\n>\n> ${PARAGRAPH}\n\nIs nine right?`),
    reply("a3", "u3", "Yes."),
    message("u4", "a3", "user", `> ${FINDING}\n\nAnd again?`),
    reply("a4", "u4", "Same reason."),
    message("u5", "a4", "user", "> Nothing like this anywhere\n\nHmm"),
    reply("a5", "u5", "Not sure."),
  ];
}

/*
 * Selecting text in an assistant reply or in a markdown file's preview shows a
 * toolbar: Quote puts the selection into the composer as a blockquote (the
 * file's path in a header line for a file), Copy quote puts the same text on
 * the clipboard. Desktop only: a phone's long-press selection has no pointer
 * release to hook.
 */
export async function checkSelectionQuote(page, markdownFile) {
  const composer = page.locator("textarea").first();
  const toolbar = page.getByRole("toolbar", { name: "Quote selected text", exact: true });
  const quoteButton = toolbar.getByRole("button", { name: "Quote", exact: true });
  const copyButton = toolbar.getByRole("button", { name: "Copy quote", exact: true });
  const selectParagraph = (locator) => locator.click({ clickCount: 3 });

  // Chat: a reply's text, on by default (nothing stored in this fresh profile).
  const reply = page.locator('[data-message-role="assistant"]').last().getByText("E2E answer paragraph.").first();
  await reply.waitFor();
  await composer.fill("");
  await selectParagraph(reply);
  await quoteButton.click();
  assert.equal(await composer.inputValue(), "> E2E answer paragraph.\n\n");
  assert.equal(await toolbar.count(), 0, "Quote closes the toolbar");
  // The quoted passage stays marked, though the click on Quote dropped the selection.
  assert.deepEqual(await markedPassages(page), ["E2E answer paragraph."]);

  // File: the markdown preview names the file.
  const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
  if (await showSidebar.isVisible()) await showSidebar.click();
  await showSidebarFiles(page);
  await page.getByTitle(markdownFile.replace(/\\/g, "/"), { exact: true }).click();
  const panel = page.locator("#file-panel");
  const paragraph = panel.locator(".markdown-file-preview p", { hasText: PARAGRAPH });
  await paragraph.waitFor();

  await composer.fill("Typed first");
  await page.waitForFunction(() => !CSS.highlights.get("pi-quote")?.size);
  assert.deepEqual(await markedPassages(page), [], "Replacing the text takes the quote, and its mark, away");
  await selectParagraph(paragraph);
  await quoteButton.click();
  assert.deepEqual(await markedPassages(page), [PARAGRAPH]);
  const value = await composer.inputValue();
  const match = /^Typed first\n\n> Quoted from `([^`]+)`\n>\n> (.+)\n\n$/.exec(value);
  assert.ok(match, `Unexpected composer text: ${JSON.stringify(value)}`);
  assert.ok(match[1].endsWith("quote-notes.md"), `The header names the file: ${match[1]}`);
  assert.equal(match[2], PARAGRAPH);
  await page.keyboard.type("ok");
  assert.ok((await composer.inputValue()).endsWith("\n\nok"), "The caret waits below the quote");

  // Copy quote: the same text on the clipboard, then the toolbar goes.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await selectParagraph(paragraph);
  await copyButton.click();
  await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `> Quoted from \`${match[1]}\`\n>\n> ${PARAGRAPH}`);
  await toolbar.waitFor({ state: "detached" });

  // Escape dismisses it, and the source view offers none.
  await selectParagraph(paragraph);
  await toolbar.waitFor();
  await page.keyboard.press("Escape");
  await toolbar.waitFor({ state: "detached" });
  await panel.getByRole("button", { name: "Source", exact: true }).click();
  const sourceLine = panel.locator(".file-source-view", { hasText: "Quote notes" });
  await sourceLine.waitFor();
  await sourceLine.getByText(PARAGRAPH.slice(0, 12)).first().click({ clickCount: 3 });
  await page.waitForTimeout(200);
  assert.equal(await toolbar.count(), 0, "Source view has no quote toolbar");
  await panel.getByRole("button", { name: "Preview", exact: true }).click();
  // The preview was drawn anew; the mark is found in it again.
  await page.waitForFunction(() => [...(CSS.highlights.get("pi-quote") ?? [])].some((range) => range.toString().includes("deploy window")));
  assert.deepEqual(await markedPassages(page), [PARAGRAPH], "Typing and switching views leave the mark");
  await composer.fill("");
  await page.waitForFunction(() => !CSS.highlights.get("pi-quote")?.size);
  // Leave the layout as checkFilePanel does: the open panel narrows the chat the next checks measure.
  await panel.getByRole("button", { name: "Hide file panel", exact: true }).click();
  console.log("PASS: selected chat and markdown text quote into the composer, with the file named");
}

/*
 * A quote the user sent has a way back to its source: hovering the blockquote
 * offers "Jump to source", which scrolls the passage into view and flashes it,
 * in the chat or in the file the quote's header names. Nothing is stored: the
 * source is found again by its text.
 */
export async function checkQuoteJump(page, { base, sessionId }) {
  await page.goto(`${base}/?session=${sessionId}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Not sure.").waitFor();
  const flashed = () => page.evaluate(() => [...(CSS.highlights.get("pi-quote-flash") ?? [])].map((range) => {
    const parent = range.startContainer.parentElement;
    return {
      text: range.toString().trim(),
      in: parent?.closest("[data-message-role]")?.getAttribute("data-message-role") ?? (parent?.closest("#file-panel") ? "file-panel" : null),
    };
  }));
  const jumpButton = (wrap) => wrap.getByRole("button", { name: "Jump to source", exact: true });

  // A reply quoted twice: the jump lands on the reply, not on the user's earlier quote of its words.
  const second = page.locator(".quote-jump-wrap", { hasText: FINDING }).last();
  await second.hover();
  await jumpButton(second).click();
  assert.deepEqual(await flashed(), [{ text: FINDING, in: "assistant" }]);
  await page.waitForFunction(() => !CSS.highlights.has("pi-quote-flash"), null, { timeout: 5000 });

  // A file quote opens the file and flashes the passage in its preview.
  const fromFile = page.locator(".quote-jump-wrap", { hasText: "Quoted from" });
  await fromFile.hover();
  await jumpButton(fromFile).click();
  const panel = page.locator("#file-panel");
  await panel.locator(".markdown-file-preview p", { hasText: PARAGRAPH }).waitFor();
  await page.waitForFunction(() => [...(CSS.highlights.get("pi-quote-flash") ?? [])].some((range) => range.startContainer.parentElement?.closest("#file-panel")));
  assert.deepEqual(await flashed(), [{ text: PARAGRAPH, in: "file-panel" }]);

  // A quote of words that are nowhere says so, then offers the jump again.
  const nowhere = page.locator(".quote-jump-wrap", { hasText: "Nothing like this" });
  await nowhere.hover();
  await jumpButton(nowhere).click();
  await nowhere.getByRole("button", { name: "Source not found", exact: true }).waitFor();
  await jumpButton(nowhere).waitFor();

  await panel.getByRole("button", { name: "Hide file panel", exact: true }).click();
  console.log("PASS: a sent quote jumps back to its source in the chat or in the file");
}

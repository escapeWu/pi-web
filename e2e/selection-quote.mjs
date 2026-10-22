import assert from "node:assert/strict";
import { showSidebarFiles } from "./sidebar.mjs";

export const quoteNotesFixture = "# Quote notes\n\nThe deploy window opens at **nine** on Friday.\n\nA second paragraph with `inline code`.\n";
const PARAGRAPH = "The deploy window opens at nine on Friday.";

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

  // File: the markdown preview names the file.
  const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
  if (await showSidebar.isVisible()) await showSidebar.click();
  await showSidebarFiles(page);
  await page.getByTitle(markdownFile.replace(/\\/g, "/"), { exact: true }).click();
  const panel = page.locator("#file-panel");
  const paragraph = panel.locator(".markdown-file-preview p", { hasText: PARAGRAPH });
  await paragraph.waitFor();

  await composer.fill("Typed first");
  await selectParagraph(paragraph);
  await quoteButton.click();
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
  await composer.fill("");
  // Leave the layout as checkFilePanel does: the open panel narrows the chat the next checks measure.
  await panel.getByRole("button", { name: "Hide file panel", exact: true }).click();
  console.log("PASS: selected chat and markdown text quote into the composer, with the file named");
}

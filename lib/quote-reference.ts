// What a quoted selection becomes in the composer: a markdown blockquote, so
// it reads the same in the user's own bubble and for the model. A quote from a
// file names the file in a header line; one from the chat is the bare text,
// since the model already has that conversation.

/** `text` as an inline code span; the fence outgrows any backtick run inside it. */
export function inlineCode(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * `text` as a blockquote, one `>` per line, after an optional header line.
 * Returns "" for a selection with nothing in it.
 */
export function buildQuoteReference(text: string, header?: string): string {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  if (lines.length === 1 && !lines[0]) return "";
  const quoted = lines.map((line) => (line.trim() ? `> ${line.trimEnd()}` : ">"));
  return header ? [`> ${header}`, ">", ...quoted].join("\n") : quoted.join("\n");
}

/**
 * What to insert so `block` stands as a paragraph of its own between `before`
 * and `after` (the composer's text around the caret), with the caret left in
 * a fresh paragraph below it for the user's comment.
 */
export function blockInsertion(before: string, after: string, block: string): string {
  if (!block) return "";
  const lead = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return lead + block + tail;
}

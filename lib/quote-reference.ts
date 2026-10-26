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
 * The header labels a file quote has led with (`chat.quoteFromFile` of each
 * language), so a sent quote is recognised whichever language it was written
 * in. A test keeps the list in step with the language files.
 */
export const QUOTE_FILE_LABELS = ["Quoted from", "引用自"] as const;

/**
 * A sent quote's text (as rendered: the header line, if any, then the quoted
 * lines) split into the file its header names and the quoted passage.
 */
export function splitQuoteHeader(text: string): { filePath: string | null; body: string } {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const newline = normalized.indexOf("\n");
  const first = newline === -1 ? normalized : normalized.slice(0, newline);
  for (const label of QUOTE_FILE_LABELS) {
    if (!first.startsWith(`${label} `)) continue;
    const filePath = first.slice(label.length + 1).trim();
    if (filePath) return { filePath, body: newline === -1 ? "" : normalized.slice(newline + 1).trim() };
  }
  return { filePath: null, body: normalized };
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

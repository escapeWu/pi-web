import { compactText, findTextRange } from "./text-anchor";

/** A user message's blockquote that offers "jump to source" (components/QuoteSourceJump.tsx). */
export const QUOTE_BLOCK_SELECTOR = ".quote-jump-wrap";

/**
 * Which message `body` was quoted from, found in the messages themselves
 * rather than on the page: the page leaves out a folded process, a row
 * outside the render window. `texts[i]` is what message `i` can be quoted
 * for (null when it cannot be a source); only messages before `before` count,
 * nearest first, since a quote is of something already said. Its index, or -1.
 */
export function findQuoteSourceIndex(texts: readonly (string | null)[], before: number, body: string): number {
  const needle = compactText(body);
  if (!needle) return -1;
  for (let index = Math.min(before, texts.length) - 1; index >= 0; index -= 1) {
    const text = texts[index];
    if (text && compactText(text).includes(needle)) return index;
  }
  return -1;
}

/** The first passage of `body` under any of `roots`, outside the sent quotes themselves (a quote shown elsewhere is not the passage it quotes). */
export function findQuotePassage(roots: Iterable<Node>, body: string): Range | null {
  for (const root of roots) {
    const range = findTextRange(root, body, (node) => !node.parentElement?.closest(QUOTE_BLOCK_SELECTOR));
    if (range) return range;
  }
  return null;
}

/**
 * Where in the rendered chat `body` was quoted from, by what is on the page:
 * the nearest message before the one holding `blockquote` that says it.
 */
export function findQuoteSourceInChat(chat: HTMLElement, blockquote: HTMLElement, body: string): Range | null {
  const entries = Array.from(chat.querySelectorAll<HTMLElement>("[data-entry-id]"));
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    // Only messages above the quote: skip it, what contains it and what follows.
    if (entry.contains(blockquote) || !(entry.compareDocumentPosition(blockquote) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const range = findQuotePassage([entry], body);
    if (range) return range;
  }
  return null;
}

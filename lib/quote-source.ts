import { findTextRange } from "./text-anchor";

/** A user message's blockquote that offers "jump to source" (components/QuoteSourceJump.tsx). */
export const QUOTE_BLOCK_SELECTOR = ".quote-jump-wrap";

/**
 * Where in the rendered chat `body` was quoted from: the nearest message
 * before the one holding `blockquote` that says it. The user's own earlier
 * quotes of the same passage do not count as the passage.
 */
export function findQuoteSourceInChat(chat: HTMLElement, blockquote: HTMLElement, body: string): Range | null {
  const entries = Array.from(chat.querySelectorAll<HTMLElement>("[data-entry-id]"));
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    // Only messages above the quote: skip it, what contains it and what follows.
    if (entry.contains(blockquote) || !(entry.compareDocumentPosition(blockquote) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const range = findTextRange(entry, body, (node) => !node.parentElement?.closest(QUOTE_BLOCK_SELECTOR));
    if (range) return range;
  }
  return null;
}

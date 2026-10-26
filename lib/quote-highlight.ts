// The marks a quote leaves on its source, painted with the CSS Custom
// Highlight API: the page's DOM is never touched, so React's rendering of the
// message or the markdown preview is not disturbed. Safari before 17.2 has no
// such API; there the quote simply stays unmarked (the flash falls back to a
// class on the passage's block).
//
// Two registrations, styled in globals.css:
//  - `pi-quote`: the passages whose quote still stands in the composer. Quoting
//    adds one, and it goes when the quote leaves the composer (sent, deleted or
//    edited). A file's preview that is drawn again (another view or tab and
//    back) takes its marks along; they are found again in the new drawing
//    (`reanchorQuoteHighlights`).
//  - `pi-quote-flash`: the passage a "jump to source" landed on, for a moment.

import { compactText, findTextRange } from "./text-anchor";

const QUOTE_HIGHLIGHT = "pi-quote";
const FLASH_HIGHLIGHT = "pi-quote-flash";
const FLASH_CLASS = "quote-source-flash";
const FLASH_MS = 1800;

interface QuoteMark {
  /** The text the composer holds while the mark stands. */
  reference: string;
  range: Range;
  /** The passage's own text, to find it again when its page is drawn again. */
  text: string;
  /** What the page is called when it can be drawn again (a file's path); a chat's messages are not found again. */
  scope?: string;
}

let marks: QuoteMark[] = [];
let clearFlash: (() => void) | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The page drew its text anew. A node taken out of the page does not leave
 * its range behind in it: the range closes up where the node was (still in
 * the page, empty), so "connected" is no sign; its text is.
 */
function lostItsText(mark: QuoteMark): boolean {
  const { range } = mark;
  return !range.commonAncestorContainer.isConnected || compactText(range.toString()) !== compactText(mark.text);
}

export function quoteHighlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight === "function";
}

function publish(): void {
  if (!quoteHighlightsSupported()) return;
  if (marks.length === 0) CSS.highlights.delete(QUOTE_HIGHLIGHT);
  else CSS.highlights.set(QUOTE_HIGHLIGHT, new Highlight(...marks.map((mark) => mark.range)));
}

/** Marks `range` while `reference` stands in the composer. */
export function addQuoteHighlight(reference: string, range: Range, scope?: string): void {
  marks = [...marks, { reference, range, text: range.toString(), scope }];
  publish();
}

/** Drops the marks whose quote `composerText` no longer holds, and those whose page text is gone for good. */
export function pruneQuoteHighlights(composerText: string): void {
  if (marks.length === 0) return;
  const kept = marks.filter((mark) => (
    composerText.includes(mark.reference)
    && (mark.scope !== undefined || !lostItsText(mark))
  ));
  if (kept.length === marks.length) return;
  marks = kept;
  publish();
}

/** The page of `scope` was drawn into `root`: its marks that lost their text are found in it again. */
export function reanchorQuoteHighlights(root: Node, scope: string): void {
  let changed = false;
  marks = marks.map((mark) => {
    if (mark.scope !== scope || !lostItsText(mark)) return mark;
    const range = findTextRange(root, mark.text);
    if (!range) return mark;
    changed = true;
    return { ...mark, range };
  });
  if (changed) publish();
}

export function quoteHighlightCount(): number {
  return marks.length;
}

/** Marks `range` for a moment; without the Highlight API, `fallback` gets a flashing class instead. */
export function flashQuoteSource(range: Range, fallback?: Element | null): void {
  endFlash();
  if (quoteHighlightsSupported()) {
    CSS.highlights.set(FLASH_HIGHLIGHT, new Highlight(range));
    clearFlash = () => CSS.highlights.delete(FLASH_HIGHLIGHT);
  } else if (fallback) {
    void (fallback as HTMLElement).offsetWidth; // a second flash on the same block restarts its animation
    fallback.classList.add(FLASH_CLASS);
    clearFlash = () => fallback.classList.remove(FLASH_CLASS);
  } else {
    return;
  }
  flashTimer = setTimeout(endFlash, FLASH_MS);
}

function endFlash(): void {
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = null;
  clearFlash?.();
  clearFlash = null;
}

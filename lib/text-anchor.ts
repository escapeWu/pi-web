// Finding quoted text again in rendered DOM. A quote travels as markdown, so
// what comes back differs from the page it was taken from: emphasis marks and
// list numbers are gone, spaces and line breaks differ, a heading may have
// been parsed out of a `#`. Only letters and digits survive all of that, so
// two texts are the same passage when their letters and digits are.

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** What one character adds to the comparison text: its letters and digits in compatibility form, lower-cased; nothing for a space or punctuation. */
function foldChar(char: string): string {
  let folded = "";
  for (const part of char.normalize("NFKC")) {
    if (WORD_CHAR.test(part)) folded += part.toLowerCase();
  }
  return folded;
}

/** The comparison text of `text`. */
export function compactText(text: string): string {
  let compact = "";
  for (const char of text) compact += foldChar(char);
  return compact;
}

export interface CompactIndex {
  /** The comparison text of all chunks in a row. */
  text: string;
  /** For each UTF-16 unit of `text`: the chunk it came from and the unit range there. */
  chunk: number[];
  start: number[];
  end: number[];
}

/** The comparison text of `chunks` (text nodes in document order) with, for each of its units, where it came from. */
export function indexChunks(chunks: readonly string[]): CompactIndex {
  const index: CompactIndex = { text: "", chunk: [], start: [], end: [] };
  chunks.forEach((data, chunk) => {
    let offset = 0;
    for (const char of data) {
      const folded = foldChar(char);
      for (let unit = 0; unit < folded.length; unit += 1) {
        index.chunk.push(chunk);
        index.start.push(offset);
        index.end.push(offset + char.length);
      }
      index.text += folded;
      offset += char.length;
    }
  });
  return index;
}

export interface CompactMatch {
  startChunk: number;
  startOffset: number;
  endChunk: number;
  endOffset: number;
}

/** Where `needle` (a `compactText()`) first occurs in `index`, as positions in the chunks. */
export function findCompact(index: CompactIndex, needle: string): CompactMatch | null {
  if (!needle) return null;
  const at = index.text.indexOf(needle);
  if (at === -1) return null;
  const last = at + needle.length - 1;
  return { startChunk: index.chunk[at], startOffset: index.start[at], endChunk: index.chunk[last], endOffset: index.end[last] };
}

/** Where a passage ending at `offset` of `data` ends once the punctuation right after it (a full stop, a closing bracket) is counted in. */
export function endWithPunctuation(data: string, offset: number): number {
  const trailing = /^[^\p{L}\p{N}\s]+/u.exec(data.slice(offset));
  return offset + (trailing?.[0].length ?? 0);
}

/**
 * The first passage under `root` whose letters and digits are `text`'s, or null.
 * `accept` leaves text nodes out of the search (a quote shown elsewhere in the
 * same page is not the passage it quotes).
 */
export function findTextRange(root: Node, text: string, accept?: (node: Text) => boolean): Range | null {
  const needle = compactText(text);
  if (!needle) return null;
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!accept || accept(node as Text)) nodes.push(node as Text);
  }
  const match = findCompact(indexChunks(nodes.map((node) => node.data)), needle);
  if (!match) return null;
  const range = document.createRange();
  range.setStart(nodes[match.startChunk], match.startOffset);
  range.setEnd(nodes[match.endChunk], endWithPunctuation(nodes[match.endChunk].data, match.endOffset));
  return range;
}

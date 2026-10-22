import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Quoting a selection into the composer leaves the caret at the quote's end so
// the comment is typed after it. `window.getSelection().removeAllRanges()` clears the
// focused textarea's selection too and drops the caret to offset 0 (#1319).
// The demo is a snapshot of the app taken earlier, which still names it askSelectionHere.
test("quoting a selection in the current chat keeps the caret at the quote's end", async () => {
  for (const [path, name] of [["../components/ChatWindow.tsx", "quoteSelectionHere"], ["../demo/components/ChatWindow.tsx", "askSelectionHere"]]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const body = source.match(new RegExp(`const ${name} = useCallback\\(\\([^)]*\\) => \\{[\\s\\S]*?\\}, \\[[^\\]]*\\]\\);`));
    assert.ok(body, `expected ${name} in ${path}`);
    const code = body[0].replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(
      code,
      /removeAllRanges\s*\(/,
      `${path}: inserting already collapses the page's selection, and removing ranges afterwards resets the composer's caret`,
    );
  }
});

"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps } from "react";
import type { ExtraProps } from "react-markdown";
import { useI18n } from "@/hooks/useI18n";

// A quote the user sent is a blockquote in their own bubble. Hovering it
// offers a way back to the passage it quotes. Who can find that passage
// (the chat's messages, the file panel) is the provider's business.

/** Brings the passage `blockquote` quotes into view; false when it cannot be found. It may take a few frames (a folded process opening first). */
export type QuoteJumpHandler = (blockquote: HTMLElement) => boolean | Promise<boolean>;

export const QuoteJumpContext = createContext<QuoteJumpHandler | null>(null);

const MISSING_FEEDBACK_MS = 1600;

/** MarkdownBody's `blockquote` for a user message (`quoteJump`). Outside a provider it is a plain blockquote. */
export function QuoteBlockquote({ children, ...props }: ComponentProps<"blockquote"> & ExtraProps) {
  delete props.node;
  const { t } = useI18n();
  const jump = useContext(QuoteJumpContext);
  const blockquoteRef = useRef<HTMLQuoteElement | null>(null);
  const [missing, setMissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!jump) return <blockquote {...props}>{children}</blockquote>;

  const label = missing ? t("chat.quoteSourceMissing") : t("chat.quoteSourceJump");
  const onClick = async () => {
    if (!blockquoteRef.current || await jump(blockquoteRef.current)) return;
    setMissing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMissing(false), MISSING_FEEDBACK_MS);
  };

  return (
    <div className="quote-jump-wrap">
      <blockquote ref={blockquoteRef} {...props}>{children}</blockquote>
      <button
        type="button"
        className="quote-jump-button"
        data-missing={missing ? "true" : undefined}
        title={label}
        aria-label={label}
        onClick={onClick}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 14 4 9l5-5" />
          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
      </button>
    </div>
  );
}

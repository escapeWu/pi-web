"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/hooks/useI18n";
import { copyText } from "@/lib/clipboard";

// The small toolbar that floats under selected text (the chat's messages, a
// markdown file's preview): Quote puts the selection into the composer as a
// blockquote, Copy quote puts the same text on the clipboard. What the quote
// says about its source is the caller's (lib/quote-reference.ts).

export interface SelectionAnchor {
  text: string;
  top: number;
  left: number;
  range: Range;
}

/** The text selected inside `root` and where to put a toolbar under it; null when nothing there is selected. */
export function captureSelectionAnchor(root: HTMLElement | null): SelectionAnchor | null {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!selection || selection.isCollapsed || !range || !root || !root.contains(range.commonAncestorContainer)) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const rect = range.getBoundingClientRect();
  return {
    text,
    top: Math.min(window.innerHeight - 44, rect.bottom + 8),
    left: Math.max(64, Math.min(window.innerWidth - 64, rect.left + rect.width / 2)),
    range: range.cloneRange(),
  };
}

const BUTTON_STYLE = { width: "auto", height: 35, flex: "0 0 auto", gap: 5, padding: "0 10px", border: "none", fontSize: 12, fontWeight: 500 } as const;
const COPIED_FEEDBACK_MS = 700;

interface SelectionPopoverProps {
  anchor: { top: number; left: number };
  onClose: () => void;
  label: string;
  /** A form instead of buttons: wider, and it stays until closed (an outside click does not dismiss it). */
  dialog?: boolean;
  /** A request is under way: Escape leaves the popover be. */
  busy?: boolean;
  children: ReactNode;
}

export function SelectionPopover({ anchor, onClose, label, dialog = false, busy = false, children }: SelectionPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const popover = ref.current;
    if (!popover) return;
    const viewport = window.visualViewport;
    const position = () => {
      const rect = popover.getBoundingClientRect();
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      popover.style.top = `${Math.max(top + 8, Math.min(anchor.top, top + (viewport?.height ?? window.innerHeight) - rect.height - 8))}px`;
      popover.style.left = `${Math.max(left + 8, Math.min(anchor.left - rect.width / 2, left + (viewport?.width ?? window.innerWidth) - rect.width - 8))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(popover);
    window.addEventListener("resize", position);
    viewport?.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      viewport?.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
    };
  }, [anchor.top, anchor.left, dialog]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!dialog && !ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog, busy, onClose]);

  return createPortal(
    <div
      ref={ref}
      role={dialog ? "dialog" : "toolbar"}
      aria-label={label}
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        zIndex: 260,
        display: "flex",
        flexWrap: "wrap",
        gap: 3,
        width: dialog ? "min(420px, calc(100vw - 16px))" : undefined,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(var(--app-viewport-height, 100dvh) - 16px)",
        overflowY: "auto",
        padding: dialog ? 12 : 3,
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--bg)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface QuoteActionsProps {
  /** The quote as it is inserted or copied. */
  reference: string;
  onQuote: (reference: string) => void;
  /** The action is done; the popover can go. */
  onDone: () => void;
  /** More buttons after these two. */
  children?: ReactNode;
}

export function QuoteActions({ reference, onQuote, onDone, children }: QuoteActionsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = () => {
    // The clipboard may refuse (no permission, insecure origin): the label
    // then stays as it was and the popover simply closes.
    copyText(reference).then(() => {
      setCopied(true);
      timerRef.current = setTimeout(onDone, COPIED_FEEDBACK_MS);
    }, onDone);
  };

  return (
    <>
      <button
        type="button"
        className="file-viewer-icon-button"
        title={t("chat.quote")}
        aria-label={t("chat.quote")}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => { onQuote(reference); onDone(); }}
        style={BUTTON_STYLE}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
          <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
        </svg>
        <span>{t("chat.quote")}</span>
      </button>
      <button
        type="button"
        className="file-viewer-icon-button"
        title={copied ? t("chat.quoteCopied") : t("chat.copyQuote")}
        aria-label={copied ? t("chat.quoteCopied") : t("chat.copyQuote")}
        disabled={copied}
        onPointerDown={(event) => event.preventDefault()}
        onClick={copy}
        style={BUTTON_STYLE}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {copied
            ? <path d="m5 12 5 5L20 7" />
            : <><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>}
        </svg>
        <span>{copied ? t("chat.quoteCopied") : t("chat.copyQuote")}</span>
      </button>
      {children}
    </>
  );
}

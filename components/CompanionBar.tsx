"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { CompanionRun } from "@/lib/companions";

const POLL_MS = 2500;

/**
 * The bar above the composer while a question has companion answers
 * (lib/companions.ts): one chip per companion (its run state; a click opens
 * its session in a right-panel tab), then the button that asks this session's
 * model to compare every answer and decide, and a dismiss.
 */
export function CompanionBar({ run, mainBusy, synthesizing, onOpen, onSynthesize, onDismiss }: {
  run: CompanionRun;
  mainBusy: boolean;
  synthesizing: boolean;
  onOpen?: (sessionId: string, label: string) => void;
  onSynthesize: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  // Unknown until the first poll answers: shown as running.
  const [runningIds, setRunningIds] = useState<Set<string> | null>(null);
  const ids = run.companions.flatMap((companion) => companion.sessionId && !companion.error ? [companion.sessionId] : []);
  const idsKey = ids.join(",");
  const anyRunning = ids.length > 0 && (runningIds === null || ids.some((id) => runningIds.has(id)));

  useEffect(() => {
    if (!idsKey || !anyRunning) return;
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/agent/running", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { runningSessionIds?: string[] };
        if (!cancelled) setRunningIds(new Set(data.runningSessionIds ?? []));
      } catch {
        /* next poll */
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [idsKey, anyRunning]);

  return (
    <div style={{ paddingLeft: 16, paddingRight: isMobile ? 16 : 52, paddingBottom: 6 }}>
      <div
        role="group"
        aria-label={t("chat.companions.barLabel")}
        style={{
          maxWidth: "var(--chat-content-max-width, 820px)",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{t("chat.companions.barLabel")}</span>
        {run.companions.map((companion, index) => {
          const running = Boolean(companion.sessionId && !companion.error && (runningIds === null || runningIds.has(companion.sessionId)));
          const failed = Boolean(companion.error);
          const title = failed
            ? `${companion.label}: ${companion.error}`
            : running ? t("chat.companions.running", { model: companion.label }) : t("chat.companions.open", { model: companion.label });
          return (
            <button
              key={companion.sessionId ?? `${companion.provider}:${companion.modelId}:${index}`}
              type="button"
              title={title}
              disabled={!companion.sessionId || !onOpen}
              onClick={() => companion.sessionId && onOpen?.(companion.sessionId, companion.label)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 24,
                maxWidth: 220,
                padding: "0 8px",
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--bg-panel)",
                color: failed ? "#dc2626" : "var(--text-muted)",
                cursor: companion.sessionId && onOpen ? "pointer" : "default",
                fontSize: 12,
              }}
            >
              {running ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }} aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
              ) : failed ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <polyline points="1.5 5 4 7.5 8.5 2.5" />
                </svg>
              )}
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{companion.label}</span>
            </button>
          );
        })}
        {/* The decision and the dismiss wrap together. */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
          <button
            type="button"
            onClick={onSynthesize}
            disabled={anyRunning || mainBusy || synthesizing}
            title={anyRunning ? t("chat.companions.waiting") : mainBusy ? t("chat.companions.mainBusy") : undefined}
            style={{
              height: 24,
              padding: "0 10px",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              background: "none",
              color: "var(--accent)",
              cursor: anyRunning || mainBusy || synthesizing ? "not-allowed" : "pointer",
              opacity: anyRunning || mainBusy || synthesizing ? 0.5 : 1,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {t("chat.companions.synthesize", { count: String(run.companions.length + 1) })}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            title={t("chat.companions.dismiss")}
            aria-label={t("chat.companions.dismiss")}
            style={{
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              padding: 0,
              border: "none",
              background: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </span>
      </div>
    </div>
  );
}

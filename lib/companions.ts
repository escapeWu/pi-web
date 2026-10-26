/**
 * Companion answers (client-safe): the composer's model menu may tick up to
 * MAX_COMPANION_MODELS more models; the question then also goes to each of
 * them in a session of its own (app/api/agent/[id]/companions), and the main
 * session's model is later asked to compare their replies with its own and
 * decide. Which companions belong to a session is page state, kept per browser
 * in localStorage so the bar survives a remount or a reload.
 */

/** Companions besides the session's own model: three answers at most. */
export const MAX_COMPANION_MODELS = 2;

export interface CompanionModel {
  provider: string;
  modelId: string;
}

export interface CompanionStartResult extends CompanionModel {
  label: string;
  /** Missing when the session could not be created. */
  sessionId?: string;
  error?: string;
}

export interface CompanionRun {
  mainSessionId: string;
  startedAt: number;
  companions: CompanionStartResult[];
}

const STORAGE_PREFIX = "pi-web:companions:";
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function sameCompanionModel(a: CompanionModel | null | undefined, b: CompanionModel | null | undefined): boolean {
  return Boolean(a && b && a.provider === b.provider && a.modelId === b.modelId);
}

export function readCompanionRun(sessionId: string | null | undefined): CompanionRun | null {
  if (!sessionId) return null;
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + sessionId);
    if (!raw) return null;
    const run = JSON.parse(raw) as CompanionRun;
    return run && run.mainSessionId === sessionId && Array.isArray(run.companions) ? run : null;
  } catch {
    return null;
  }
}

export function saveCompanionRun(run: CompanionRun): void {
  try {
    storage()?.setItem(STORAGE_PREFIX + run.mainSessionId, JSON.stringify(run));
  } catch {
    /* quota or private mode: the bar is gone after a reload */
  }
  notify();
}

export function clearCompanionRun(sessionId: string): void {
  try {
    storage()?.removeItem(STORAGE_PREFIX + sessionId);
  } catch {
    /* ignore */
  }
  notify();
}

export function subscribeCompanionRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function startCompanions(sessionId: string, body: {
  message: string;
  images?: Array<{ type: "image"; data: string; mimeType: string }>;
  models: Array<CompanionModel & { label: string }>;
  thinkingLevel?: string;
  fresh?: boolean;
}): Promise<CompanionStartResult[]> {
  const res = await fetch(`/api/agent/${encodeURIComponent(sessionId)}/companions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as { companions?: CompanionStartResult[]; error?: string };
  if (!res.ok || !Array.isArray(data.companions)) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.companions;
}

interface ContentBlock {
  type?: string;
  text?: string;
}

/** The text of the last assistant message that has any, else the error that ended the run. */
export function lastAssistantText(messages: readonly unknown[]): { text: string } | { error: string } | null {
  let error: string | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: string; content?: unknown; stopReason?: string; errorMessage?: string };
    if (message?.role === "user") break;
    if (message?.role !== "assistant") continue;
    const text = typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? (message.content as ContentBlock[])
            .filter((block) => block?.type === "text" && typeof block.text === "string")
            .map((block) => block.text)
            .join("\n\n")
        : "";
    if (text.trim()) return { text: text.trim() };
    if (!error && message.stopReason === "error" && message.errorMessage) error = message.errorMessage;
  }
  return error ? { error } : null;
}

/** The latest reply of a companion session, read like the viewer tab reads it. */
export async function fetchCompanionAnswer(sessionId: string): Promise<{ text: string } | { error: string } | null> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/context?tail=40`, { cache: "no-store" });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const data = await res.json() as { context?: { messages?: unknown[] } };
  return lastAssistantText(data.context?.messages ?? []);
}

/** The message asking the main model to compare and decide: an intro, then each answer under its model's name. */
export function companionSynthesisPrompt(intro: string, answers: ReadonlyArray<{ label: string; text: string }>): string {
  return [intro, ...answers.map((answer) => `### ${answer.label}\n\n${answer.text}`)].join("\n\n");
}

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { MAX_COMPANION_MODELS, type CompanionStartResult } from "@/lib/companions";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { forkSessionBranch, readForkSourceTitle, SessionForkError } from "@/lib/session-fork";
import { shortenToCodePoints } from "@/lib/session-fork-name";
import {
  cacheSessionPath,
  invalidateSessionListCache,
  readLatestSessionEntryId,
  readSessionInfo,
  resolveSessionPath,
} from "@/lib/session-reader";
import { PRESET_READ_ONLY } from "@/lib/tool-presets";

export const dynamic = "force-dynamic";

// Companion answers: the same question sent to up to two more models, each in
// a session of its own beside this one. A session with a saved branch is
// copied at its leaf (as the sidebar's Fork copies it), before the main
// session's prompt adds the question; `fresh` (a new session, whose prompt has
// already gone out) starts empty sessions in its cwd instead. Companions load
// no extensions (nothing can stop them with a dialog nobody sees), use the
// read-only tools, and send no completion push.

const NO_STORE = { "Cache-Control": "no-store" };
const THINKING_LEVELS = new Set<string>(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
const NAME_BASE_MAX = 40;

interface CompanionModelRequest {
  provider: string;
  modelId: string;
  label: string;
}

interface CompanionRequest {
  message: string;
  images?: Array<{ type: "image"; data: string; mimeType: string }>;
  models: CompanionModelRequest[];
  thinkingLevel?: ThinkingLevel;
  fresh: boolean;
}

function refusal(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseRequest(body: unknown): CompanionRequest {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const raw = body as Record<string, unknown>;
  const message = typeof raw.message === "string" ? raw.message : "";
  const images = Array.isArray(raw.images)
    ? raw.images.map((image) => {
        const item = image as Record<string, unknown>;
        if (typeof item?.data !== "string" || typeof item.mimeType !== "string") throw new Error("Invalid image");
        return { type: "image" as const, data: item.data, mimeType: item.mimeType };
      })
    : undefined;
  if (!message.trim() && !images?.length) throw new Error("message is required");
  if (!Array.isArray(raw.models) || raw.models.length === 0 || raw.models.length > MAX_COMPANION_MODELS) {
    throw new Error(`models must list 1 to ${MAX_COMPANION_MODELS} models`);
  }
  const models = raw.models.map((value) => {
    const item = value as Record<string, unknown>;
    if (typeof item?.provider !== "string" || !item.provider || typeof item.modelId !== "string" || !item.modelId) {
      throw new Error("Each model needs a provider and a modelId");
    }
    const label = typeof item.label === "string" ? oneLine(item.label).slice(0, 60) : "";
    return { provider: item.provider, modelId: item.modelId, label: label || item.modelId };
  });
  const thinkingLevel = raw.thinkingLevel === undefined || raw.thinkingLevel === null
    ? undefined
    : typeof raw.thinkingLevel === "string" && THINKING_LEVELS.has(raw.thinkingLevel)
      ? raw.thinkingLevel as ThinkingLevel
      : (() => { throw new Error(`Invalid thinking level: ${String(raw.thinkingLevel)}`); })();
  return { message, ...(images?.length ? { images } : {}), models, ...(thinkingLevel ? { thinkingLevel } : {}), fresh: raw.fresh === true };
}

// POST /api/agent/[id]/companions - body CompanionRequest; answers { companions: CompanionStartResult[] }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiRequestAllowed(req)) return refusal(403, "Untrusted API request");
  if (!hasJsonContentType(req)) return refusal(415, "Content-Type must be application/json");
  const { id } = await params;

  let request: CompanionRequest;
  try {
    request = parseRequest(await req.json());
  } catch (error) {
    return refusal(400, error instanceof Error ? error.message : String(error));
  }

  try {
    const opened = getRpcSession(id);
    const sourcePath = (opened?.isAlive() ? opened.sessionFile : "") || await resolveSessionPath(id);
    if (!sourcePath) return refusal(404, "Session not found");
    if (!request.fresh && opened?.isAlive() && opened.isRunning()) {
      return refusal(409, "The session is running; companions start with a new question only");
    }

    let baseTitle = oneLine(request.message) || "(image)";
    let copies: Array<{ sessionId: string; path: string } | null> = request.models.map(() => null);
    if (!request.fresh) {
      const sourceTitle = await readForkSourceTitle(sourcePath);
      if (sourceTitle) baseTitle = sourceTitle;
      // No await from here until the copies exist (see the Fork route).
      const wrapper = getRpcSession(id);
      let liveLeafId = wrapper?.isAlive() ? wrapper.inner.sessionManager.getLeafId() : undefined;
      if (wrapper && liveLeafId !== undefined && !wrapper.isRunning()) {
        const diskLatest = readLatestSessionEntryId(wrapper.sessionFile);
        if (diskLatest && !wrapper.inner.sessionManager.getEntry(diskLatest)) liveLeafId = undefined;
      }
      try {
        copies = request.models.map(() => forkSessionBranch(sourcePath, liveLeafId, null));
      } catch (error) {
        // Nothing saved yet: the companions start empty, as the session does.
        if (!(error instanceof SessionForkError) || (error.code !== "empty" && error.code !== "unsaved")) throw error;
        copies = request.models.map(() => null);
      }
      for (const copy of copies) if (copy) cacheSessionPath(copy.sessionId, copy.path);
    }

    const needsCwd = copies.some((copy) => !copy);
    const cwd = needsCwd
      ? opened?.isAlive() ? opened.cwd : (await readSessionInfo(sourcePath))?.cwd
      : undefined;
    if (needsCwd && !cwd) return refusal(404, "Session not found");

    const name = (label: string) => `${shortenToCodePoints(baseTitle, NAME_BASE_MAX)} · ${label}`;
    const companions = await Promise.all(request.models.map(async (model, index): Promise<CompanionStartResult> => {
      const copy = copies[index];
      const base = { provider: model.provider, modelId: model.modelId, label: model.label };
      try {
        const { session, realSessionId } = copy
          ? await startRpcSession(copy.sessionId, copy.path, undefined, { toolNames: PRESET_READ_ONLY, companion: true })
          : await startRpcSession(`__new__${randomUUID()}`, "", cwd, {
              toolNames: PRESET_READ_ONLY,
              companion: true,
              parentSession: sourcePath,
              initialModel: { provider: model.provider, modelId: model.modelId },
              ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel } : {}),
            });
        try {
          if (copy) {
            // A copy restores the source's model.
            await session.send({ type: "set_model", provider: model.provider, modelId: model.modelId });
            if (request.thinkingLevel) await session.send({ type: "set_thinking_level", level: request.thinkingLevel });
          }
          await session.send({ type: "set_session_name", name: name(model.label) });
          await session.send({
            type: "prompt",
            message: request.message,
            ...(request.images ? { images: request.images } : {}),
          });
        } catch (error) {
          return { ...base, sessionId: realSessionId, error: error instanceof Error ? error.message : String(error) };
        }
        return { ...base, sessionId: realSessionId };
      } catch (error) {
        return { ...base, ...(copy ? { sessionId: copy.sessionId } : {}), error: error instanceof Error ? error.message : String(error) };
      }
    }));
    invalidateSessionListCache();
    return NextResponse.json({ companions }, { headers: NO_STORE });
  } catch (error) {
    invalidateSessionListCache();
    return refusal(500, error instanceof Error ? error.message : String(error));
  }
}

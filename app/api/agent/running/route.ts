import { NextResponse } from "next/server";
import { getSessionListVersion } from "@/lib/session-reader";
import {
  getAwaitingInputRpcSessionIds,
  getCompletionNotificationSuppressedRpcSessionIds,
  getRunningRpcSessionIds,
  resolveSessionIdleTimeoutMs,
} from "@/lib/rpc-manager";
import { getSessionUiStateRevision } from "@/lib/session-ui-state";

export const dynamic = "force-dynamic";

// The idle timeout is fixed for the process (PI_WEB_IDLE_TIMEOUT_MS); the
// sidebar colours a session's quiet time green while it is under this.
const IDLE_TIMEOUT_MS = resolveSessionIdleTimeoutMs();

// GET /api/agent/running - Lightweight snapshot for visible-tab polling.
// sessionUiStateRevision (null when unreadable) tells the sidebar its pins and
// archive changed elsewhere; it costs one stat while the file is unchanged.
export async function GET() {
  return NextResponse.json(
    {
      sessionListVersion: getSessionListVersion(),
      runningSessionIds: getRunningRpcSessionIds(),
      awaitingInputSessionIds: getAwaitingInputRpcSessionIds(),
      completionNotificationSuppressedSessionIds: getCompletionNotificationSuppressedRpcSessionIds(),
      sessionUiStateRevision: getSessionUiStateRevision(),
      idleTimeoutMs: IDLE_TIMEOUT_MS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

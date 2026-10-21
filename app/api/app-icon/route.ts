import { NextResponse } from "next/server";
import { isAppIconId } from "@/lib/app-icon";
import { readAppIconPreference, writeAppIconPreference } from "@/lib/app-icon-preference";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

// Settings › General's app icon choice. The manifest and the root layout read
// the same file, so a saved variant is what the next install (or a reload)
// uses.

function errorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json({ id: readAppIconPreference() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: Request) {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }
  if (!hasJsonContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = (body as { id?: unknown } | null)?.id;
  if (!isAppIconId(id)) {
    return NextResponse.json({ error: "id must be a known app icon" }, { status: 400 });
  }
  try {
    writeAppIconPreference(id);
    return NextResponse.json({ id: readAppIconPreference() });
  } catch (error) {
    return errorResponse(error);
  }
}

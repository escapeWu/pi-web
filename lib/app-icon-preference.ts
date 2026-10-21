import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { readRegularFileText } from "./regular-file";
import { APP_ICON_DEFAULT, isAppIconId, type AppIconId } from "./app-icon";

/**
 * The app icon chosen for this pi-web instance, in `pi-web-app-icon.json`
 * beside pi's own files. It belongs to the instance rather than to a browser,
 * because the PWA manifest and the root layout that name the icon are served by
 * it: a home screen added from any device installs with the same icon. No file
 * is the default and needs no write.
 *
 * The file holds this one value and writes replace it whole, so a reader sees
 * either the old or the new choice, never half of one, and no read-modify-write
 * lock is needed.
 */
const MAX_BYTES = 4 * 1024;

export function getAppIconPreferencePath(agentDir = getAgentDir()): string {
  return join(agentDir, "pi-web-app-icon.json");
}

/** Never throws: a missing, unreadable or unknown file reads as the default. */
export function readAppIconPreference(path?: string): AppIconId {
  try {
    const text = readRegularFileText(path ?? getAppIconPreferencePath(), MAX_BYTES);
    if (text === undefined) return APP_ICON_DEFAULT;
    const id = (JSON.parse(text) as { id?: unknown } | null)?.id;
    return isAppIconId(id) ? id : APP_ICON_DEFAULT;
  } catch {
    return APP_ICON_DEFAULT;
  }
}

/** The default is the absence of a file. */
export function writeAppIconPreference(id: AppIconId, path?: string): void {
  const target = path ?? getAppIconPreferencePath();
  if (id === APP_ICON_DEFAULT) {
    rmSync(target, { force: true });
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writePrivateFileAtomicSync(target, JSON.stringify({ id }, null, 2) + "\n");
}

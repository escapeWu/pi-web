/**
 * The icon this pi-web instance installs with, switched in Settings › General.
 * A variant is a folder of the same three files under `public/icons/`; the
 * default keeps the files at the paths they always had, so nothing that already
 * points at them changes. Adding a variant is a folder plus one id here.
 */
export const APP_ICON_IDS = ["default", "mbp"] as const;

export type AppIconId = (typeof APP_ICON_IDS)[number];

export const APP_ICON_DEFAULT: AppIconId = "default";

/** Each variant's name in Settings, as an i18n key. */
export const APP_ICON_LABELS: Record<AppIconId, string> = {
  default: "settings.appIconDefault",
  mbp: "settings.appIconMbp",
};

export function isAppIconId(value: unknown): value is AppIconId {
  return typeof value === "string" && (APP_ICON_IDS as readonly string[]).includes(value);
}

/** The favicon, the home-screen icon and the manifest's two sizes of one variant. */
export function appIconFiles(id: AppIconId): { icon192: string; icon512: string; appleTouch: string } {
  const base = id === APP_ICON_DEFAULT ? "/icons" : `/icons/${id}`;
  return {
    icon192: `${base}/icon-192.png`,
    icon512: `${base}/icon-512.png`,
    appleTouch: `${base}/apple-touch-icon.png`,
  };
}

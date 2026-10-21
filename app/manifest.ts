import type { MetadataRoute } from "next";
import { appIconFiles } from "@/lib/app-icon";
import { readAppIconPreference } from "@/lib/app-icon-preference";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  // The icon is Settings › General's choice for this instance, read on every
  // request (`force-dynamic`) rather than at build time.
  const icons = appIconFiles(readAppIconPreference());
  const appName = process.env.PI_WEB_APP_NAME?.trim() || "Pi Web";
  return {
    id: "/",
    name: appName,
    short_name: appName,
    description: "Local web interface for the pi coding agent",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    categories: ["developer", "productivity"],
    lang: "en",
    icons: [
      {
        src: icons.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

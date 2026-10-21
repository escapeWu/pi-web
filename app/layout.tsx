import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Noto_Sans_Mono } from "next/font/google";
import { PwaRegistration } from "@/components/PwaRegistration";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { appIconFiles } from "@/lib/app-icon";
import { readAppIconPreference } from "@/lib/app-icon-preference";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./settings.css";
import "./sidebar.css";
import "./sidebar-menu.css";

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-noto-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // The favicon and the home-screen icon follow Settings › General's choice
  // for this instance, so they are read per request rather than at build time.
  await connection();
  const icon = appIconFiles(readAppIconPreference());
  return {
    title: "Pi Web",
    description: "Pi Web interface for the pi coding agent",
    applicationName: "Pi Web",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        {
          url: icon.icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: icon.appleTouch,
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Pi Web",
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no" className={`${notoSansMono.variable} notranslate`} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body translate="no" className="notranslate" suppressHydrationWarning>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}

import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { SPLASH_DEVICES, splashMedia, splashPath } from "@/lib/splash";
import { clsx } from "clsx";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type React from "react";
import "./globals.css";

// Absolute base for social-card image URLs. Next auto-detects
// src/app/opengraph-image.png and twitter-image.png and resolves them
// against this. Per-page metadata still supplies each page's title/description.
export const metadata: Metadata = {
  metadataBase: new URL("https://agelesswisdom.school"),
  openGraph: { siteName: "The School of Ageless Wisdom", type: "website" },
  // Next 16 emits the modern `mobile-web-app-capable`; add the legacy
  // apple-prefixed name too so pre-16.4 iOS still launches in standalone.
  other: { "apple-mobile-web-app-capable": "yes" },
  // iOS "Add to Home Screen": run chrome-less (standalone), a short label
  // under the icon, an opaque status bar (this is a normal-scroll reading
  // layout, so no black-translucent under-status-bar handling), and the
  // per-device launch screens so the app doesn't flash blank on open.
  appleWebApp: {
    capable: true,
    title: "Ageless Wisdom",
    statusBarStyle: "default",
    startupImage: SPLASH_DEVICES.flatMap((device) =>
      (["dark", "light"] as const).map((scheme) => ({
        url: splashPath(scheme, device),
        media: splashMedia(scheme, device),
      })),
    ),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Match the page canvas per scheme so the browser/status-bar chrome blends
  // with the page instead of hinting the wrong shade.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
  // The site renders both schemes (system-driven `dark:` classes); tell the
  // browser so iOS Safari doesn't apply its own dark treatment.
  colorScheme: "light dark",
};

const InterVariable = localFont({
  variable: "--font-inter",
  src: [
    { path: "./InterVariable.woff2", style: "normal" },
    { path: "./InterVariable-Italic.woff2", style: "italic" },
  ],
});

// Literata (TypeTogether, OFL) — Google Play Books' reading serif, used for the
// lesson reading column (see `.prose` in typography.css). Full variable font
// with optical sizing; weight axis 200–900.
const Literata = localFont({
  variable: "--font-literata",
  src: [
    { path: "./Literata.woff2", style: "normal", weight: "200 900" },
    { path: "./Literata-Italic.woff2", style: "italic", weight: "200 900" },
  ],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={clsx(
        InterVariable.variable,
        Literata.variable,
        "scroll-pt-16 font-sans antialiased dark:bg-gray-950",
      )}
    >
      <body>
        <div className="isolate">{children}</div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

import { type MetadataRoute } from "next";

// Required for static export: this is a route handler under the hood, and
// `output: 'export'` won't emit it unless we opt into static rendering.
export const dynamic = "force-static";

// Web App Manifest — enables real "install" on Android Chrome (full-app
// icon, splash, standalone window). iOS "Add to Home Screen" is driven by
// the `appleWebApp` metadata in layout.tsx, not this manifest.
//
// Next emits this at /manifest.webmanifest at build time and injects the
// matching <link rel="manifest"> automatically.
//
// Icons: the 192/512 tiles (in public/, from `npm run gen:appicon`) drive
// the Android install icon and splash. The browser-tab favicon and the iOS
// home-screen icon come from src/app/icon.png and src/app/apple-icon.png
// (Next file conventions), not here.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The School of Ageless Wisdom",
    short_name: "Ageless Wisdom",
    description: "The Early Curriculum of Paul Foster Case",
    start_url: "/",
    display: "standalone",
    // Match the viewport themeColor in layout.tsx so the install splash and
    // the browser chrome agree.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    // Single-locale by nature (one start_url, one lang) — stays English;
    // the first-visit bounce in [locale]/layout.tsx redirects a
    // translated-locale install from "/" at launch.
    lang: "en",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Maskable variants (the glyph sits inside Android's central 80% safe
      // zone) so the circle/squircle crop never clips the artwork.
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

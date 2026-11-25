// Generates the iOS launch screens declared in src/lib/splash.ts:
// public/splash/apple-splash-{scheme}-{w}x{h}.png, one per device size per
// color scheme. The cube tile (public/icon-512.png, from gen-appicon) is
// composited onto a solid per-scheme background with iOS's rounded-corner
// treatment, so the launch screen reads as "the app icon" centered on the
// page canvas — the native launch convention. Without these, launching from
// the home screen flashes a blank page.
//
// Run with: npm run gen:appicon && npm run gen:splash  (splash reads
// icon-512, so regenerate it afterwards; then commit public/splash/)

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  SPLASH_DEVICES,
  SPLASH_SCHEMES,
  splashPath,
} from "../src/lib/splash.ts";

const ICON = join("public", "icon-512.png");
const OUT_DIR = join("public", "splash");

// Mark width as a fraction of the device's logical width — ~26% lands near
// the ~100pt a native launch icon occupies.
const MARK_FRACTION = 0.26;
// iOS app-icon corner radius is ≈ 22.37% of the tile size.
const CORNER_FRACTION = 0.2237;

async function roundedMark(sizePx: number): Promise<Buffer> {
  const radius = Math.round(sizePx * CORNER_FRACTION);
  const mask = Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  return sharp(ICON)
    .resize(sizePx, sizePx)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

mkdirSync(OUT_DIR, { recursive: true });

for (const device of SPLASH_DEVICES) {
  const width = device.w * device.scale;
  const height = device.h * device.scale;
  const markPx = Math.round(device.w * MARK_FRACTION) * device.scale;
  const mark = await roundedMark(markPx);

  for (const { scheme, bg } of SPLASH_SCHEMES) {
    const file = join("public", ...splashPath(scheme, device).split("/"));
    await sharp({ create: { width, height, channels: 3, background: bg } })
      .composite([
        {
          input: mark,
          left: Math.round((width - markPx) / 2),
          top: Math.round(height * 0.45 - markPx / 2),
        },
      ])
      .png()
      .toFile(file);
    console.log(`gen-splash: ${file} (${width}x${height})`);
  }
}

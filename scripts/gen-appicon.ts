// Generates the home-screen tiles from the vector source (assets/cube.svg),
// on an Apple-style dark background gradient. Mirrors the sister project:
//   - src/app/apple-icon.png        180  iOS home screen (Next file convention)
//   - public/icon-192.png           192  Android / manifest
//   - public/icon-512.png           512  Android / manifest + the source
//                                        gen-splash.ts composes its tiles from
//   - public/icon-maskable-192.png  192  Android maskable (same art — the
//   - public/icon-maskable-512.png  512  glyph sits inside the 80% safe zone)
//
// The tile follows Apple's native-icon conventions: a subtle vertical
// gradient (lighter at top — implied overhead light) instead of flat black,
// with the glyph centered and optically raised a hair. No baked corner
// radius, no transparency — iOS masks and processes the tile itself.
//
// Run with: npm run gen:appicon  (then commit the PNG)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CUBE_SVG = readFileSync(join("assets", "cube.svg"));

// Apple-style tile gradient, top → bottom.
const GRADIENT_TOP = "#3A3A3E";
const GRADIENT_BOTTOM = "#1A1A1C";

// Glyph height as a fraction of the tile; the cube's aspect ratio makes the
// visible width a little narrower. Tuned by eye on a real home screen.
const GLYPH_HEIGHT_FRACTION = 0.75;
// Optical centering: the cube's visual mass sits low (two full faces below
// the equator), so raise it slightly above true center.
const GLYPH_CENTER_Y = 0.49;

async function renderTile(size: number): Promise<Buffer> {
  const glyphHeight = Math.round(size * GLYPH_HEIGHT_FRACTION);
  const glyph = await sharp(CUBE_SVG)
    .resize({ height: glyphHeight })
    .png()
    .toBuffer();
  const { width: glyphWidth = 0 } = await sharp(glyph).metadata();

  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${GRADIENT_TOP}"/>` +
      `<stop offset="1" stop-color="${GRADIENT_BOTTOM}"/>` +
      `</linearGradient></defs>` +
      `<rect width="${size}" height="${size}" fill="url(#bg)"/>` +
      `</svg>`,
  );

  return sharp(background)
    .composite([
      {
        input: glyph,
        left: Math.round((size - glyphWidth) / 2),
        top: Math.round(size * GLYPH_CENTER_Y - glyphHeight / 2),
      },
    ])
    .png()
    .toBuffer();
}

const OUTPUTS: Array<{ file: string; size: number }> = [
  { file: join("src", "app", "apple-icon.png"), size: 180 },
  { file: join("public", "icon-192.png"), size: 192 },
  { file: join("public", "icon-512.png"), size: 512 },
  { file: join("public", "icon-maskable-192.png"), size: 192 },
  { file: join("public", "icon-maskable-512.png"), size: 512 },
];

for (const { file, size } of OUTPUTS) {
  await sharp(await renderTile(size)).toFile(file);
  console.log(`gen-appicon: ${file} (${size}x${size})`);
}

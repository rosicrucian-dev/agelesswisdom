// Regenerates the browser favicon (src/app/icon.png + src/app/favicon.ico)
// from the vector source (assets/cube.svg) with a TRANSPARENT background.
//
// Browser-tab favicons float on the toolbar, so the bare glyph is right
// here — unlike the home-screen tile (gen-appicon.ts), which is full-bleed
// opaque. favicon.ico is written as PNG-in-ICO (32px + 16px), which every
// modern browser reads. Mirrors ../bota-toolbox/scripts/gen-favicon.ts.
//
// Run with: npm run gen:favicon  (then commit the two files)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CUBE_SVG = readFileSync(join("assets", "cube.svg"));
const OUT_PNG = join("src", "app", "icon.png");
const OUT_ICO = join("src", "app", "favicon.ico");

// Render the glyph centered in a square transparent canvas.
async function renderSquare(size: number): Promise<Buffer> {
  return sharp(CUBE_SVG)
    .resize({
      width: size,
      height: size,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

await sharp(await renderSquare(512)).toFile(OUT_PNG);
console.log(`gen-favicon: ${OUT_PNG} (512x512, transparent)`);

// --- favicon.ico: PNG-in-ICO container with 32px and 16px entries ---
const sizes = [32, 16];
const entries: Buffer[] = [];
for (const size of sizes) {
  entries.push(await renderSquare(size));
}
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(entries.length, 4);
let offset = 6 + 16 * entries.length;
const dirs: Buffer[] = [];
entries.forEach((png, i) => {
  const dir = Buffer.alloc(16);
  dir.writeUInt8(sizes[i] % 256, 0); // width
  dir.writeUInt8(sizes[i] % 256, 1); // height
  dir.writeUInt8(0, 2); // palette
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // color planes
  dir.writeUInt16LE(32, 6); // bits per pixel
  dir.writeUInt32LE(png.length, 8);
  dir.writeUInt32LE(offset, 12);
  offset += png.length;
  dirs.push(dir);
});
writeFileSync(OUT_ICO, Buffer.concat([header, ...dirs, ...entries]));
console.log(`gen-favicon: ${OUT_ICO} (32px + 16px, transparent)`);

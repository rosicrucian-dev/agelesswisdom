// Generates the social share cards:
//
//   - src/app/opengraph-image.png  1200x630  Open Graph (Facebook, etc.)
//   - src/app/twitter-image.png    1200x630  Twitter/X (identical art)
//
// The card is a centered title + description lockup over the zinc
// scrollwork background — the same card style as the sister project
// (../bota-toolbox, emerald background, light type), inverted to dark
// type on the light ground. Next.js serves these automatically for the
// matching file conventions.
//
// Run with: npm run gen:social  (then commit the two PNGs)

import { join } from "node:path";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

const BG_IMAGE = join("public", "background-zinc.png");

// Avenir ships with macOS (Heavy title, Medium description); the SVG is
// rasterized through the system font stack, so nothing lives in the repo.
const FONT = "'Avenir', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const TITLE_WEIGHT = 800; // Avenir Heavy
const DESC_WEIGHT = 500; // Avenir Medium
const TITLE_COLOR = "#18181B"; // zinc-900
const DESC_COLOR = "#3F3F46"; // zinc-700

const TITLE_LINES = ["The School of", "Ageless Wisdom"];
const DESC_LINES = ["The Early Curriculum of Paul Foster Case"];

// Type sizes and vertical rhythm: the text block (title + description
// lines) is centered as a whole. SVG text positions use baselines, so
// BASELINE_RATIO maps each line box's top edge to its baseline.
const TITLE_SIZE = 92;
const DESC_SIZE = 34;
const TITLE_LINE_HEIGHT = 100;
const TITLE_TO_DESC_GAP = 24;
const DESC_LINE_HEIGHT = 50;
const BASELINE_RATIO = 0.78;

const TITLE_BLOCK_HEIGHT =
  TITLE_SIZE + TITLE_LINE_HEIGHT * (TITLE_LINES.length - 1);
const BLOCK_HEIGHT =
  TITLE_BLOCK_HEIGHT + TITLE_TO_DESC_GAP + DESC_LINE_HEIGHT * DESC_LINES.length;
const BLOCK_TOP = Math.round(HEIGHT / 2 - BLOCK_HEIGHT / 2);
const TITLE_FIRST_BASELINE = Math.round(BLOCK_TOP + TITLE_SIZE * BASELINE_RATIO);
const DESC_FIRST_BASELINE = Math.round(
  BLOCK_TOP + TITLE_BLOCK_HEIGHT + TITLE_TO_DESC_GAP + DESC_SIZE * BASELINE_RATIO,
);

const foreground = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<g text-anchor="middle" font-family="${FONT}">` +
    TITLE_LINES.map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${TITLE_FIRST_BASELINE + i * TITLE_LINE_HEIGHT}" font-size="${TITLE_SIZE}" font-weight="${TITLE_WEIGHT}" fill="${TITLE_COLOR}">${line}</text>`,
    ).join("") +
    DESC_LINES.map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${DESC_FIRST_BASELINE + i * DESC_LINE_HEIGHT}" font-size="${DESC_SIZE}" font-weight="${DESC_WEIGHT}" fill="${DESC_COLOR}">${line}</text>`,
    ).join("") +
    `</g>` +
    `</svg>`,
);

const card = await sharp(BG_IMAGE)
  .resize(WIDTH, HEIGHT, { fit: "cover", position: "north" })
  .composite([{ input: foreground, left: 0, top: 0 }])
  .png()
  .toBuffer();

for (const file of [
  join("src", "app", "opengraph-image.png"),
  join("src", "app", "twitter-image.png"),
]) {
  await sharp(card).toFile(file);
  console.log(`gen-social: ${file} (${WIDTH}x${HEIGHT})`);
}

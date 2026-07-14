// Generates the social share card (Open Graph + Twitter), 1200x630, from the
// vector cube (assets/cube.svg): the grayscale cube on the left, the site
// title and a one-line description on the right, over a dark background.
// Mirrors the sister project's card style. Writes both:
//   - src/app/opengraph-image.png
//   - src/app/twitter-image.png   (identical art)
// Next.js auto-wires these into <meta og:image> / <meta twitter:image>.
//
// Run with: npm run gen:social  (then commit the two PNGs)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CUBE_SVG = readFileSync(join("assets", "cube.svg"));

const W = 1200;
const H = 630;
const BG = "#1A1A1C";
const TITLE_COLOR = "#FFFFFF";
const RULE = "#B7B7BD"; // light gray, echoing the cube
const DESC_COLOR = "#9A9AA1";
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

// Cube on the left, vertically centered.
const CUBE_H = 380;
const CUBE_LEFT = 90;

// --- Text column (right of the cube) ---------------------------------------
// Horizontal: every text row AND the accent rule share one left edge (LEFT),
// so they're aligned by construction. `<text>` starts its glyph advance at x
// while `<rect>` starts its box at x; RULE_INSET is the one knob to nudge the
// rule if you want its edge under the title's ink rather than flush with the
// geometric edge (0 = flush).
const LEFT = 470;
const RIGHT_MARGIN = 72;
const COLUMN_WIDTH = W - LEFT - RIGHT_MARGIN;
const RULE_INSET = 0;

// Type sizes.
const TITLE_SIZE = 82;
const DESC_SIZE = 34;

// Vertical rhythm: laid out top-down via gaps, so adjusting one gap shifts
// everything below it. Text `y` is the baseline; the rule `y` is its top edge.
const TITLE1_BASELINE = 248;
const TITLE_LEADING = 90; // title line-to-line
const TITLE_TO_RULE = 34; // second title baseline -> rule top
const RULE_HEIGHT = 5;
const RULE_TO_DESC = 66; // rule top -> description baseline
const TITLE2_BASELINE = TITLE1_BASELINE + TITLE_LEADING;
const RULE_TOP = TITLE2_BASELINE + TITLE_TO_RULE;
const DESC_BASELINE = RULE_TOP + RULE_TO_DESC;

// Accent rule width as a fraction of the text column (not the title's width).
const RULE_RATIO = 0.5;
const RULE_WIDTH = Math.round(COLUMN_WIDTH * RULE_RATIO);

const titleRow = (y: number, text: string) =>
  `<text x="${LEFT}" y="${y}" font-size="${TITLE_SIZE}" font-weight="700" fill="${TITLE_COLOR}">${text}</text>`;

async function render(): Promise<Buffer> {
  const cube = await sharp(CUBE_SVG).resize({ height: CUBE_H }).png().toBuffer();
  const cubeTop = Math.round((H - CUBE_H) / 2);

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${BG}"/>` +
      `<g font-family="${FONT}">` +
      // Title (two lines, bold).
      titleRow(TITLE1_BASELINE, "The School of") +
      titleRow(TITLE2_BASELINE, "Ageless Wisdom") +
      // Accent rule under the title.
      `<rect x="${LEFT + RULE_INSET}" y="${RULE_TOP}" width="${RULE_WIDTH}" height="${RULE_HEIGHT}" rx="${RULE_HEIGHT / 2}" fill="${RULE}"/>` +
      // Description (one line).
      `<text x="${LEFT}" y="${DESC_BASELINE}" font-size="${DESC_SIZE}" font-weight="400" fill="${DESC_COLOR}">The Early Curriculum of Paul Foster Case</text>` +
      `</g>` +
      `</svg>`,
  );

  return sharp(svg)
    .composite([{ input: cube, left: CUBE_LEFT, top: cubeTop }])
    .png()
    .toBuffer();
}

const png = await render();
for (const file of ["opengraph-image.png", "twitter-image.png"]) {
  await sharp(png).toFile(join("src", "app", file));
  console.log(`gen-social: src/app/${file} (${W}x${H})`);
}

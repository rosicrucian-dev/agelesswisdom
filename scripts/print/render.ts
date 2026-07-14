/**
 * Shared print-rendering core: MDX -> print-ready HTML -> PDF (headless Chrome).
 *
 * Used by both print builders:
 *   - build.ts    — the full book volumes
 *   - lessons.ts  — one typeset PDF per lesson (powers the site's "PDF" button)
 *
 * Keeping the Markdown parser, inline formatting, figure/table/symbol handling,
 * font faces, and the Chrome PDF call here means a fix to any of them lands in
 * both artifacts at once.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export const ROOT = path.join(import.meta.dirname, "..", "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const APP_DIR = path.join(ROOT, "src", "app");
export const CONTENT_DIR = path.join(ROOT, "content", "lessons");
// Vendored fonts committed alongside this renderer so the PDF build is
// self-contained and reproducible on any platform (incl. the Linux CI runner).
export const FONTS_DIR = path.join(import.meta.dirname, "fonts");

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function roman(value: number): string {
  let numerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (let [n, r] of numerals) {
    while (value >= n) {
      out += r;
      value -= n;
    }
  }
  return out;
}

export function inlineMarkdown(value: string): string {
  let placeholders: string[] = [];
  let stash = (html: string) => {
    placeholders.push(html);
    return `\u0000${placeholders.length - 1}\u0000`;
  };

  value = value.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, rawAlt: string, rawSrc: string) => {
      let [alt, dims] = rawAlt.split("|");
      let dimAttrs = "";
      if (dims && /^\d+x\d+$/.test(dims)) {
        let [width, height] = dims.split("x");
        dimAttrs = ` width="${width}" height="${height}"`;
      }
      let src = rawSrc.startsWith("/")
        ? path.join(PUBLIC_DIR, rawSrc.slice(1))
        : rawSrc;
      return stash(
        `<img class="inline-image" src="${escapeHtml(src)}" alt="${escapeHtml(
          alt,
        )}"${dimAttrs}>`,
      );
    },
  );

  // Footnote references [^n] -> a superscript marker (no link in print).
  value = value.replace(/\[\^([^\]]+)\]/g, (_match, n: string) =>
    stash(`<sup>${escapeHtml(n)}</sup>`),
  );

  // Markdown links [text](url) -> just the text; PDFs carry no live links.
  // Runs after image extraction so image alt/src are already stashed away.
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // Backslash escapes \X (e.g. "19\." in numbered source-fragment lists, or
  // "\_") -> the literal character, stashed so it survives the emphasis/code
  // passes below. Covers all ASCII punctuation.
  value = value.replace(
    /\\([\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e])/g,
    (_match, ch: string) => stash(escapeHtml(ch)),
  );

  value = escapeHtml(value);
  value = value
    .replace(/&lt;br\s*\/?&gt;/g, "<br>")
    .replace(/&lt;sup&gt;([\s\S]*?)&lt;\/sup&gt;/g, "<sup>$1</sup>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(
    /[♈♉♊♋♌♍♎♏♐♑♒♓☉☾☿♀♂♃♄]/g,
    (symbol) => `<span class="symbol">${symbol}</span>`,
  );

  return value.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => {
    return placeholders[Number(index)] ?? "";
  });
}

export function tableHtml(lines: string[]): string {
  let rows = lines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );

  let body = rows
    .map((cells) => {
      let cols = cells
        .map((cell) => `<td>${inlineMarkdown(cell)}</td>`)
        .join("");
      return `<tr>${cols}</tr>`;
    })
    .join("\n");

  return `<table>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

export function imageFigure(line: string): string | null {
  let match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!match) return null;
  let [alt, dims] = match[1].split("|");
  let src = match[2].startsWith("/")
    ? path.join(PUBLIC_DIR, match[2].slice(1))
    : match[2];
  let dimAttrs = "";
  let aspect = "";
  if (dims && /^\d+x\d+$/.test(dims)) {
    let [width, height] = dims.split("x").map(Number);
    dimAttrs = ` width="${width}" height="${height}"`;
    aspect = ` style="--aspect:${width}/${height}"`;
  }
  let caption =
    alt && alt !== "Figure" ? `<figcaption>${escapeHtml(alt)}</figcaption>` : "";
  return `<figure class="figure"${aspect}><img src="${escapeHtml(
    src,
  )}" alt="${escapeHtml(alt)}"${dimAttrs}>${caption}</figure>`;
}

export function tarotGroupsHtml(): string {
  let groups = [
    { name: "First Group", offsets: [[-1, 0, 1], [2, 3, 4], [5, 6, 7]] },
    { name: "Second Group", offsets: [[1, 0, -1], [4, 3, 2], [7, 6, 5]] },
    { name: "Third Group", offsets: [[-1, 2, 5], [0, 3, 6], [1, 4, 7]] },
    { name: "Fourth Group", offsets: [[5, 2, -1], [6, 3, 0], [7, 4, 1]] },
    { name: "Fifth Group", offsets: [[5, 6, 7], [2, 3, 4], [-1, 0, 1]] },
    { name: "Sixth Group", offsets: [[7, 6, 5], [4, 3, 2], [1, 0, -1]] },
    { name: "Seventh Group", offsets: [[7, 4, 1], [6, 3, 0], [5, 2, -1]] },
    { name: "Eighth Group", offsets: [[1, 4, 7], [0, 3, 6], [-1, 2, 5]] },
  ];

  return `<div class="tarot-groups">${groups
    .map((group) => {
      let grids = Array.from({ length: 14 }, (_v, i) => {
        let k = i + 1;
        let cells = group.offsets
          .flatMap((row) => row.map((offset) => `<span>${k + offset}</span>`))
          .join("");
        return `<div class="tarot-grid">${cells}</div>`;
      }).join("");
      return `<section class="tarot-group"><h4>${group.name}</h4>${grids}</section>`;
    })
    .join("")}</div>`;
}

export function mdxToHtml(markdown: string): string {
  let lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let out: string[] = [];
  let paragraph: string[] = [];

  let flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    if (trimmed === "<TarotGroups />") {
      flushParagraph();
      out.push(tarotGroupsHtml());
      continue;
    }

    // <KeepTogether> … </KeepTogether> wraps a labeled unit (a titled list,
    // a short verse) that must not be split across a page break. Inert on the
    // web (the component renders its children unchanged); here it becomes a
    // `.keep-together` box carrying `break-inside: avoid`. The inner block is
    // recursively converted so its heading/list/paragraphs render normally.
    if (trimmed === "<KeepTogether>") {
      flushParagraph();
      let inner: string[] = [];
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() !== "</KeepTogether>"
      ) {
        inner.push(lines[++i]);
      }
      i++; // consume the closing </KeepTogether>
      out.push(
        `<div class="keep-together">\n${mdxToHtml(inner.join("\n"))}\n</div>`,
      );
      continue;
    }

    let figure = imageFigure(trimmed);
    if (figure) {
      flushParagraph();
      out.push(figure);
      continue;
    }

    if (trimmed.startsWith("|")) {
      flushParagraph();
      let tableLines = [trimmed];
      while (lines[i + 1]?.trim().startsWith("|")) {
        tableLines.push(lines[++i].trim());
      }
      out.push(tableHtml(tableLines));
      continue;
    }

    let footnoteDef = trimmed.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
    if (footnoteDef) {
      flushParagraph();
      out.push(
        `<p class="footnote"><sup>${escapeHtml(footnoteDef[1])}</sup> ${inlineMarkdown(footnoteDef[2])}</p>`,
      );
      continue;
    }

    let heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      let level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      let quoteLines = [trimmed.replace(/^>\s?/, "")];
      while (lines[i + 1]?.trim().startsWith(">")) {
        quoteLines.push(lines[++i].trim().replace(/^>\s?/, ""));
      }
      // One <p> per quotation paragraph (split on blank quote lines) so a long
      // quote can break across pages BETWEEN paragraphs; each paragraph is kept
      // whole by the `.blockquote p` break rule. The old single-<p> form let the
      // shared `blockquote { break-inside: avoid }` strand a whole long quote on
      // the next page, leaving large voids.
      let quoteParas = [];
      let curPara = [];
      for (let ql of quoteLines) {
        if (ql.trim() === "") {
          if (curPara.length) quoteParas.push(curPara);
          curPara = [];
        } else curPara.push(ql);
      }
      if (curPara.length) quoteParas.push(curPara);
      out.push(
        `<blockquote>${quoteParas
          .map((pl) => `<p>${inlineMarkdown(pl.join("<br>"))}</p>`)
          .join("")}</blockquote>`,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      let items = [trimmed.replace(/^[-*]\s+/, "")];
      while (/^[-*]\s+/.test(lines[i + 1]?.trim() ?? "")) {
        items.push(lines[++i].trim().replace(/^[-*]\s+/, ""));
      }
      out.push(
        `<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      let first = trimmed.match(/^(\d+)\.\s+(.+)$/);
      let items = first ? [{ n: first[1], text: first[2] }] : [];
      while (/^\d+\.\s+/.test(lines[i + 1]?.trim() ?? "")) {
        let next = lines[++i].trim().match(/^(\d+)\.\s+(.+)$/);
        if (next) items.push({ n: next[1], text: next[2] });
      }
      out.push(
        `<ol>${items
          .map((item) => `<li value="${item.n}">${inlineMarkdown(item.text)}</li>`)
          .join("")}</ol>`,
      );
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return out.join("\n");
}

/** @font-face blocks for every script the lessons use. The governing rule:
 *  EVERY glyph in the content must resolve to a vendored, OFL-licensed, STATIC
 *  font that is committed to the repo — so the PDF embeds only fonts we may
 *  redistribute, renders identically on macOS and the Linux CI runner, and
 *  never silently falls back to a system font (Times/Hiragino/…) or embeds a
 *  variable font as Type 3 (which Chrome does, and POD preflights flag).
 *
 *  The lessons mix Latin, Greek (Θ = alchemical Salt) and polytonic Greek (ὕ),
 *  Hebrew (many lessons), astrological + alchemical symbols, and math operators
 *  (∇ = alchemical Water). Each gets an explicit face here. Two subtleties make
 *  it robust rather than whack-a-mole:
 *    • Greek rides the same "Print Literata" family via unicode-range so it
 *      stays visually seamless — but the ranges MUST be disjoint from the
 *      polytonic faces, because a face that DECLARES a range it doesn't actually
 *      cover blocks fallback for those glyphs (that silently dropped ὕ once).
 *    • Coverage of unwrapped symbols is guaranteed by putting the symbol
 *      families in the body font stack (see lessons.ts / build.ts), not by the
 *      .symbol wrapper alone. The wrapper only handles text-vs-emoji presentation.
 *  Verified after each render with `pdffonts` (expect zero Type 3, zero system
 *  fonts) and `pdfminer` (no glyph drawn from an un-vendored font). */
export function fontFaceCss(): string {
  let f = (name: string) => path.join(FONTS_DIR, name);
  return `
@font-face {
  font-family: "Print Symbols";
  src: url("${f("NotoSansSymbols-Regular.ttf")}") format("truetype");
}
/* Misc symbols the primary Noto Sans Symbols lacks (☉ SUN, alchemical block
   🜁🜂🜃…) — a second FAMILY, reached by cross-family fallback when the first
   genuinely lacks the glyph. */
@font-face {
  font-family: "Print Symbols 2";
  src: url("${f("NotoSansSymbols2.woff2")}") format("woff2");
}
/* Math operators (∇ = alchemical Water sign, △▽) — Noto Sans Math. */
@font-face {
  font-family: "Print Math";
  src: url("${f("NotoSansMath-Regular.woff2")}") format("woff2");
}
/* Hebrew — Noto Serif Hebrew, matched to Literata's serif register. */
@font-face {
  font-family: "Print Hebrew";
  src: url("${f("NotoSerifHebrew-Regular.woff2")}") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "Print Hebrew";
  src: url("${f("NotoSerifHebrew-SemiBold.woff2")}") format("woff2");
  font-weight: 600;
}
/* Latin — static Literata instances (NOT the variable src/app copy: Chrome
   embeds a variable font as Type 3). */
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-Regular.woff2")}") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-Italic.woff2")}") format("woff2");
  font-style: italic;
  font-weight: 400;
}
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-SemiBold.woff2")}") format("woff2");
  font-weight: 600;
}
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-Bold.woff2")}") format("woff2");
  font-weight: 700;
}
/* Greek (Θ) — same family via unicode-range. Range must be disjoint from the
   polytonic faces below. */
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-Greek.woff2")}") format("woff2");
  font-weight: 400;
  unicode-range: U+0370-03FF;
}
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-Greek-Italic.woff2")}") format("woff2");
  font-style: italic;
  font-weight: 400;
  unicode-range: U+0370-03FF;
}
/* Polytonic Greek (Greek Extended, e.g. ὕ). */
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-GreekExt.woff2")}") format("woff2");
  font-weight: 400;
  unicode-range: U+1F00-1FFF;
}
@font-face {
  font-family: "Print Literata";
  src: url("${f("Literata-GreekExt-Italic.woff2")}") format("woff2");
  font-style: italic;
  font-weight: 400;
  unicode-range: U+1F00-1FFF;
}`.trim();
}

/**
 * Styling for the body-level content elements shared by every print artifact
 * (block quotes, tables, figures, symbols, lists, the tarot-groups grid). Page
 * geometry, base type scale, and document furniture stay with each builder.
 */
export function sharedElementsCss(): string {
  return `
/* Block quotations are set off by symmetric indentation + smaller italic
 * (classic book treatment) rather than a left rule. A bordered box that
 * breaks across a page extends its rule down to the page boundary (paged-media
 * box-decoration-break: slice), leaving an awkward hanging line into the void;
 * indentation never does. */
blockquote {
  color: #3f3a31;
  font-size: 0.94em;
  font-style: italic;
  line-height: 1.42;
  margin: 0.18in 0.34in;
}
blockquote p {
  break-inside: avoid;
  orphans: 3;
  text-align: left;
  widows: 3;
}
blockquote p + p {
  margin-top: 0.14in;
}
ol,
ul {
  margin: 0.12in 0 0.12in 0.26in;
  padding: 0;
}
.keep-together {
  break-inside: avoid;
  page-break-inside: avoid;
}
li {
  margin: 0.035in 0;
  padding-left: 0.04in;
}
/* Close a list clearly: the gap before the next paragraph is larger than the
 * space between items, so the list reads as "ended". Covers plain lists
 * (ol/ul directly before a paragraph) and lists wrapped in a keep-together
 * block (where the following paragraph is the block's sibling). */
ol + p,
ul + p,
.keep-together + p {
  margin-top: 0.24in;
}
table {
  border-collapse: collapse;
  break-inside: avoid;
  font-size: 0.92em;
  margin: 0.16in auto;
  max-width: 100%;
  page-break-inside: avoid;
}
td,
th {
  border: 0.4pt solid #bdb4a3;
  padding: 0.035in 0.055in;
  text-align: center;
  vertical-align: middle;
}
figure {
  break-inside: avoid;
  margin: 0.2in auto;
  max-width: 100%;
  text-align: center;
}
figure img {
  height: auto;
  max-height: 6.35in;
  max-width: 100%;
  object-fit: contain;
}
figcaption {
  color: #766f61;
  font-size: 0.84em;
  font-style: italic;
  margin-top: 0.05in;
}
.inline-image {
  display: inline-block;
  max-height: 1em;
  max-width: 1.2em;
  object-fit: contain;
  vertical-align: -0.12em;
}
.symbol {
  /* Second symbol family (☉ etc.) via cross-family fallback; no system font in
     the chain so a wrapped glyph can never reach an unembedded/unlicensed face. */
  font-family: "Print Symbols", "Print Symbols 2", "Print Literata";
  font-variant-emoji: text;
}
.tarot-groups {
  display: flex;
  flex-direction: column;
  gap: 0.18in;
  margin: 0.16in 0;
}
.tarot-group {
  break-inside: avoid;
  display: grid;
  gap: 0.055in;
  grid-template-columns: repeat(4, 1fr);
}
.tarot-group h4 {
  align-self: center;
  font-size: 0.85em;
  letter-spacing: 0.03em;
  margin: 0;
  text-align: center;
  text-transform: uppercase;
}
.tarot-grid {
  border: 0.35pt solid #bdb4a3;
  display: grid;
  font-size: 0.78em;
  grid-template-columns: repeat(3, 1fr);
  line-height: 1.25;
}
.tarot-grid span {
  border: 0.25pt solid #d9d1c2;
  padding: 0.012in 0;
  text-align: center;
}
.footnote {
  color: #4a4438;
  font-size: 0.86em;
  line-height: 1.35;
  margin: 0.08in 0;
  text-align: left;
}
.footnote sup {
  margin-right: 0.28em;
}`.trim();
}

function chromePath(): string {
  // CHROME_BIN escape hatch for CI / non-standard installs.
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  let macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (fs.existsSync(macChrome)) return macChrome;
  // On the GitHub ubuntu runner (and most Linux setups) this is on PATH;
  // execFileSync resolves it via PATH.
  return "google-chrome";
}

export function buildPdf(htmlPath: string, pdfPath: string) {
  execFileSync(chromePath(), [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ]);
}

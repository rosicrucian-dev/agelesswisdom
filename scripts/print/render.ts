/**
 * Shared print-rendering core: MDX -> print-ready HTML -> PDF (headless Chrome).
 *
 * Used by every print builder (lessons.ts, bundles.ts, and the local editorial
 * tools). The Markdown is NOT parsed here: `mdxToHtml` runs the SAME MDX
 * pipeline as the website (mdx.config.mjs — remark-gfm, smartypants, and the
 * rest), stops at the HTML tree, and lowers it for paged media with one small
 * rehype step below. So a construct renders in the PDF exactly as it parses on
 * the web, and a plugin added to the site is picked up here automatically. An
 * earlier hand-rolled line parser lived here and had to re-implement every
 * custom tag; that class of drift is gone.
 *
 * What stays here: the print-specific lowering (figures, footnotes, symbol
 * spans, JSX tags to plain elements), the vendored fonts, the shared element
 * CSS, and the Chrome call.
 */
import { createProcessor } from "@mdx-js/mdx";
import type { Element, ElementContent, Root, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { VFile } from "vfile";
import {
  loadMdxPlugins,
  rehypePlugins as rehypeSpecs,
  remarkPlugins as remarkSpecs,
} from "../../mdx.config.mjs";
import {
  TAROT_GRIDS_PER_GROUP,
  TAROT_GROUPS,
  tarotGridNumbers,
} from "../../src/data/tarot-groups.ts";

export const ROOT = path.join(import.meta.dirname, "..", "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const APP_DIR = path.join(ROOT, "src", "app");
// Print bundles are generated from the ENGLISH sources on purpose.
export const CONTENT_DIR = path.join(ROOT, "content", "lessons", "en");
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
  const numerals: [number, string][] = [
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
  for (const [n, r] of numerals) {
    while (value >= n) {
      out += r;
      value -= n;
    }
  }
  return out;
}

// ---- MDX -> print HTML ----------------------------------------------------

/** Astrological / planetary glyphs get a span so the symbol font stack (see
 *  .symbol in sharedElementsCss) handles their presentation. */
const SYMBOL = /[♈♉♊♋♌♍♎♏♐♑♒♓☉♀♂♃♄☾☿]/g;

/** hast nodes as they arrive from the MDX pipeline: hast proper, plus the MDX
 *  JSX/expression/ESM nodes that remark-rehype passes through untouched. */
type MdxJsxAttribute = {
  type: "mdxJsxAttribute";
  name: string;
  value?: string | { type: string; value: string } | null;
};
type MdxNode =
  | RootContent
  | {
      type: "mdxJsxFlowElement" | "mdxJsxTextElement";
      name: string | null;
      attributes: MdxJsxAttribute[];
      children: MdxNode[];
    }
  | { type: "mdxFlowExpression" | "mdxTextExpression" | "mdxjsEsm" };

function el(
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[] = [],
): Element {
  return { type: "element", tagName, properties, children };
}

function text(value: string): ElementContent {
  return { type: "text", value };
}

function textOf(node: MdxNode): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** Resolve a public asset URL (`/images/…`) to the file Chrome should load. */
function assetPath(src: string): string {
  return src.startsWith("/") ? path.join(PUBLIC_DIR, src.slice(1)) : src;
}

/** `alt` carries "description|WIDTHxHEIGHT" (see mdx-components.tsx). */
function imageParts(alt: string): {
  alt: string;
  width?: number;
  height?: number;
} {
  const [description, dims] = alt.split("|");
  if (dims && /^\d+x\d+$/.test(dims)) {
    const [width, height] = dims.split("x").map(Number);
    return { alt: description, width, height };
  }
  return { alt: description ?? "" };
}

/** A paragraph that is nothing but one image becomes a figure; the alt text is
 *  its caption unless it is the generic "Figure". */
function figureFor(img: Element): Element {
  const { alt, width, height } = imageParts(String(img.properties.alt ?? ""));
  const properties: Element["properties"] = {
    src: assetPath(String(img.properties.src ?? "")),
    alt,
  };
  const figureProps: Element["properties"] = { className: ["figure"] };
  if (width && height) {
    properties.width = width;
    properties.height = height;
    figureProps.style = `--aspect:${width}/${height}`;
  }
  const children: ElementContent[] = [el("img", properties)];
  if (alt && alt !== "Figure") {
    children.push(el("figcaption", {}, [text(alt)]));
  }
  return el("figure", figureProps, children);
}

/** remark-gfm's footnote section (an <ol> of notes with back-references) in
 *  the print shape: one `.footnote` paragraph per note, its number as a
 *  superscript, no links — PDFs carry none. */
function footnotesFor(section: Element): Element {
  const notes: ElementContent[] = [];
  const list = section.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "ol",
  );
  for (const li of list?.children ?? []) {
    if (li.type !== "element" || li.tagName !== "li") continue;
    const label = String(li.properties.id ?? "").replace(
      /^user-content-fn-/,
      "",
    );
    // The note's paragraphs, with the "↩" back-reference dropped.
    const body = li.children.flatMap((c) =>
      c.type === "element" && c.tagName === "p" ? c.children : [c],
    );
    const content = lowerAll(body as MdxNode[], false).filter(
      (c) =>
        !(
          c.type === "element" &&
          c.tagName === "a" &&
          "dataFootnoteBackref" in c.properties
        ),
    );
    notes.push(
      el("p", { className: ["footnote"] }, [
        el("sup", {}, [text(label)]),
        text(" "),
        ...content,
      ]),
    );
  }
  return el("div", { className: ["footnotes"] }, notes);
}

/** The tarot-group tableaus, derived from the shared offset tables. */
function tarotGroupsElement(): Element {
  return el(
    "div",
    { className: ["tarot-groups"] },
    TAROT_GROUPS.map((group) =>
      el("section", { className: ["tarot-group"] }, [
        el("h4", {}, [text(group.name)]),
        ...Array.from({ length: TAROT_GRIDS_PER_GROUP }, (_, i) =>
          el(
            "div",
            { className: ["tarot-grid"] },
            tarotGridNumbers(group, i + 1).map((n) =>
              el("span", {}, [text(String(n))]),
            ),
          ),
        ),
      ]),
    ),
  );
}

/** JSX attributes -> hast properties. JSX names (className, colSpan) ARE the
 *  hast property names; hast-util-to-html spells them as HTML attributes. */
function jsxProperties(
  attributes: ReadonlyArray<{ type: string; name?: string; value?: unknown }>,
): Element["properties"] {
  const properties: Element["properties"] = {};
  for (const attr of attributes) {
    if (attr.type !== "mdxJsxAttribute" || !attr.name) continue;
    const raw =
      attr.value == null
        ? true
        : typeof attr.value === "string"
          ? attr.value
          : String((attr.value as { value: string }).value); // {2} -> "2"
    if (attr.name === "className") {
      properties.className = String(raw).split(/\s+/);
    } else if (attr.name === "colSpan" || attr.name === "rowSpan") {
      properties[attr.name] = Number(raw);
    } else {
      properties[attr.name] = raw;
    }
  }
  return properties;
}

/** Wrap symbol glyphs in `.symbol` spans (not inside code, where text is
 *  verbatim). */
function lowerText(value: string, inCode: boolean): ElementContent[] {
  if (inCode || !SYMBOL.test(value)) return [text(value)];
  SYMBOL.lastIndex = 0;
  const out: ElementContent[] = [];
  let last = 0;
  for (const match of value.matchAll(SYMBOL)) {
    if (match.index > last) out.push(text(value.slice(last, match.index)));
    out.push(el("span", { className: ["symbol"] }, [text(match[0])]));
    last = match.index + match[0].length;
  }
  if (last < value.length) out.push(text(value.slice(last)));
  return out;
}

function lowerAll(nodes: MdxNode[], inCode: boolean): ElementContent[] {
  return nodes.flatMap((node) => lower(node, inCode));
}

/**
 * The print lowering, one node at a time. Returns the replacement(s): a node
 * may become several (a link unwraps to its children) or none (ESM, expressions,
 * footnote back-references).
 */
function lower(node: MdxNode, inCode: boolean): ElementContent[] {
  switch (node.type) {
    case "text":
      return lowerText(node.value, inCode);

    case "element": {
      const { tagName, properties } = node;
      // PDFs carry no live links: a link is just its text.
      if (tagName === "a") {
        if ("dataFootnoteBackref" in properties) return [];
        return lowerAll(node.children as MdxNode[], inCode);
      }
      if (tagName === "section" && "dataFootnotes" in properties) {
        return [footnotesFor(node)];
      }
      // A paragraph holding only an image is a figure.
      if (tagName === "p") {
        const meaningful = node.children.filter(
          (c) => !(c.type === "text" && c.value.trim() === ""),
        );
        const only = meaningful[0];
        if (
          meaningful.length === 1 &&
          only.type === "element" &&
          only.tagName === "img"
        ) {
          return [figureFor(only)];
        }
      }
      if (tagName === "img") {
        const { alt, width, height } = imageParts(String(properties.alt ?? ""));
        const props: Element["properties"] = {
          className: ["inline-image"],
          src: assetPath(String(properties.src ?? "")),
          alt,
        };
        if (width && height) Object.assign(props, { width, height });
        return [el("img", props)];
      }
      // The lesson title is the masthead's <h1> (see lessons.ts), so body
      // headings sit one level down: `##` in the source is an <h3> here.
      const heading = /^h([1-5])$/.exec(tagName);
      if (heading) {
        const level = Math.min(Number(heading[1]) + 1, 5);
        return [
          el("h" + level, {}, lowerAll(node.children as MdxNode[], inCode)),
        ];
      }
      // GFM column alignment as an inline style (the `align` attribute is
      // obsolete HTML).
      const props: Element["properties"] = { ...properties };
      if ((tagName === "td" || tagName === "th") && props.align) {
        props.style = `text-align:${props.align}`;
        delete props.align;
      }
      const code = inCode || tagName === "code" || tagName === "pre";
      return [el(tagName, props, lowerAll(node.children as MdxNode[], code))];
    }

    case "mdxJsxFlowElement":
    case "mdxJsxTextElement": {
      const children = () => lowerAll(node.children, inCode);
      switch (node.name) {
        // The custom tags, each mirroring its web component in
        // mdx-components.tsx (same class names; the print CSS styles them).
        case "KeepTogether":
          return [el("div", { className: ["keep-together"] }, children())];
        case "EditorNote":
          return [el("p", { className: ["editor-note"] }, children())];
        case "Cite":
          return [
            el("p", { className: ["quote-cite"] }, [text("— "), ...children()]),
          ];
        case "TarotGroups":
          return [tarotGroupsElement()];
      }
      // Hand-written HTML in the MDX (<div className=…>, <table>, <br />,
      // <sup>): the same element, attributes normalized.
      if (node.name && /^[a-z]/.test(node.name)) {
        return [el(node.name, jsxProperties(node.attributes), children())];
      }
      throw new Error(
        `print: no rendering for <${node.name ?? "fragment"}> — add it to ` +
          `lower() in scripts/print/render.ts (and to mdx-components.tsx).`,
      );
    }

    // import/export lines and {expressions}: nothing to print.
    case "mdxFlowExpression":
    case "mdxTextExpression":
    case "mdxjsEsm":
      return [];

    default:
      return [node as ElementContent];
  }
}

/** Captured by the plugin below on each run; `mdxToHtml` reads it back. A
 *  module-level slot is the plain way for a unified plugin to return a value. */
let printed = "";

/** The last rehype step: lower the site's HTML tree for print and serialize
 *  it. Everything after this stage in the MDX processor (JSX compilation)
 *  still runs and is ignored. */
function rehypePrint() {
  return (tree: Root) => {
    const children = lowerAll(tree.children as MdxNode[], false);
    printed = toHtml({ type: "root", children } as Root);
  };
}

const processor = createProcessor({
  remarkPlugins: await loadMdxPlugins(remarkSpecs),
  rehypePlugins: [...(await loadMdxPlugins(rehypeSpecs)), rehypePrint],
});

/**
 * Lesson MDX -> print HTML fragment, through the website's own pipeline.
 *
 * The file is given NO path on purpose: the paragraph-anchor plugin keys on
 * `content/lessons/` in the path and would otherwise add its ¶ markers, which
 * are a web affordance. Synchronous, so the print builders and the editorial
 * tools can stay simple loops.
 */
export function mdxToHtml(markdown: string): string {
  const file = new VFile({ value: markdown });
  processor.runSync(processor.parse(file) as never, file);
  return printed;
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
  const f = (name: string) => path.join(FONTS_DIR, name);
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
/* Quoted verse: hang the turnover (wrapped) lines so a run-over reads as a
   continuation, not a new verse line (professional poetry setting). :has(br)
   scopes this to verse blockquotes; prose quotes carry no <br> and stay flush. */
blockquote:has(br) p {
  padding-left: 1.5em;
  text-indent: -1.5em;
}
/* Fenced monospace blocks — the Oracle-of-Tarot aligned attribution lists,
 * card spreads and dot figures. white-space: pre keeps their column alignment;
 * a monospace face at a small size keeps the lines on the page. The pale panel
 * matches the web (gray-100 behind pre in src/app/typography.css) so a printed
 * lesson reads like its page — warmed to the print palette's own family (the
 * lightest tint of the #bdb4a3 / #d9d1c2 rules) rather than the web's cool
 * gray, which read blue against the cream page. print-color-adjust: exact is
 * required — without it Chrome drops background fills when printing, since
 * "background graphics" is off by default. */
pre {
  background-color: #f5f2ea;
  border-radius: 0.05in;
  break-inside: avoid;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 8.5pt;
  line-height: 1.35;
  margin: 0.16in 0;
  padding: 0.09in 0.12in;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  white-space: pre;
}
pre code {
  font-family: inherit;
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
/* Borders are drawn with border-collapse: SEPARATE (not collapse): the table
   owns the top+left edges, each cell owns its right+bottom, so every grid line
   sits wholly INSIDE an element box. Under collapse the outer border straddles
   the table's box edge instead, putting half of it outside — which needs a
   wider safety inset to survive the page-edge clip that the body rule
   compensates for (see scripts/print/lessons.ts), and shaved the
   right & bottom rules on the web for the same reason. Mirrors the table rules
   in src/app/typography.css. */
table {
  border-collapse: separate;
  border-spacing: 0;
  border-left: 1pt solid #bdb4a3;
  border-top: 1pt solid #bdb4a3;
  break-inside: avoid;
  font-size: 0.92em;
  margin: 0.16in auto;
  max-width: 100%;
  page-break-inside: avoid;
}
/* Columns that are parallel bodies of prose (the Well-dignified /
   Ill-dignified dignity tables) split the width evenly instead of sizing to
   whichever side is wordier. Mirrors the .even-columns rule in typography.css. */
.even-columns table {
  table-layout: fixed;
  width: 100%;
}
td,
th {
  border-bottom: 1pt solid #bdb4a3;
  border-right: 1pt solid #bdb4a3;
  padding: 0.035in 0.055in;
  text-align: center;
  vertical-align: middle;
}
/* Markdown renders a table's first row as <th>, which browsers bold by
   default; most lesson tables are data grids with no real header. Same rule
   as the web (typography.css): a header is bold only when its cells are
   bolded explicitly (**Header**). */
th {
  font-weight: inherit;
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
/* Editorial apparatus (the editors' voice, not Case's text) — matches the
   figcaption secondary tone. Set by the EditorNote component / <EditorNote> tag. */
.editor-note {
  color: #766f61;
  font-size: 0.84em;
  font-style: italic;
}
/* Quotation source attribution — muted, right-aligned, roman (contrasting the
   italic blockquote). break-before: avoid binds it to the quote's last line so
   Chrome never strands it on the next page. Scoped under .lesson-body to beat
   the justify rule on .lesson-body p. */
.lesson-body .quote-cite {
  break-before: avoid;
  page-break-before: avoid;
  color: #766f61;
  font-size: 0.9em;
  font-style: normal;
  margin-top: 0.06in;
  text-align: right;
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
/* End-of-lesson notes: a classic short separator rule, then the collected
 * footnotes in smaller muted type. Kept whole — a split note reads badly and
 * the blocks are always short. */
.footnotes {
  break-inside: avoid;
  margin-top: 0.32in;
}
.footnotes::before {
  border-top: 1pt solid #bdb4a3;
  content: "";
  display: block;
  margin-bottom: 0.1in;
  width: 2.2in;
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
  const macChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (fs.existsSync(macChrome)) return macChrome;
  // On the GitHub ubuntu runner (and most Linux setups) this is on PATH;
  // execFileSync resolves it via PATH.
  return "google-chrome";
}

export function buildPdf(htmlPath: string, pdfPath: string) {
  // `--print-to-pdf` is fire-and-forget: Chrome prints the moment it considers
  // the page "loaded", which does NOT guarantee the @font-face web fonts have
  // finished loading and re-laid-out the text. On a fast local disk the fonts
  // win the race and every page is perfect; on the slower CI runner the print
  // can fire mid-layout, dropping whole body paragraphs (blockquotes, being
  // shorter, survive) and leaving blank pages — the exact macOS-fine / Linux-
  // broken divergence we hit. The fix, all supported by the plain CLI:
  //   • --virtual-time-budget advances a virtual clock and HOLDS the print
  //     until pending resources (the fonts) settle or the budget elapses — the
  //     canonical cure for the print-before-fonts race.
  //   • --run-all-compositor-stages-before-draw forces a full paint first.
  //   • --headless=new is the maintained headless implementation (old headless
  //     is being removed from Chrome and renders paged media inconsistently).
  execFileSync(chromePath(), [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=20000",
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ]);
}

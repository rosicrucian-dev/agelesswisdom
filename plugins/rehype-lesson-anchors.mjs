/**
 * Gives every top-level block of a LESSON a stable anchor id (`p1`, `p2`, …)
 * and, for the blocks a reader actually quotes, a gutter link that copies a
 * deep URL (see src/components/copy-anchor.tsx for the copy behaviour).
 *
 * Ids are emitted at build time, so `/section-a/the-life-power/#p12` works in
 * the static export with no client JavaScript — the browser's own fragment
 * navigation does the work. The client component only adds copy-to-clipboard.
 *
 * ## The numbering rule (a contract, not an implementation detail)
 *
 * The count is positional: walk the document's TOP-LEVEL children in order and
 * number each ANCHORABLE block, starting at 1 per lesson.
 *
 *   anchorable   p, ul, ol, blockquote, table, pre, figure
 *   skipped      headings (h1–h6) — they already carry text-derived slug ids
 *                from mdx-components.tsx, and numbering them would make the
 *                count shift whenever a heading is added
 *   skipped      the remark-gfm footnotes <section> and everything in it —
 *                the print pipeline collects footnotes separately, so counting
 *                them would guarantee the two pipelines disagree
 *   skipped      MDX JSX blocks (<KeepTogether>, <EditorNote>, <Cite>,
 *                <TarotGroups />, and hand-written <div>/<table> wrappers).
 *                These are `mdxJsxFlowElement` nodes, not `element` nodes, so
 *                they are invisible to the walk below — deliberately: they are
 *                editorial apparatus or layout, not passages to cite.
 *
 * Written down because it is a CONTRACT between two parsers. Today only the
 * web numbers blocks. If printed paragraph numbers are ever added, the print
 * renderer (scripts/print/render.ts, its own hand-rolled Markdown parser) must
 * reproduce this exact sequence — and that is also the moment to freeze the
 * numbers behind a committed manifest, since a printed citation is permanent.
 * See docs/paragraph-links.md.
 *
 * ## Where the marker can live
 *
 * The marker has to sit INSIDE its block, because it is positioned against
 * that block's box. Which child position is legal varies by element:
 *
 *   p, blockquote, pre   a direct child — all three take phrasing content
 *   ul, ol               inside the FIRST <li>; a direct <a> child of a list
 *                        is invalid HTML (browsers tolerate it, we don't)
 *   table                NOWHERE. A non-table child is "foster-parented" by
 *                        the HTML parser — physically relocated to before the
 *                        <table> — which loses the positioning context and
 *                        desynchronizes the server HTML from the parsed DOM
 *                        (a hydration mismatch). Escaping that would need an
 *                        extra wrapper element around every table, which would
 *                        still miss the tables inside authored JSX wrappers.
 *                        Tables keep their id and stay linkable instead.
 */
import fs from "node:fs";
import path from "node:path";

const ANCHORABLE = new Set([
  "p",
  "ul",
  "ol",
  "blockquote",
  "table",
  "pre",
  "figure",
]);

/** Blocks that can hold the marker as a direct child (they take phrasing
 *  content). Lists hold it in their first <li>; tables can't hold it at all. */
const SELF_HOSTING = new Set(["p", "blockquote", "pre", "figure"]);

/** Only lesson transcripts get anchors — not the About page or the overview
 *  intro, where a paragraph link would be noise. */
const LESSON_DIR = `${path.sep}content${path.sep}lessons${path.sep}`;

/** Localized accessible name for the marker, read from the same message
 *  catalogue the app uses so the label is translated even with JS disabled.
 *  Read once per process; the catalogues are tiny and build-time only. */
const labels = new Map();
function copyLabel(locale, n) {
  if (!labels.has(locale)) {
    let file = path.join(process.cwd(), "content", "messages", `${locale}.json`);
    let messages = JSON.parse(fs.readFileSync(file, "utf8"));
    labels.set(locale, messages["anchor.copy"] ?? "Copy link to this passage");
  }
  return labels.get(locale).replaceAll("{n}", String(n));
}

export default function rehypeLessonAnchors() {
  return (tree, file) => {
    let filePath = file?.path ?? "";
    if (!filePath.includes(LESSON_DIR)) return;
    // content/lessons/<locale>/<section>/<file>.mdx
    let locale = filePath.split(LESSON_DIR)[1]?.split(path.sep)[0] ?? "en";

    let n = 0;
    for (let node of tree.children ?? []) {
      if (node.type !== "element") continue;
      if (node.tagName === "section") continue; // gfm footnotes
      if (!ANCHORABLE.has(node.tagName)) continue;

      n += 1;
      let id = `p${n}`;
      node.properties = { ...node.properties };
      // Never clobber an id the pipeline already set.
      if (!node.properties.id) node.properties.id = id;

      // Pick the element that will HOLD the marker (see "Where the marker can
      // live" above); `null` means this block type can't host one.
      let host = null;
      if (SELF_HOSTING.has(node.tagName)) {
        host = node;
      } else if (node.tagName === "ul" || node.tagName === "ol") {
        host = node.children?.find(
          (child) => child.type === "element" && child.tagName === "li",
        );
      }
      if (!host) continue;

      host.children.push({
        type: "element",
        tagName: "a",
        properties: {
          className: ["anchor-link"],
          href: `#${node.properties.id}`,
          "aria-label": copyLabel(locale, n),
          "data-anchor": String(n),
        },
        // The glyph is wrapped so the <a> can carry the PARAGRAPH's font
        // metrics (which is what puts it on the first line's baseline) while
        // the pilcrow itself renders smaller — see .anchor-link in
        // src/app/typography.css.
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["anchor-glyph"] },
            children: [{ type: "text", value: "¶" }],
          },
        ],
      });
    }
  };
}

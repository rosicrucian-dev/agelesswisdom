/**
 * The MDX pipeline, defined ONCE.
 *
 * Three consumers build a processor from this and they must agree exactly:
 *
 *   next.config.mjs          renders the site
 *   scripts/gen-search-index.ts   builds the search index, and reads back the
 *                            paragraph anchor ids (`p1`, `p2`, …) that
 *                            plugins/rehype-lesson-anchors.mjs assigns
 *   scripts/print/render.ts  renders the lesson PDFs from the same HTML tree
 *
 * The search index deep-links results to those anchors, so a plugin list that
 * drifted between the two would silently point readers at the wrong paragraph.
 * A hand-rolled second pipeline was measured doing exactly that: it mis-parsed
 * `<Cite>` as a paragraph and shifted every anchor after it in 8 of 114
 * lessons. Sharing the definition is what makes the two provably identical —
 * add a plugin here and both consumers pick it up.
 *
 * Plugins are named as [specifier, options] rather than imported functions
 * because next.config.mjs needs them SERIALIZABLE for Turbopack. The generator
 * resolves the specifiers with dynamic import (see `loadMdxPlugins` below).
 */

import { basePlugins } from "./content/books/mdx.mjs";

/** The format's pipeline, from the books repository (content/books/mdx.mjs:
 *  remark-gfm, smartypants with `--` an em dash, the Books' figures by a
 *  path relative to their folder, quoted verse a line each), then this
 *  site's own plugin. The print renderer (scripts/print/render.ts) is a
 *  third consumer of these lists, so the exported PDFs carry the same marks
 *  as the site by construction. The figures' root and URL are this site's
 *  (no Books are shown here yet; the plugin then has nothing to do). */
const BOOKS = new URL("./content/books/books/", import.meta.url).pathname;
const base = basePlugins({
  booksRoot: BOOKS.replace(/\/$/, ""),
  imageBase: "/images/books/{work}/{edition}",
  // A link within a text (the School's lessons to one another): a lesson by
  // its number, which plugins/remark-lesson-links.mjs turns into this site's
  // address by slug; a part is a section, linked as the home page's outline
  // anchors it.
  links: { entry: "/{part}/lesson-{n}{fragment}", part: "/#{part}" },
});

/** The repository's texts are shown as lessons: their headings come up one
 *  level (plugins/remark-lesson-headings.mjs), and their links between
 *  lessons get this site's slugs (plugins/remark-lesson-links.mjs). */
export const remarkPlugins = [
  ...base.remark,
  [
    new URL("./plugins/remark-lesson-headings.mjs", import.meta.url).pathname,
    { under: BOOKS },
  ],
  [new URL("./plugins/remark-lesson-links.mjs", import.meta.url).pathname],
];

/** rehype-lesson-anchors gives each top-level lesson block an id (p1, p2, …)
 *  so `/section-a/the-life-power/#p12` deep-links in the static export with no
 *  client JS; a web affordance, so this site's, not the format's. The path
 *  must be ABSOLUTE: Turbopack resolves a plugin string with require.resolve
 *  from its own base, where "./plugins/…" is "Cannot find module". An
 *  absolute path is still a serializable string. */
export const rehypePlugins = [
  ...base.rehype,
  [new URL("./plugins/rehype-lesson-anchors.mjs", import.meta.url).pathname],
];

export { loadMdxPlugins } from "./content/books/mdx.mjs";

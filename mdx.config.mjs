/**
 * The MDX pipeline, defined ONCE.
 *
 * Two consumers build a processor from this and they must agree exactly:
 *
 *   next.config.mjs          renders the site
 *   scripts/gen-search-index.ts   builds the search index, and reads back the
 *                            paragraph anchor ids (`p1`, `p2`, …) that
 *                            plugins/rehype-lesson-anchors.mjs assigns
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

/** remark-smartypants gives typographic quotes/dashes/ellipses; `inverted`
 *  maps `--` -> em dash (Case's typewriter convention). The print pipeline
 *  (scripts/print/render.ts) runs the SAME retext-smartypants engine with the
 *  SAME options, so the site and the exported PDFs render identical marks. */
export const remarkPlugins = [
  ["remark-gfm"],
  ["remark-smartypants", { dashes: "inverted", backticks: false }],
];

/** rehype-lesson-anchors gives each top-level lesson block an id (p1, p2, …)
 *  so `/section-a/the-life-power/#p12` deep-links in the static export with no
 *  client JS. The path must be ABSOLUTE: Turbopack resolves a plugin string
 *  with require.resolve from its own base, where "./plugins/…" is "Cannot find
 *  module". An absolute path is still a serializable string. */
export const rehypePlugins = [
  [new URL("./plugins/rehype-lesson-anchors.mjs", import.meta.url).pathname],
];

/**
 * Resolve a [specifier, options] list into the [plugin, options] pairs unified
 * wants. Only the generator needs this — next.config.mjs hands the strings
 * straight to @next/mdx, which resolves them itself.
 */
export async function loadMdxPlugins(specs) {
  return Promise.all(
    specs.map(async ([specifier, options]) => {
      const mod = await import(specifier);
      return options === undefined ? mod.default : [mod.default, options];
    }),
  );
}

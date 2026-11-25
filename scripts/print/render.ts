/**
 * This site's print renderer: the books repository's shared core
 * (content/books/print/render.ts: the lowering to paged HTML, the vendored
 * fonts, the element styles, the Chrome call) running this site's own MDX
 * pipeline (mdx.config.mjs) less its one web affordance, the paragraph
 * anchors, with this site's paths. The print builders (lessons.ts,
 * bundles.ts) and the editorial tools import from here, as before the core
 * moved out.
 */
import * as path from "node:path";
import {
  type Renderer,
  createRenderer,
} from "../../content/books/print/render.ts";
import {
  loadMdxPlugins,
  rehypePlugins as rehypeSpecs,
  remarkPlugins as remarkSpecs,
} from "../../mdx.config.mjs";

export {
  buildPdf,
  escapeHtml,
  fontFaceCss,
  roman,
  sharedElementsCss,
} from "../../content/books/print/render.ts";

export const ROOT = path.join(import.meta.dirname, "..", "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const APP_DIR = path.join(ROOT, "src", "app");

const renderer: Renderer = createRenderer({
  remarkPlugins: await loadMdxPlugins(remarkSpecs),
  // The paragraph anchors (¶, a link to copy) are the page's, not the
  // print's; the rest of the pipeline keys on the file's path (the
  // School's figures and headings), so the path is given.
  rehypePlugins: await loadMdxPlugins(
    rehypeSpecs.filter(
      ([specifier]) => !String(specifier).includes("rehype-lesson-anchors"),
    ),
  ),
  // A public asset URL (`/images/…`) is a file under public/.
  asset: (src) =>
    src.startsWith("/") ? path.join(PUBLIC_DIR, src.slice(1)) : src,
});

/** Lesson MDX -> print HTML fragment, through the website's own pipeline;
 *  `file` is the MDX file's path on disk, absolute. */
export const mdxToHtml = (markdown: string, file?: string) =>
  renderer.mdxToHtml(markdown, file);

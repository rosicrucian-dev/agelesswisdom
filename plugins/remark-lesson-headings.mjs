/**
 * A text of the books repository shown as lessons: every text this site
 * shows (src/data/book-sources.ts). The format's top heading is `##` (the
 * lesson's own title, under the masthead a consumer gives it); this site's
 * lessons carry theirs as `#`, which the page sets as the lesson's heading
 * and the print lifts into its masthead. So, for a file under the
 * repository's folder, every heading comes up one level, and the text
 * renders exactly as this site's own transcripts do. A web affordance of
 * this site, not the format's.
 */

import path from "node:path";
import { visit } from "unist-util-visit";

/**
 * @param {{ under: string }} options
 *   under: the folder (absolute) whose files are shown as lessons.
 */
export default function remarkLessonHeadings({ under }) {
  const prefix = under.endsWith(path.sep) ? under : under + path.sep;
  return (tree, file) => {
    if (!(file?.path ?? "").startsWith(prefix)) return;
    visit(tree, "heading", (node) => {
      node.depth = Math.max(1, node.depth - 1);
    });
  };
}

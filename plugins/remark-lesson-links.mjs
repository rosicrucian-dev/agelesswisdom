/**
 * A link within a text of the books repository names a lesson by its
 * number: the format's links plugin, given this site's template, writes
 * `/section-a/lesson-9#p12` (mdx.config.mjs). This site's lesson pages are
 * named by slug, `/section-a/an-outline-of-the-qabalah`, so such a link is
 * turned into the slug's: the ninth lesson of the section in
 * content/curriculum/en.json. A link that names no section of the
 * curriculum, or a lesson it does not have, is an error, not a dead link.
 */

import fs from "node:fs";
import path from "node:path";
import { visit } from "unist-util-visit";

let slugs;
function slugsOf() {
  if (!slugs) {
    const file = path.join(process.cwd(), "content", "curriculum", "en.json");
    slugs = new Map(
      JSON.parse(fs.readFileSync(file, "utf8")).map((section) => [
        section.id,
        section.lessons.map((lesson) => lesson.id),
      ]),
    );
  }
  return slugs;
}

export default function remarkLessonLinks() {
  return (tree, file) => {
    visit(tree, "link", (node) => {
      const m = /^\/([a-z-]+)\/lesson-(\d+)(#.*)?$/.exec(node.url);
      if (!m) return;
      const [, section, n, fragment = ""] = m;
      const lessons = slugsOf().get(section);
      const slug = lessons?.[Number(n) - 1];
      if (!slug) {
        throw new Error(
          `${file?.path ?? "a text"}: links to ${node.url}, which the curriculum does not have`,
        );
      }
      node.url = `/${section}/${slug}${fragment}`;
    });
  };
}

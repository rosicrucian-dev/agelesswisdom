/**
 * Build the full-text search index the search dialog queries.
 *
 * Reads every lesson MDX (via the curriculum, so ordering/titles/paths can
 * never drift from the site) and builds a positional inverted index with the
 * shared buildInvertedIndex from src/lib/search-engine — one file per locale.
 *
 * Runs as `prebuild`, so every build ships an index generated from the same
 * lesson text it renders. Run manually with `npm run gen:search`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getSections,
  lessonFileName,
  lessonUrl,
  numberedLessonTitle,
  sectionDirName,
} from "../src/data/curriculum.ts";
import { DEFAULT_LOCALE, LOCALES } from "../src/lib/locales.ts";
import { buildInvertedIndex, stripMarkdown } from "../src/lib/search-engine.ts";
import type { SearchLesson } from "../src/lib/search.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// One index per locale. Titles/labels come from the localized curriculum;
// lesson text comes from the locale's MDX when it exists, else the English
// transcript (mirroring exactly what the lesson page serves in that locale).
for (const locale of LOCALES) {
  const items: Array<{ doc: SearchLesson; text: string }> = [];

  for (const section of getSections(locale)) {
    for (const lesson of section.lessons) {
      const relFile = path.join(
        sectionDirName(section),
        `${lessonFileName(section, lesson)}.mdx`,
      );
      let file = path.join(ROOT, "content", "lessons", locale, relFile);
      if (!fs.existsSync(file)) {
        file = path.join(ROOT, "content", "lessons", DEFAULT_LOCALE, relFile);
      }
      const title = numberedLessonTitle(section, lesson);
      const doc: SearchLesson = {
        href: lessonUrl(section, lesson),
        title,
        section: section.label,
      };
      // Index the title too, so "Tree of Life" matches the titled lesson.
      const text = `${title} ${stripMarkdown(fs.readFileSync(file, "utf8"))}`;
      items.push({ doc, text });
    }
  }

  const index = buildInvertedIndex(items, locale);
  const out = path.join(ROOT, "public", `search-index.${locale}.json`);
  fs.writeFileSync(out, JSON.stringify(index));

  const bytes = fs.statSync(out).size;
  console.log(
    `search index (${locale}): ${index.docs.length} lessons, ` +
      `${Object.keys(index.words).length} words, ${(bytes / 1024).toFixed(0)} KB ` +
      `-> ${path.relative(ROOT, out)}`,
  );
}

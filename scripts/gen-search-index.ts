/**
 * Build the full-text search index the search dialog queries.
 *
 * Reads every lesson MDX (via the curriculum, so ordering/titles/paths can
 * never drift from the site), strips markdown mechanics, tokenizes with the
 * shared tokenizer from src/lib/search.ts, and writes an inverted index
 * (word -> [lessonIdx, count, ...]) to public/search-index.json.
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
import { tokenize, type SearchIndex } from "../src/lib/search.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "search-index.json");

/** Strip markdown/MDX mechanics that would pollute the word list. */
function stripMarkdown(mdx: string): string {
  return (
    mdx
      // Images entirely (alt + path both carry non-prose words).
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      // Links: keep the text, drop the target.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Footnote references and definition markers.
      .replace(/\[\^[^\]]*\]:?/g, " ")
      // HTML tags (<sup>, <br />, ...).
      .replace(/<[^>]+>/g, " ")
  );
}

const lessons: SearchIndex["lessons"] = [];
const words: Record<string, number[]> = {};

for (const section of getSections()) {
  for (const lesson of section.lessons) {
    const file = path.join(
      ROOT,
      "content",
      "lessons",
      sectionDirName(section),
      `${lessonFileName(section, lesson)}.mdx`,
    );
    const lessonIdx = lessons.length;
    lessons.push({
      href: lessonUrl(section, lesson),
      title: numberedLessonTitle(section, lesson),
      section: section.label,
    });

    const counts = new Map<string, number>();
    for (const word of tokenize(stripMarkdown(fs.readFileSync(file, "utf8")))) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (const [word, count] of counts) {
      (words[word] ??= []).push(lessonIdx, count);
    }
  }
}

const index: SearchIndex = { lessons, words };
fs.writeFileSync(OUT, JSON.stringify(index));

const bytes = fs.statSync(OUT).size;
console.log(
  `search index: ${lessons.length} lessons, ` +
    `${Object.keys(words).length} words, ${(bytes / 1024).toFixed(0)} KB ` +
    `-> ${path.relative(ROOT, OUT)}`,
);

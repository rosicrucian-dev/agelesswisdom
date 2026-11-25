/**
 * The course curriculum, modeled on Paul Foster Case's original School of
 * Ageless Wisdom sequence: Sections A and B (the "First Year Course"),
 * Sections C and D, Tarot Instruction First and Second, then Hermetic
 * Alchemy. Lessons were originally issued weekly; the site preserves that
 * sequence as the reading order.
 *
 * SERVER-ONLY loader. The curriculum data lives in
 * content/curriculum/<locale>.json — full sibling files per locale
 * (en.json is the master; translated siblings are the same file with
 * display values translated in place). The merge reads STRUCTURE
 * exclusively from English (ids, ordering, hidden flags, the lesson
 * list) and takes only display fields (label, title, description,
 * unitLabel) from a translation, matched by id — a translated file's
 * structural edits are ignored with a warning, and anything missing
 * falls back to English. Same conventions as ../botatoolbox.
 *
 * Client components import types + pure helpers from
 * ./curriculum-helpers instead (this module touches node:fs).
 *
 * Lesson MDX lives at `content/lessons/<locale>/<section>/<NN-lesson>.mdx`
 * (the files carry a numeric reading-order prefix; lesson URL slugs use
 * the un-prefixed `id` while section URL slugs are the section `id`),
 * except the English of the sections whose text is the books repository's
 * (src/data/book-sources.ts: the School's lessons), read from the submodule by
 * `lessonSourceFile` below.
 * The MDX files are the source of truth for lesson text: every fix is a
 * direct edit there.
 *
 * `description` is optional; any lesson/section that has one shows it
 * automatically.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DO NOT PUBLISH — permanent exclusion (donor condition):
 *
 *   "The Ritual of the Pentagram"  — Esoteric Secrets of Magic (Section D),
 *   the SIXTH lesson of that section (source file MAGIC.06, NOT a Section C
 *   lesson). It has no MDX under content/lessons, and must NEVER get one, and
 *   must NEVER appear as a lesson entry in content/curriculum/en.json (any
 *   `id` such as "the-ritual-of-the-pentagram"). This is a standing
 *   restriction, not an oversight — if a future tool or import appears to
 *   be "missing" this lesson, that is correct and intentional; do not add it.
 *
 * The machine-readable denylist that enforces this lives in the local
 * editorial workspace, outside this repository.
 */

// Relative + extensioned import so the plain-node scripts (search
// index, print pipeline) can load this module — they don't resolve the
// "@/" alias. tsconfig sets allowImportingTsExtensions.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../lib/locales.ts";
import { BOOK_SOURCES } from "./book-sources.ts";
import {
  LESSON_DISPLAY_FIELDS,
  SECTION_DISPLAY_FIELDS,
  lessonFileName,
  sectionDirName,
  type Lesson,
  type Section,
} from "./curriculum-helpers.ts";

export * from "./curriculum-helpers.ts";

function readCurriculum(locale: string): Section[] | null {
  const file = path.join(
    process.cwd(),
    "content",
    "curriculum",
    `${locale}.json`,
  );
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Section[];
}

function mergeDisplay<T extends object>(
  en: T,
  translated: Record<string, unknown> | undefined,
  fields: readonly string[],
  where: string,
): T {
  if (!translated) return en;
  const merged: T = { ...en };
  const record = merged as Record<string, unknown>;
  const english = en as Record<string, unknown>;
  for (const [key, value] of Object.entries(translated)) {
    if (key === "lessons" || key === "id") continue; // structure, merged separately
    if (value === english[key]) continue;
    if (!fields.includes(key)) {
      console.warn(
        `[i18n] curriculum: ${where}: "${key}" is structural — the edit is ignored (English wins)`,
      );
      continue;
    }
    if (typeof value === "string" || value === null) {
      record[key] = value;
    } else {
      console.warn(
        `[i18n] curriculum: ${where}: "${key}" should be a string — skipped`,
      );
    }
  }
  return merged;
}

function localizeSections(locale: Locale): Section[] {
  const en = readCurriculum(DEFAULT_LOCALE);
  if (!en) throw new Error("content/curriculum/en.json is missing");
  if (locale === DEFAULT_LOCALE) return en;

  const translated = readCurriculum(locale);
  if (!translated) return en;
  const translatedById = new Map(
    translated.map((s) => [s.id, s as unknown as Record<string, unknown>]),
  );

  const merged = en.map((section) => {
    const t = translatedById.get(section.id);
    translatedById.delete(section.id);
    const mergedSection = mergeDisplay(
      section,
      t,
      SECTION_DISPLAY_FIELDS,
      `section "${section.id}"`,
    );
    const tLessons = new Map(
      (Array.isArray(t?.lessons) ? (t.lessons as Lesson[]) : []).map((l) => [
        l.id,
        l as unknown as Record<string, unknown>,
      ]),
    );
    const lessons = section.lessons.map((lesson) => {
      const tl = tLessons.get(lesson.id);
      tLessons.delete(lesson.id);
      return mergeDisplay(
        lesson,
        tl,
        LESSON_DISPLAY_FIELDS,
        `lesson "${section.id}/${lesson.id}"`,
      );
    });
    for (const id of tLessons.keys()) {
      console.warn(
        `[i18n] curriculum: lesson "${section.id}/${id}" doesn't exist in English — skipped`,
      );
    }
    return { ...mergedSection, lessons };
  });
  for (const id of translatedById.keys()) {
    console.warn(
      `[i18n] curriculum: section "${id}" doesn't exist in English — skipped`,
    );
  }
  return merged;
}

// Built eagerly for every locale at module load — fail-fast, and cheap
// at this size.
const sectionsByLocale = new Map<Locale, Section[]>(
  LOCALES.map((locale) => [locale, localizeSections(locale)]),
);

function sectionsFor(locale: Locale): Section[] {
  return sectionsByLocale.get(locale) ?? sectionsByLocale.get(DEFAULT_LOCALE)!;
}

/** The sections shown on the site (sidebar, overview, sitemap, search). */
export function getSections(locale: Locale): Section[] {
  return sectionsFor(locale).filter((section) => !section.hidden);
}

/** Every section including hidden ones — for page generation and the
 *  content-pipeline tooling, which must keep covering hidden lessons. */
export function getAllSections(locale: Locale): Section[] {
  return sectionsFor(locale);
}

function findSectionByRoute(
  locale: Locale,
  sectionParam: string,
): Section | undefined {
  return sectionsFor(locale).find((section) => section.id === sectionParam);
}

export type LessonWithContext = Lesson & {
  section: Section;
  prev: { lesson: Lesson; section: Section } | null;
  next: { lesson: Lesson; section: Section } | null;
};

export function getLesson(
  locale: Locale,
  sectionParam: string,
  lessonId: string,
): LessonWithContext | null {
  const section = findSectionByRoute(locale, sectionParam);
  if (!section) return null;

  const index = section.lessons.findIndex(({ id }) => id === lessonId);
  if (index === -1) return null;

  // Prev/next continue across section boundaries, preserving the original
  // weekly reading order across the whole curriculum. Hidden sections are
  // excluded from the chain (so visible lessons never link into them) —
  // except the current lesson's own section, so that navigation still works
  // when reading a hidden section directly.
  const flattened = sectionsFor(locale)
    .filter((s) => !s.hidden || s.id === section.id)
    .flatMap((section) =>
      section.lessons.map((lesson) => ({ lesson, section })),
    );
  const flatIndex = flattened.findIndex(
    ({ lesson, section: s }) => s.id === section.id && lesson.id === lessonId,
  );
  const prev = flatIndex > 0 ? flattened[flatIndex - 1] : null;
  const next =
    flatIndex < flattened.length - 1 ? flattened[flatIndex + 1] : null;

  return { ...section.lessons[index], section, prev, next };
}

/** On-disk { dir, file } (both prefixed, no extension) for a lesson by id.
 *  Structural — always resolved against the English curriculum. */
export function lessonDiskPath(
  sectionParam: string,
  lessonId: string,
): { dir: string; file: string } {
  const section = findSectionByRoute(DEFAULT_LOCALE, sectionParam);
  const lesson = section?.lessons.find((l) => l.id === lessonId);
  if (!section || !lesson)
    throw new Error(`unknown lesson: ${sectionParam}/${lessonId}`);
  return {
    dir: sectionDirName(section),
    file: lessonFileName(section, lesson),
  };
}

// The interpolated parts are kept as these helpers' own parameters: Turbopack
// only builds the `content/lessons/*/*/*.mdx` glob for a dynamic import when
// the holes are free identifiers (function params), not a traced call result.
async function importLessonMdx(locale: string, dir: string, file: string) {
  return (await import(`../../content/lessons/${locale}/${dir}/${file}.mdx`))
    .default;
}
// The texts of the books repository (src/data/book-sources.ts): a book in
// parts (the School's lessons, a part per section), or one without.
async function importPartEntry(
  work: string,
  edition: string,
  part: string,
  nn: string,
) {
  return (
    await import(
      `../../content/books/books/${work}/${edition}/${part}/${nn}.mdx`
    )
  ).default;
}
async function importEntry(work: string, edition: string, nn: string) {
  return (
    await import(`../../content/books/books/${work}/${edition}/${nn}.mdx`)
  ).default;
}

/** Whether a section's English text is the books repository's. */
export const isBookSection = (sectionId: string) => sectionId in BOOK_SOURCES;

/** A lesson's file in its section's text in the repository: its number in
 *  the section, two digits (NN.mdx). */
function bookEntry(sectionId: string, lessonId: string): string {
  const section = findSectionByRoute(DEFAULT_LOCALE, sectionId);
  const n = (section?.lessons.findIndex((l) => l.id === lessonId) ?? -1) + 1;
  if (!n) throw new Error(`unknown lesson: ${sectionId}/${lessonId}`);
  return String(n).padStart(2, "0");
}

/** Where a lesson's MDX is on disk, absolute: this site's own transcript
 *  (content/lessons/<locale>/…), or, in English, the books repository's
 *  text for the sections it holds. The file may not exist for a locale
 *  other than English (lessonContentLocale). Every reader of lesson files
 *  (the pages, the search index, the print, the translation copies) comes
 *  here. */
export function lessonSourceFile(
  locale: Locale,
  sectionId: string,
  lessonId: string,
): string {
  const source = BOOK_SOURCES[sectionId];
  if (source && locale === DEFAULT_LOCALE) {
    return path.join(
      process.cwd(),
      "content/books/books",
      source.work,
      source.edition,
      source.part ?? "",
      `${bookEntry(sectionId, lessonId)}.mdx`,
    );
  }
  const { dir, file } = lessonDiskPath(sectionId, lessonId);
  return path.join(
    process.cwd(),
    "content",
    "lessons",
    locale,
    dir,
    `${file}.mdx`,
  );
}

/**
 * The locale whose transcript a lesson page should render: the page's own
 * when a translation exists, else English (every English lesson has a file).
 * A partial translation always ships. Same rule as pages.ts.
 */
export function lessonContentLocale(
  locale: Locale,
  sectionId: string,
  lessonId: string,
): Locale {
  if (locale === DEFAULT_LOCALE) return locale;
  return fs.existsSync(lessonSourceFile(locale, sectionId, lessonId))
    ? locale
    : DEFAULT_LOCALE;
}

/** The compiled MDX component for a lesson. `locale` must come from
 *  lessonContentLocale — a missing file would throw at import time. */
export async function getLessonContent(
  locale: Locale,
  sectionId: string,
  lessonId: string,
) {
  const source = BOOK_SOURCES[sectionId];
  if (source && locale === DEFAULT_LOCALE) {
    const nn = bookEntry(sectionId, lessonId);
    return source.part
      ? importPartEntry(source.work, source.edition, source.part, nn)
      : importEntry(source.work, source.edition, nn);
  }
  const { dir, file } = lessonDiskPath(sectionId, lessonId);
  return importLessonMdx(locale, dir, file);
}

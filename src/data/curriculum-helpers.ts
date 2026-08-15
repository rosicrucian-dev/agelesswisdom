/**
 * Client-safe curriculum types + pure helpers. These operate on Section/
 * Lesson objects passed in (already localized by src/data/curriculum.ts,
 * which is server-only — it reads content/curriculum/<locale>.json with
 * node:fs and must not be imported from client components).
 */

export type Lesson = {
  id: string;
  /** Optional: some lessons (e.g. Book 4's weekly practice lessons) have no
   *  distinct title and display as just "Lesson N". */
  title?: string;
  description?: string;
  /** Optional per-lesson unit noun overriding the section's, e.g. the three
   *  "Supplement"s folded onto the end of Section A's "Lesson"s. Items sharing
   *  a unit label are numbered independently within the section. */
  unitLabel?: string;
  /** When set, the item carries no "Lesson N"/"Supplement N" prefix anywhere —
   *  it displays as its bare title. For pieces published as standalone works
   *  (e.g. the "Correlation of Sound and Colour" pamphlet) rather than numbered
   *  lessons. Excluded from its unit's numbering so siblings count from 1. */
  unnumbered?: boolean;
};

export type Section = {
  /** Stable id — ALSO the URL segment and the on-disk directory name.
   *  Locale-independent by design (never derived from display text). */
  id: string;
  /** The section's canonical display name, e.g. "Section A" or
   *  "Tarot Instruction – First Section". Shown in the sidebar, the overview,
   *  and page titles. Display text — translatable. */
  label: string;
  /** Optional shorter name for cramped contexts (breadcrumb, lesson eyebrow)
   *  where the full `label` runs long, e.g. "Tarot First" for
   *  "Tarot Instruction – First Section". Falls back to `label` when absent.
   *  Display text — translatable. */
  shortLabel?: string;
  description?: string;
  /** Noun used when numbering items, e.g. "Lesson 1", "Supplement 1".
   *  Display text — translatable ("Lektion 1"). */
  unitLabel?: string;
  /**
   * Hidden sections are kept out of every listing surface (sidebar,
   * overview, sitemap, search, prev/next chain) but their lesson pages
   * still build and resolve by direct URL.
   */
  hidden?: boolean;
  /**
   * Marks material published separately by Paul Foster Case, outside the core
   * School of Ageless Wisdom curriculum. The overview groups these under an
   * "Additional Material" heading. Structural (read from English only).
   */
  additional?: boolean;
  lessons: Lesson[];
};

/** The effective unit noun for a lesson: its own override, else the section's,
 *  else "Lesson" (defensive only — en.json sets unitLabel explicitly). */
export function unitLabelOf(section: Section, lesson: Lesson): string {
  return lesson.unitLabel ?? section.unitLabel ?? "Lesson";
}

/** Position of a lesson among the section's items that share its unit label,
 *  e.g. "Supplement 2 of 3" even when it sits after ten Lessons. */
export function lessonUnitPosition(
  section: Section,
  lesson: Lesson,
): { unit: string; number: number; total: number } {
  let unit = unitLabelOf(section, lesson);
  let group = section.lessons.filter(
    (l) => !l.unnumbered && unitLabelOf(section, l) === unit,
  );
  return {
    unit,
    number: group.findIndex(({ id }) => id === lesson.id) + 1,
    total: group.length,
  };
}

/** Navigational title with the item's number, e.g. "Lesson 1 - The Life Power",
 *  or just "Lesson 1" when the lesson has no distinct title. Unnumbered items
 *  (standalone works) render as their bare title. */
export function numberedLessonTitle(section: Section, lesson: Lesson): string {
  let { unit, title } = lessonTitleParts(section, lesson);
  if (!unit) return title ?? unitLabelOf(section, lesson);
  return title ? `${unit} - ${title}` : unit;
}

/** The unit label with number ("Lesson 1", "Supplement 2") and the lesson's
 *  title as separate strings, for two-line rendering. `title` is undefined for
 *  untitled lessons; `unit` is undefined for unnumbered items (no prefix). */
export function lessonTitleParts(
  section: Section,
  lesson: Lesson,
): { unit?: string; title?: string } {
  if (lesson.unnumbered) return { title: lesson.title };
  let { unit, number } = lessonUnitPosition(section, lesson);
  return { unit: `${unit} ${number}`, title: lesson.title };
}

/** URL segment for a section — its stable id, NEVER derived from the
 *  (translatable) label. */
export function sectionUrlSlug(section: Section): string {
  return section.id;
}

/** The section name to use in cramped contexts (breadcrumb, lesson eyebrow):
 *  its `shortLabel` alias when set, else the full `label`. */
export function sectionShortLabel(section: Section): string {
  return section.shortLabel ?? section.label;
}

export function lessonUrl(section: Section, lesson: Lesson): string {
  return `/${sectionUrlSlug(section)}/${lesson.id}`;
}

/**
 * Physical names for a lesson's on-disk assets, shared by the app and the
 * content scripts so the names never drift. Locale-independent: every
 * locale's lesson tree uses the same directory/file names (ids + a
 * two-digit reading-order prefix from array position).
 */
export function sectionDirName(section: Section): string {
  return sectionUrlSlug(section);
}

export function lessonFileName(section: Section, lesson: Lesson): string {
  let n = section.lessons.findIndex((l) => l.id === lesson.id) + 1;
  return `${String(n).padStart(2, "0")}-${lesson.id}`;
}

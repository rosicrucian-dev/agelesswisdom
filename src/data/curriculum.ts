/**
 * The course curriculum, modeled on Paul Foster Case's original School of
 * Ageless Wisdom sequence: Sections A and B (the "First Year Course"),
 * Sections C and D, Tarot Instruction First and Second, then Hermetic
 * Alchemy. Lessons were originally issued weekly; the site preserves that
 * sequence as the reading order.
 *
 * Lesson MDX lives at `content/lessons/<N-section>/<NN-lesson>.mdx` (the
 * files carry a numeric reading-order prefix; lesson URL slugs use the
 * un-prefixed `id` while section URL slugs come from the section `label` —
 * see sectionDirName/lessonFileName), produced by `scripts/extract.ts`
 * from the OCR of the published volumes and then curated by hand. The MDX
 * files are the source of truth for lesson text.
 *
 * `description` is optional and intentionally left blank for now — editorial
 * summaries can be added later, and any lesson/section that has one will show
 * it automatically.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DO NOT PUBLISH — permanent exclusion (donor condition):
 *
 *   "The Ritual of the Pentagram"  — Esoteric Secrets of Magic (Section D),
 *   the SIXTH lesson of that section (source file MAGIC.06, NOT a Section C
 *   lesson). It has no MDX under content/lessons, and must NEVER get one, and
 *   must NEVER appear as a lesson entry below (any `id` such as
 *   "the-ritual-of-the-pentagram"). This is a standing restriction, not an
 *   oversight — if a future tool or import appears to be "missing" this
 *   lesson, that is correct and intentional; do not add it.
 *
 * The full machine-readable denylist and its lint tripwire live in the local
 * (gitignored) editorial workspace: editorial/excluded-lessons.json, enforced
 * by `npm --prefix editorial run lint:lessons` / `validate:structure`.
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
};

export type Section = {
  id: string;
  /** Short eyebrow label, e.g. "Section A". */
  label: string;
  title?: string | null;
  description?: string;
  /** Noun used when numbering items, e.g. "Lesson 1", "Supplement 1". Defaults to "Lesson". */
  unitLabel?: string;
  /**
   * Hidden sections are kept out of every listing surface (sidebar,
   * overview, sitemap, search, prev/next chain) but their lesson pages
   * still build and resolve by direct URL.
   */
  hidden?: boolean;
  lessons: Lesson[];
};

/** The sections shown on the site (sidebar, overview, sitemap, search). */
export function getSections(): Section[] {
  return sections.filter((section) => !section.hidden);
}

/** Every section including hidden ones — for page generation and the
 *  content-pipeline tooling, which must keep covering hidden lessons. */
export function getAllSections(): Section[] {
  return sections;
}

/** The effective unit noun for a lesson: its own override, else the section's,
 *  else "Lesson". */
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
  let group = section.lessons.filter((l) => unitLabelOf(section, l) === unit);
  return {
    unit,
    number: group.findIndex(({ id }) => id === lesson.id) + 1,
    total: group.length,
  };
}

/** Navigational title with the item's number, e.g. "Lesson 1 - The Life Power",
 *  or just "Lesson 1" when the lesson has no distinct title. */
export function numberedLessonTitle(section: Section, lesson: Lesson): string {
  let { unit, title } = lessonTitleParts(section, lesson);
  return title ? `${unit} - ${title}` : unit;
}

/** The unit label with number ("Lesson 1", "Supplement 2") and the lesson's
 *  title as separate strings, for two-line rendering. `title` is undefined for
 *  untitled lessons. */
export function lessonTitleParts(
  section: Section,
  lesson: Lesson,
): { unit: string; title?: string } {
  let { unit, number } = lessonUnitPosition(section, lesson);
  return { unit: `${unit} ${number}`, title: lesson.title };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sectionUrlSlug(section: Section): string {
  return slugify(section.label);
}

export function lessonUrl(section: Section, lesson: Lesson): string {
  return `/${sectionUrlSlug(section)}/${lesson.id}`;
}

function sectionMatchesRoute(section: Section, sectionParam: string): boolean {
  return (
    sectionUrlSlug(section) === sectionParam || section.id === sectionParam
  );
}

function findSectionByRoute(sectionParam: string): Section | undefined {
  return sections.find((section) => sectionMatchesRoute(section, sectionParam));
}

export type LessonWithContext = Lesson & {
  section: Section;
  prev: { lesson: Lesson; section: Section } | null;
  next: { lesson: Lesson; section: Section } | null;
};

export function getLesson(
  sectionParam: string,
  lessonId: string,
): LessonWithContext | null {
  let section = findSectionByRoute(sectionParam);
  if (!section) return null;

  let index = section.lessons.findIndex(({ id }) => id === lessonId);
  if (index === -1) return null;

  // Prev/next continue across section boundaries, preserving the original
  // weekly reading order across the whole curriculum. Hidden sections are
  // excluded from the chain (so visible lessons never link into them) —
  // except the current lesson's own section, so that navigation still works
  // when reading a hidden section directly.
  let flattened = sections
    .filter((s) => !s.hidden || s.id === section.id)
    .flatMap((section) =>
      section.lessons.map((lesson) => ({ lesson, section })),
    );
  let flatIndex = flattened.findIndex(
    ({ lesson, section: s }) => s.id === section.id && lesson.id === lessonId,
  );
  let prev = flatIndex > 0 ? flattened[flatIndex - 1] : null;
  let next = flatIndex < flattened.length - 1 ? flattened[flatIndex + 1] : null;

  return { ...section.lessons[index], section, prev, next };
}

/**
 * Physical names for a lesson's on-disk assets. Section directories are named
 * by the section's URL slug (derived from its `label`), so the folder name
 * matches the public route and carries no book-title reference:
 *   sectionDirName -> "section-a"   (Section A), "section-final" (Section Final)
 *   lessonFileName -> "01-the-life-power"
 * Lesson files keep a two-digit reading-order prefix within the section.
 * This is the single source of truth for those names: the app AND the content
 * scripts (extract/split/lint) import these so the names never drift.
 */
export function sectionDirName(section: Section): string {
  return sectionUrlSlug(section);
}

export function lessonFileName(section: Section, lesson: Lesson): string {
  let n = section.lessons.findIndex((l) => l.id === lesson.id) + 1;
  return `${String(n).padStart(2, "0")}-${lesson.id}`;
}

/** Section directory name by id/route, e.g. "section-a". */
export function sectionDirNameById(sectionId: string): string {
  let section = findSectionByRoute(sectionId);
  if (!section) throw new Error(`unknown section: ${sectionId}`);
  return sectionDirName(section);
}

/** On-disk { dir, file } (both prefixed, no extension) for a lesson by id. */
export function lessonDiskPath(
  sectionParam: string,
  lessonId: string,
): { dir: string; file: string } {
  let section = findSectionByRoute(sectionParam);
  let lesson = section?.lessons.find((l) => l.id === lessonId);
  if (!section || !lesson)
    throw new Error(`unknown lesson: ${sectionParam}/${lessonId}`);
  return {
    dir: sectionDirName(section),
    file: lessonFileName(section, lesson),
  };
}

// The interpolated parts are kept as this helper's own parameters: Turbopack
// only builds the `content/lessons/*/*.mdx` glob for a dynamic import when the
// holes are free identifiers (function params), not a traced call result.
async function importLessonMdx(dir: string, file: string) {
  return (await import(`../../content/lessons/${dir}/${file}.mdx`)).default;
}

export async function getLessonContent(sectionId: string, lessonId: string) {
  let { dir, file } = lessonDiskPath(sectionId, lessonId);
  return importLessonMdx(dir, file);
}

const sections: Section[] = [
  {
    id: "section-a",
    label: "Section A",
    title: "Introduction",
    lessons: [
      { id: "the-life-power", title: "The Life-Power" },
      { id: "the-three-principles", title: "The Three Principles" },
      {
        id: "five-phases-of-life-expression",
        title: "Five Phases of Life Expression",
      },
      { id: "the-seven-forces", title: "The Seven Forces" },
      {
        id: "twelve-channels-of-life-expression",
        title: "Twelve Channels of Life Expression",
      },
      {
        id: "correlation-of-sound-and-color",
        title: "Correlation of Sound and Color",
      },
      { id: "symbolism-of-numbers", title: "Symbolism of Numbers" },
      { id: "the-wisdom-alphabet", title: "The Wisdom Alphabet" },
      { id: "an-outline-of-the-qabalah", title: "An Outline of the Qabalah" },
      { id: "the-tree-of-life", title: "The Tree of Life" },
    ],
  },
  {
    id: "section-b",
    label: "Section B",
    title: "Introduction",
    lessons: [
      { id: "bondage", title: "Bondage" },
      { id: "awakening", title: "Awakening" },
      { id: "revelation", title: "Revelation" },
      { id: "organization", title: "Organization" },
      { id: "regeneration", title: "Regeneration" },
      { id: "realization", title: "Realization" },
      { id: "cosmic-consciousness", title: "Cosmic Consciousness" },
      {
        id: "a-note-on-color",
        title: "A Note on Color",
        unitLabel: "Supplement",
      },
      {
        id: "spiritual-or-physical",
        title: "Spiritual or Physical?",
        unitLabel: "Supplement",
      },
      {
        id: "the-pi-proportion",
        title: "The Pi Proportion",
        unitLabel: "Supplement",
      },
    ],
  },
  {
    id: "section-c",
    label: "Section C",
    title: "Introduction",
    lessons: [
      { id: "practice-of-concentration", title: "Practice of Concentration" },
      { id: "qabalistic-meditation", title: "Qabalistic Meditation" },
      { id: "the-power-of-the-mind", title: "The Power of the Mind" },
      { id: "watchful-introspection", title: "Watchful Introspection" },
      {
        id: "contemplations-of-the-adepti",
        title: "Contemplations of the Adepti",
      },
      {
        id: "evolution-of-homo-spiritualis",
        title: "Evolution of Homo Spiritualis",
      },
      { id: "mastership", title: "Mastership" },
      { id: "the-true-creative-self", title: "The True Creative Self" },
      { id: "the-perfect-stone", title: "The Perfect Stone" },
    ],
  },
  {
    id: "section-d",
    label: "Section D",
    title: "Introduction",
    lessons: [
      { id: "the-secret-force", title: "The Secret Force" },
      { id: "the-magic-circle", title: "The Magic Circle" },
      { id: "the-magical-altar", title: "The Magical Altar" },
      { id: "platonic-solids", title: "Platonic Solids" },
      {
        id: "magical-instruments-and-vestments",
        title: "Magical Instruments and Vestments",
      },
      { id: "the-four-maxims", title: "The Four Maxims" },
      { id: "the-great-arcanum", title: "The Great Arcanum" },
      {
        id: "the-chaldean-oracles",
        title: "The Chaldean Oracles",
        unitLabel: "Supplement",
      },
    ],
  },
  {
    id: "section-first",
    label: "Section First",
    title: "Tarot Instruction",
    lessons: [
      {
        id: "the-object-of-tarot-practice",
        title: "The Object of Tarot Practice",
      },
      { id: "the-symbolism-of-numbers", title: "The Symbolism of Numbers" },
      { id: "the-life-power", title: "The Life Power" },
      { id: "self-consciousness", title: "Self-Consciousness" },
      { id: "sub-consciousness", title: "Sub-Consciousness" },
      { id: "creative-imagination", title: "Creative Imagination" },
      { id: "reason", title: "Reason" },
      { id: "intuition", title: "Intuition" },
      { id: "discrimination", title: "Discrimination" },
      { id: "will-power", title: "Will Power" },
      { id: "the-secret-power", title: "The Secret Power" },
      { id: "response", title: "Response" },
      { id: "rotation", title: "Rotation" },
      { id: "action-equilibrium", title: "Action-Equilibrium" },
      { id: "reversal", title: "Reversal" },
      { id: "transformation", title: "Transformation" },
      { id: "verification", title: "Verification" },
      { id: "bondage", title: "Bondage" },
      { id: "awakening", title: "Awakening" },
      { id: "revelation", title: "Revelation" },
      { id: "organization", title: "Organization" },
      { id: "regeneration", title: "Regeneration" },
      { id: "realization", title: "Realization" },
      { id: "cosmic-consciousness", title: "Cosmic Consciousness" },
    ],
  },
  {
    id: "section-second",
    label: "Section Second",
    title: "Tarot Instruction",
    lessons: [
      { id: "the-hidden-force", title: "The Hidden Force" },
      { id: "the-true-magic", title: "The True Magic" },
      { id: "tableau-1", title: "Tableau 1" },
      { id: "tableau-2", title: "Tableau 2" },
      { id: "tableau-3", title: "Tableau 3" },
      { id: "tableau-4", title: "Tableau 4" },
      { id: "tableau-5", title: "Tableau 5" },
      { id: "tableau-6", title: "Tableau 6" },
      { id: "tableau-7", title: "Tableau 7" },
      { id: "tableau-8", title: "Tableau 8" },
      { id: "tableau-9", title: "Tableau 9" },
      { id: "tableau-10", title: "Tableau 10" },
      { id: "tableau-11", title: "Tableau 11" },
      { id: "tableau-12", title: "Tableau 12" },
      { id: "tableau-13", title: "Tableau 13" },
      { id: "tableau-14", title: "Tableau 14" },
      { id: "tableau-15", title: "Tableau 15" },
      { id: "tableau-16", title: "Tableau 16" },
      { id: "tableau-17", title: "Tableau 17" },
      { id: "tableau-18", title: "Tableau 18" },
      { id: "tableau-19", title: "Tableau 19" },
      { id: "tableau-20", title: "Tableau 20" },
      { id: "tableau-21", title: "Tableau 21" },
      { id: "tarot-groups", title: "Tarot Groups", unitLabel: "Supplement" },
    ],
  },
  {
    id: "section-final",
    label: "Section Final",
    title: "Hermetic Alchemy",
    lessons: [
      { id: "what-alchemy-really-is", title: "What Alchemy Really Is" },
      { id: "the-first-matter", title: "The First Matter 1" },
      {
        id: "the-first-matter-continued",
        title: "The First Matter 2",
      },
      { id: "the-three-principles", title: "The Three Principles" },
      { id: "fire", title: "Fire" },
      { id: "water", title: "Water" },
      { id: "the-alchemical-process-1", title: "The Alchemical Process 1" },
      { id: "the-alchemical-process-2", title: "The Alchemical Process 2" },
      { id: "the-alchemical-process-3", title: "The Alchemical Process 3" },
      { id: "the-alchemical-process-4", title: "The Alchemical Process 4" },
    ],
  },
];

// agelesswisdom's adapter over the shared search-engine. The engine (tokenizer,
// positional index, phrase + BM25 ranking) lives in ./search-engine and is kept
// identical with botatoolbox; this file is the project-local part: the lesson
// document type. Search is per-locale (real translated content), so the locale
// flows straight through to the engine's tokenize/query.

// stripMarkdown stays in the engine for the sibling project; nothing here needs
// it since the generator indexes the MDX pipeline's own block text.
export {
  buildInvertedIndex,
  highlightParts,
  matchRanges,
  parseQuery,
  searchIndex,
  snippetParts,
  tokenize,
  type SnippetPart,
} from "./search-engine.ts";
import {
  searchIndex as engineSearch,
  matchRanges,
  parseQuery as parse,
  tokenize as tokenizeText,
  type SearchIndex as EngineIndex,
  type SearchResult as EngineResult,
} from "./search-engine.ts";

/** A searchable lesson. */
export type SearchLesson = {
  /** Route href, e.g. "/section-a/the-life-power". */
  href: string;
  /** Numbered display title, e.g. "Lesson 1 - The Life Power". */
  title: string;
  /** Section label for the result subtitle, e.g. "Section A". */
  section: string;
  /**
   * Token position at which each anchored block's span begins, ascending.
   * Parallel to `anchors`. Written by scripts/gen-search-index.ts from the
   * real MDX compile, so it lines up with the ids on the rendered page.
   */
  blocks: number[];
  /** The anchor id of each span — `p1`, `p2`, … (see
   *  plugins/rehype-lesson-anchors.mjs). Parallel to `blocks`. */
  anchors: string[];
};

/**
 * Index of the anchored block whose span contains `at`, or -1 when the match
 * sits before the first anchor (a title hit) or the doc predates block data.
 * The same index addresses the snippet sidecar, which is written parallel to
 * `anchors`.
 */
export function resultBlock(doc: SearchLesson, at?: number): number {
  if (at == null || !doc.blocks?.length) return -1;
  // Last block whose span starts at or before `at`.
  let lo = 0;
  let hi = doc.blocks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (doc.blocks[mid] <= at) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Deep link to the passage a result matched, or the plain lesson URL. */
export function resultHref(doc: SearchLesson, at?: number): string {
  const block = resultBlock(doc, at);
  return block < 0 ? doc.href : `${doc.href}#${doc.anchors[block]}`;
}

/**
 * URL of a lesson's snippet sidecar (see scripts/gen-search-index.ts).
 *
 * `version` is the index's content stamp. Sidecars live at stable paths and are
 * cached hard by the service worker, so the stamp is what makes a deploy
 * invalidate them: new text → new stamp → new URL → a miss. Omitting it is
 * harmless (the URL still resolves) but leaves the reader on cached text.
 */
export function snippetUrl(
  locale: string,
  doc: SearchLesson,
  version?: string,
): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const query = version ? `?v=${version}` : "";
  return `${base}/search/${locale}${doc.href}.json${query}`;
}

/** URL of a locale's search index. The shared fetch hook is keyed by URL, so
 *  working out the URL is the project's job, not the hook's. */
export function searchIndexUrl(locale: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/search-index.${locale}.json`;
}

export type SearchIndex = EngineIndex<SearchLesson> & {
  /**
   * The locale whose stopword list this index was tokenized with — written by
   * gen-search-index. Usually the index's own locale, but an untranslated
   * locale is tokenized as English (see the generator). The query side MUST
   * tokenize with this, not with the page locale, or the two disagree.
   */
  locale?: string;
  /** Content stamp of this locale's snippet sidecars — see `snippetUrl`. */
  version?: string;
};
export type SearchResult = EngineResult<SearchLesson>;

/**
 * Does this lesson's TITLE contain every query word? The last word may match by
 * prefix, so the lesson surfaces while its name is still being typed.
 */
function titleMatches(
  title: string,
  tokens: string[],
  locale: string,
): boolean {
  if (!tokens.length) return false;
  const words = tokenizeText(title, locale);
  return tokens.every((token, i) =>
    i === tokens.length - 1
      ? words.some((w) => w.startsWith(token))
      : words.includes(token),
  );
}

/**
 * Search, then float lessons whose TITLE matches to the front of their group.
 *
 * BM25 ranks by how distinctive the query words are, which is right for prose
 * but wrong for names: "life" and "power" appear all through this material, so
 * "the life power" scored the lesson actually CALLED "The Life-Power" 20th of
 * 102. Titles rank fine on their own whenever the words are at all distinctive
 * ("the tree of life" → 1st), so this is a targeted correction, not a thumb on
 * every scale — measured firing on 1-2 lessons per query.
 *
 * The sort is stable and keyed on `phrase > 0` first, so a title match is only
 * floated past others that matched the same WAY — a scattered hit never jumps
 * above a lesson that has the words together.
 *
 * Returns EVERY match: the dialog shows them all and pays only for the
 * snippets of the first few, so nothing is hidden from the reader.
 */
export function searchLessons(
  index: SearchIndex,
  query: string,
  locale = "en",
): SearchResult[] {
  const all = engineSearch(index, query, locale, Number.MAX_SAFE_INTEGER);
  const tokens = parse(query, locale).flatMap((s) => s.tokens);
  const titled = new Map(
    all.map((r) => [r.doc.href, titleMatches(r.doc.title, tokens, locale)]),
  );
  all.sort(
    (a, b) =>
      Number(b.phrase > 0) - Number(a.phrase > 0) ||
      Number(titled.get(b.doc.href)) - Number(titled.get(a.doc.href)),
  );
  return all;
}

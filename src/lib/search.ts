// agelesswisdom's adapter over the search engine (@rosicrucian/search).
// The engine knows documents, sections, an index and results; this file is the
// project-local part: what a lesson carries as `meta`, where its index and
// section texts live, and what an arrived-at page needs to mark the words.
//
// Scripts import this by relative path under --experimental-strip-types, so it
// uses no `@` aliases.

import type { SearchIndex, SearchResult } from "@rosicrucian/search";
import { BASE_PATH } from "./site.ts";

/** What a lesson result carries back from the index. */
export type LessonMeta = {
  /** Route href, e.g. "/section-a/the-life-power". Also the document id. */
  href: string;
  /** Section label for the result subtitle, e.g. "Section A". */
  section: string;
};

export type LessonIndex = SearchIndex<LessonMeta>;
export type LessonResult = SearchResult<LessonMeta>;

/** The mark on an arrived-at page's matched words. */
export const SEARCH_MARK_CLASS =
  "rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-400/30";

/**
 * Where a result sends the reader: the passage it matched (`#p12`) when the
 * best hit is in the body of an anchored section, else the lesson itself — a
 * title hit is a hit on the lesson as a whole, and deep-linking it to the first
 * paragraph would drop the reader at a passage that need not contain the words.
 */
export function resultHref(result: LessonResult): string {
  const href = result.meta?.href ?? result.id;
  const { best } = result;
  return best.where === "body" && best.anchor ? `${href}#${best.anchor}` : href;
}

/**
 * URL of a lesson's section texts (see scripts/gen-search-index.ts).
 *
 * `stamp` is the index's content stamp. The files live at stable paths and are
 * cached hard by the service worker, so the stamp is what makes a deploy
 * invalidate them: new text → new stamp → new URL → a miss. Omitting it is
 * harmless (the URL still resolves) but leaves the reader on cached text.
 */
export function snippetUrl(locale: string, id: string, stamp?: string): string {
  const query = stamp ? `?v=${stamp}` : "";
  return `${BASE_PATH}/search/${locale}${id}.json${query}`;
}

/** URL of a locale's search index. The shared fetch hook is keyed by URL, so
 *  working out the URL is the project's job, not the hook's. */
export function searchIndexUrl(locale: string): string {
  return `${BASE_PATH}/search-index.${locale}.json`;
}

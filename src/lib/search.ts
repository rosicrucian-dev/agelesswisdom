// agelesswisdom's adapter over the shared search-engine. The engine (tokenizer,
// positional index, phrase + BM25 ranking) lives in ./search-engine and is kept
// identical with botatoolbox; this file is the project-local part: the lesson
// document type. Search is per-locale (real translated content), so the locale
// flows straight through to the engine's tokenize/query.

export {
  tokenize,
  searchIndex,
  buildInvertedIndex,
  stripMarkdown,
} from "./search-engine";
import type {
  SearchIndex as EngineIndex,
  SearchResult as EngineResult,
} from "./search-engine";

/** A searchable lesson. */
export type SearchLesson = {
  /** Route href, e.g. "/section-a/the-life-power". */
  href: string;
  /** Numbered display title, e.g. "Lesson 1 - The Life Power". */
  title: string;
  /** Section label for the result subtitle, e.g. "Section A". */
  section: string;
};

export type SearchIndex = EngineIndex<SearchLesson>;
export type SearchResult = EngineResult<SearchLesson>;

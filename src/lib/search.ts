/**
 * Full-text lesson search over a prebuilt inverted index.
 *
 * scripts/gen-search-index.ts tokenizes every lesson MDX with the SAME
 * tokenize() below and writes public/search-index.<locale>.json
 * ({ lessons, words }) per locale; the search dialog fetches the current
 * locale's file on first open and queries it here. Keeping tokenizer +
 * query logic in this one module is what guarantees the index and the
 * queries can never disagree.
 */

export type SearchLesson = {
  /** Route href, e.g. "/section-a/the-life-power". */
  href: string;
  /** Numbered display title, e.g. "Lesson 1 - The Life Power". */
  title: string;
  /** Section label for the result subtitle, e.g. "Section A". */
  section: string;
};

export type SearchIndex = {
  lessons: SearchLesson[];
  /** word -> flat pairs [lessonIdx, count, lessonIdx, count, ...] */
  words: Record<string, number[]>;
};

export type SearchResult = {
  lesson: SearchLesson;
  /** Total occurrences of all matched words in this lesson. */
  count: number;
};

/**
 * High-frequency words that would match nearly every lesson. Kept short and
 * boring on purpose: doctrinal vocabulary (life, power, light...) stays
 * searchable even though it is frequent.
 */
const STOPWORDS: Record<string, ReadonlySet<string>> = {
  en: new Set(
    (
      "the of is a and to in it that this as by which for with are be not was " +
      "or its from an but have has we you your they their them he his him she " +
      "her on at when what who whom whose there these those than then so if " +
      "into upon our us out all will shall may can do does did been being were " +
      "would should could also more most other some such no nor only very am " +
      "i me my mine had how because while where after before between during"
    ).split(" "),
  ),
  de: new Set(
    (
      "der die das den dem des ein eine einen einem eines einer und oder aber " +
      "ist sind war waren sein seine seiner ihr ihre ihrer es sie er wir ich " +
      "du ihr man nicht kein keine auch nur noch schon so wie als wenn dann " +
      "denn dass weil mit von zu zur zum auf in im am an bei nach vor über " +
      "unter durch für gegen ohne um aus hat haben hatte hatten wird werden " +
      "wurde wurden kann können muss müssen soll sollen darf dürfen mehr sehr " +
      "alle allem allen aller alles dies diese diesem diesen dieser dieses"
    ).split(" "),
  ),
};

/**
 * Lowercase word tokens, apostrophe-trimmed, possessives folded onto their
 * noun, stopwords and single letters dropped. Used verbatim by both the index
 * generator and the query side.
 */
export function tokenize(text: string, locale: string = "en"): string[] {
  const stopwords = STOPWORDS[locale] ?? STOPWORDS.en;
  // \p{L} keeps accented and non-Latin letters (Hebrew glyphs, German
  // umlauts) searchable — the old [a-z] tokenizer silently dropped them.
  return (text.toLowerCase().match(/[\p{L}][\p{L}']*/gu) ?? [])
    .map((w) => w.replace(/^'+|'+$/g, "").replace(/'s$/, ""))
    .filter((w) => w.length > 1 && !stopwords.has(w));
}

/**
 * Query the index: every query word must appear in a lesson for it to match
 * (AND across words); the final query word also matches by prefix so results
 * appear while the user is still typing ("magi" finds magician/magical/magic).
 * Results are ranked by total occurrences.
 */
export function searchIndex(
  index: SearchIndex,
  query: string,
  locale: string = "en",
  limit = 12,
): SearchResult[] {
  let tokens = tokenize(query, locale);
  if (tokens.length === 0) return [];

  let perToken = tokens.map((token, i) => {
    let hits = new Map<number, number>();
    let addWord = (word: string) => {
      let pairs = index.words[word];
      if (!pairs) return;
      for (let p = 0; p < pairs.length; p += 2) {
        hits.set(pairs[p], (hits.get(pairs[p]) ?? 0) + pairs[p + 1]);
      }
    };
    addWord(token);
    // Prefix-expand the last (still being typed) token.
    if (i === tokens.length - 1 && token.length >= 3) {
      for (let word of Object.keys(index.words)) {
        if (word.length > token.length && word.startsWith(token)) {
          addWord(word);
        }
      }
    }
    return hits;
  });

  let [first, ...rest] = perToken;
  let results: SearchResult[] = [];
  for (let [lessonIdx, count] of first) {
    let total = count;
    let inAll = true;
    for (let hits of rest) {
      let c = hits.get(lessonIdx);
      if (!c) {
        inAll = false;
        break;
      }
      total += c;
    }
    if (inAll) {
      results.push({ lesson: index.lessons[lessonIdx], count: total });
    }
  }

  return results.sort((a, b) => b.count - a.count).slice(0, limit);
}

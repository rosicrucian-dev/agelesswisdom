// Generic full-text search engine — a positional inverted index with
// phrase-first + BM25 ranking. It knows NOTHING about the document type:
// callers supply their own `Doc` (a recording track, a lesson, …) and read it
// back off each result. Pure (no fetch, no DOM), so it's importable by both the
// client query path and the Node index generators.
//
// ⚠ KEEP BYTE-IDENTICAL with the sibling project so the two can eventually be
//   lifted into one shared package — FIX BOTH when you change it:
//     botatoolbox:   src/lib/search-engine.ts
//     agelesswisdom: src/lib/search-engine.ts
//   Only the thin adapter (the Doc type + the generator + the dialog) is
//   project-local; this file is not.

// High-frequency words that would match nearly everything. Per-locale; doctrinal
// vocabulary (life, power, light…) stays searchable on purpose.
const STOPWORDS: Record<string, ReadonlySet<string>> = {
  en: new Set(
    (
      'the of is a and to in it that this as by which for with are be not was ' +
      'or its from an but have has we you your they their them he his him she ' +
      'her on at when what who whom whose there these those than then so if ' +
      'into upon our us out all will shall may can do does did been being were ' +
      'would should could also more most other some such no nor only very am ' +
      'i me my mine had how because while where after before between during'
    ).split(' '),
  ),
  de: new Set(
    (
      'der die das den dem des ein eine einen einem eines einer und oder aber ' +
      'ist sind war waren sein seine seiner ihr ihre ihrer es sie er wir ich ' +
      'du ihr man nicht kein keine auch nur noch schon so wie als wenn dann ' +
      'denn dass weil mit von zu zur zum auf in im am an bei nach vor über ' +
      'unter durch für gegen ohne um aus hat haben hatte hatten wird werden ' +
      'wurde wurden kann können muss müssen soll sollen darf dürfen mehr sehr ' +
      'alle allem allen aller alles dies diese diesem diesen dieser dieses'
    ).split(' '),
  ),
}

/**
 * Lowercase word tokens, apostrophe-trimmed, possessives folded onto their
 * noun, stopwords and single letters dropped. Used verbatim by both the index
 * generator and the query side, so the two can never disagree. Unicode-aware
 * (\p{L}) so accented / non-Latin glyphs survive.
 */
export function tokenize(text: string, locale = 'en'): string[] {
  const stopwords = STOPWORDS[locale] ?? STOPWORDS.en
  return (text.toLowerCase().match(/[\p{L}][\p{L}']*/gu) ?? [])
    .map((w) => w.replace(/^'+|'+$/g, '').replace(/'s$/, ''))
    .filter((w) => w.length > 1 && !stopwords.has(w))
}

export interface SearchIndex<Doc> {
  docs: Doc[]
  /** word → flat runs of [docIdx, count, ...positions] */
  words: Record<string, number[]>
  /** token count per doc, for BM25 length-normalization */
  lengths: number[]
}

export interface SearchResult<Doc> {
  doc: Doc
  /** Total occurrences of all matched words in this doc. */
  count: number
  /** Occurrences of the full query as a contiguous phrase (0 = scattered match;
   *  = count for a single-word query). Results are ranked by this first. */
  phrase: number
}

/** Strip markdown/MDX mechanics so markup never pollutes the word list. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/\[\^[^\]]*\]:?/g, ' ') // footnote refs/defs
    .replace(/<[^>]+>/g, ' ') // HTML tags
    .replace(/[#>*_`~]/g, ' ') // heading/emphasis/code marks
}

/**
 * Build a positional inverted index from documents in list order. For each
 * word, per doc it records the doc index, its occurrence count, then every
 * position in the doc's (stopword-removed) token stream — enabling phrase
 * ranking. `lengths` carries per-doc token counts for BM25.
 */
export function buildInvertedIndex<Doc>(
  items: Array<{ doc: Doc; text: string }>,
  locale = 'en',
): SearchIndex<Doc> {
  const docs = items.map((i) => i.doc)
  const words: Record<string, number[]> = {}
  const lengths: number[] = []
  items.forEach((item, idx) => {
    const toks = tokenize(item.text, locale)
    lengths.push(toks.length)
    const positions = new Map<string, number[]>()
    toks.forEach((w, pos) => {
      const arr = positions.get(w)
      if (arr) arr.push(pos)
      else positions.set(w, [pos])
    })
    for (const [w, pos] of positions) (words[w] ??= []).push(idx, pos.length, ...pos)
  })
  return { docs, words, lengths }
}

// ---- query ---------------------------------------------------------------
// BM25 parameters — standard defaults (term saturation / length-normalization).
const BM25_K1 = 1.2
const BM25_B = 0.75

/** Parse a word's flat [docIdx, count, ...positions] runs into
 *  docIdx → its positions in that doc's token stream. */
function positionsByDoc(runs: number[] | undefined): Map<number, number[]> {
  const out = new Map<number, number[]>()
  if (!runs) return out
  for (let i = 0; i < runs.length; ) {
    const doc = runs[i]
    const count = runs[i + 1]
    out.set(doc, runs.slice(i + 2, i + 2 + count))
    i += 2 + count
  }
  return out
}

/** How many times the tokens occur at consecutive positions — token[0] at p,
 *  token[1] at p+1, … (a contiguous phrase). A single token counts every hit. */
function countPhrases(perToken: Array<number[]>): number {
  if (perToken.length === 1) return perToken[0].length
  if (perToken.some((p) => p.length === 0)) return 0
  const later = perToken.slice(1).map((p) => new Set(p))
  let n = 0
  for (const p of perToken[0]) {
    if (later.every((set, k) => set.has(p + k + 1))) n++
  }
  return n
}

/**
 * Query the index: every query word must appear in a doc (AND across words),
 * and the final word also matches by prefix so results stay live while typing.
 * Ranked by exact-PHRASE occurrences first (words appearing consecutively),
 * then by a BM25 relevance score — rare, distinctive words outweigh common
 * ones and the score is length-normalized, so a long doc doesn't out-rank a
 * short precise one merely by repeating the query words.
 */
export function searchIndex<Doc>(
  index: SearchIndex<Doc>,
  query: string,
  locale = 'en',
  limit = 12,
): SearchResult<Doc>[] {
  const tokens = tokenize(query, locale)
  if (tokens.length === 0) return []

  const perToken = tokens.map((token, i) => {
    const exact = positionsByDoc(index.words[token])
    const count = new Map<number, number>()
    for (const [d, pos] of exact) count.set(d, pos.length)
    // Prefix-expand the last (still being typed) token for the loose count.
    if (i === tokens.length - 1 && token.length >= 3) {
      for (const word of Object.keys(index.words)) {
        if (word.length > token.length && word.startsWith(token)) {
          for (const [d, pos] of positionsByDoc(index.words[word])) {
            count.set(d, (count.get(d) ?? 0) + pos.length)
          }
        }
      }
    }
    return { exact, count }
  })

  // BM25 precompute: inverse document frequency per token, average doc length.
  const N = index.docs.length || 1
  const avgdl =
    index.lengths.reduce((a, b) => a + b, 0) / (index.lengths.length || 1) || 1
  const idf = perToken.map(({ count }) => {
    const df = count.size
    return Math.log(1 + (N - df + 0.5) / (df + 0.5))
  })

  const [first, ...rest] = perToken
  const results: Array<SearchResult<Doc> & { score: number }> = []
  for (const [docIdx, firstCount] of first.count) {
    let total = firstCount
    let inAll = true
    for (const pt of rest) {
      const c = pt.count.get(docIdx)
      if (!c) {
        inAll = false
        break
      }
      total += c
    }
    if (!inAll) continue

    const dl = index.lengths[docIdx] ?? avgdl
    let score = 0
    perToken.forEach((pt, i) => {
      const tf = pt.count.get(docIdx) ?? 0
      score +=
        idf[i] *
        ((tf * (BM25_K1 + 1)) /
          (tf + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgdl)))
    })

    const phrase = countPhrases(perToken.map((pt) => pt.exact.get(docIdx) ?? []))
    results.push({ doc: index.docs[docIdx], count: total, phrase, score })
  }

  return results
    .sort((a, b) => b.phrase - a.phrase || b.score - a.score)
    .slice(0, limit)
}

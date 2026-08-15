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
 * noun, stopwords and stray single letters dropped. Used verbatim by both the
 * index generator and the query side, so the two can never disagree.
 * Unicode-aware (\p{L}) so accented / non-Latin glyphs survive.
 *
 * The single-letter cull is Latin-only on purpose: a lone "a"/"s" is noise,
 * but a lone non-Latin letter is a word in its own right (a Hebrew letter, a
 * Greek symbol) and must stay searchable.
 */
export function tokenize(text: string, locale = 'en'): string[] {
  const stopwords = STOPWORDS[locale] ?? STOPWORDS.en
  return (text.toLowerCase().match(/[\p{L}][\p{L}']*/gu) ?? [])
    .map((w) => w.replace(/^'+|'+$/g, '').replace(/'s$/, ''))
    .filter(
      (w) =>
        (w.length > 1 || !/\p{Script=Latin}/u.test(w)) && !stopwords.has(w),
    )
}

/**
 * Character ranges in `text` where one of `tokens` occurs, ascending.
 *
 * The single definition of "this is a hit", so everything that marks matched
 * words for a reader — result titles, snippets, a transcript — points at the
 * same thing the index matched on.
 *
 * A trailing suffix counts, mirroring the query side's prefix expansion:
 * searching "color" marks "colors". The leading boundary is a captured group
 * rather than a lookbehind, which older Safari lacks.
 */
export function matchRanges(
  text: string,
  tokens: string[],
): Array<[number, number]> {
  const escaped = tokens
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escaped.length) return []

  const re = new RegExp(`(^|[^\\p{L}])(${escaped.join('|')})(\\p{L}*)`, 'giu')
  const hits: Array<[number, number]> = []
  for (const m of text.matchAll(re)) {
    const at = (m.index ?? 0) + m[1].length
    hits.push([at, at + m[2].length + m[3].length])
  }
  return hits
}

/** A run of snippet text, flagged when it is one of the matched words. */
export interface SnippetPart {
  text: string
  hit: boolean
}

const MAX_SNIPPET = 190
const LEAD_IN = 60

/**
 * A readable window of `text` around the first matched word, split into runs so
 * the caller can mark the hits. Falls back to the opening of the passage when
 * nothing matches (a prefix-only or stopword-gapped hit).
 */
export function snippetParts(text: string, tokens: string[]): SnippetPart[] {
  const clip = (from: number) => {
    let start = from
    if (start > 0) {
      // Don't start mid-word.
      const space = text.indexOf(' ', start)
      start = space < 0 || space - start > 20 ? start : space + 1
    }
    const end = Math.min(text.length, start + MAX_SNIPPET)
    return { start, end }
  }

  const hits = matchRanges(text, tokens)
  if (!hits.length) {
    const { start, end } = clip(0)
    return [{ text: ellipsize(text, start, end), hit: false }]
  }

  const { start, end } = clip(Math.max(0, hits[0][0] - LEAD_IN))
  const parts: SnippetPart[] = []
  let cursor = start
  for (const [from, to] of hits) {
    if (to <= start || from >= end) continue
    if (from > cursor) parts.push({ text: text.slice(cursor, from), hit: false })
    parts.push({
      text: text.slice(Math.max(from, start), Math.min(to, end)),
      hit: true,
    })
    cursor = Math.min(to, end)
  }
  if (cursor < end) parts.push({ text: text.slice(cursor, end), hit: false })

  if (start > 0 && parts.length) {
    parts[0] = { ...parts[0], text: `…${parts[0].text}` }
  }
  if (end < text.length && parts.length) {
    const last = parts[parts.length - 1]
    parts[parts.length - 1] = { ...last, text: `${last.text}…` }
  }
  return parts
}

/**
 * `text` split into runs with the matched words flagged — the WHOLE string, no
 * windowing. What `snippetParts` does for a long passage this does for a short
 * one (a result title, a heading), where clipping to a 190-character window
 * around the first hit would silently truncate what the reader came to read.
 */
export function highlightParts(text: string, tokens: string[]): SnippetPart[] {
  const hits = matchRanges(text, tokens)
  if (!hits.length) return [{ text, hit: false }]
  const parts: SnippetPart[] = []
  let cursor = 0
  for (const [from, to] of hits) {
    if (from > cursor) parts.push({ text: text.slice(cursor, from), hit: false })
    parts.push({ text: text.slice(from, to), hit: true })
    cursor = to
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })
  return parts
}

function ellipsize(text: string, start: number, end: number): string {
  const head = start > 0 ? '…' : ''
  const tail = end < text.length ? '…' : ''
  return `${head}${text.slice(start, end)}${tail}`
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
  /** Contiguous-phrase occurrences: of the `"quoted"` groups if the query has
   *  any (always > 0 — non-matches are dropped), else of the whole query
   *  (0 = scattered match; = count for a single word). Ranked by this first. */
  phrase: number
  /** Token position of the BEST match in the doc — the first contiguous
   *  occurrence if there is one, else the first occurrence of the rarest query
   *  word. Callers that know how their docs are divided up (paragraphs,
   *  timestamps, pages) can turn this into a deep link. Absent when the doc
   *  matched only by prefix, which has no recorded positions. */
  at?: number
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

/** One run of query words: either a `"quoted"` group or the loose words
 *  around it. A quoted group of 2+ words becomes a hard contiguity filter. */
export interface QuerySegment {
  tokens: string[]
  quoted: boolean
}

// Straight and curly double quotes both count — phones and macOS produce curly
// ones. Apostrophes are NOT delimiters: "Case's" and "don't" are words.
const QUOTED = /["“”]([^"“”]*)["“”]/g

/**
 * Split a query into quoted groups and the loose words around them.
 *   tarot "tree of life"  →  [{tarot, loose}, {tree life, quoted}]
 *
 * An UNTERMINATED trailing quote stays loose on purpose: the phrase filter must
 * not kick in halfway through typing it, or results would vanish until the
 * closing quote lands. They snap to phrase-only the moment the quote closes.
 */
export function parseQuery(query: string, locale = 'en'): QuerySegment[] {
  const segments: QuerySegment[] = []
  const push = (text: string, quoted: boolean) => {
    const tokens = tokenize(text, locale)
    if (tokens.length) segments.push({ tokens, quoted })
  }
  let last = 0
  QUOTED.lastIndex = 0
  for (let m = QUOTED.exec(query); m; m = QUOTED.exec(query)) {
    push(query.slice(last, m.index), false)
    push(m[1], true)
    last = QUOTED.lastIndex
  }
  push(query.slice(last), false)
  return segments
}

/** Position of the FIRST contiguous occurrence of the tokens, or -1. Same walk
 *  as countPhrases, stopping at the first hit. */
function firstPhraseAt(perToken: Array<number[]>): number {
  if (perToken.length === 0) return -1
  if (perToken.length === 1) return perToken[0][0] ?? -1
  if (perToken.some((p) => p.length === 0)) return -1
  const later = perToken.slice(1).map((p) => new Set(p))
  for (const p of perToken[0]) {
    if (later.every((set, k) => set.has(p + k + 1))) return p
  }
  return -1
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
 *
 * `"Quoted groups"` are a HARD filter, not just a ranking nudge: a doc that
 * has all the words but never contiguously is dropped rather than demoted.
 * Quoting also pins the words as typed — no prefix expansion.
 */
export function searchIndex<Doc>(
  index: SearchIndex<Doc>,
  query: string,
  locale = 'en',
  limit = 12,
): SearchResult<Doc>[] {
  const segments = parseQuery(query, locale)
  const tokens = segments.flatMap((s) => s.tokens)
  if (tokens.length === 0) return []

  // Token spans of the quoted groups worth enforcing (a one-word quote pins
  // the spelling but constrains no order), as [start, end) into `tokens`.
  const phraseSpans: Array<[number, number]> = []
  let at = 0
  for (const seg of segments) {
    if (seg.quoted && seg.tokens.length > 1)
      phraseSpans.push([at, at + seg.tokens.length])
    at += seg.tokens.length
  }
  // Prefix-expand the final token only when it is loose — a closed quote means
  // the user finished the word, so honour it exactly.
  const expandLast = !segments[segments.length - 1].quoted

  const perToken = tokens.map((token, i) => {
    const positions = positionsByDoc(index.words[token])
    const count = new Map<number, number>()
    for (const [d, pos] of positions) count.set(d, pos.length)
    // Prefix-expand the last (still being typed) token. The expanded words
    // contribute their POSITIONS as well as their count, so a phrase is found
    // while its final word is still being typed. Counting only was worse than
    // incomplete, it was misleading: "first matte" reported no phrase and fell
    // back to the scattered total — 141, being 71 "first" plus 70 "matter" —
    // then snapped to the phrase count of 53 as the "r" landed.
    if (expandLast && i === tokens.length - 1 && token.length >= 3) {
      for (const word of Object.keys(index.words)) {
        if (word.length > token.length && word.startsWith(token)) {
          for (const [d, pos] of positionsByDoc(index.words[word])) {
            count.set(d, (count.get(d) ?? 0) + pos.length)
            const merged = positions.get(d)
            if (merged) merged.push(...pos)
            else positions.set(d, [...pos])
          }
        }
      }
      // Phrase scanning takes the FIRST hit and `at` the first occurrence, so
      // the merged runs have to be back in document order.
      for (const pos of positions.values()) pos.sort((a, b) => a - b)
    }
    return { positions, count }
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

    // Every quoted group must actually occur contiguously here, or the doc is
    // not a match at all. `phrase` then reports the quoted hits rather than
    // whole-query contiguity, which a mixed query would never satisfy.
    let phrase = 0
    if (phraseSpans.length) {
      let all = true
      for (const [start, end] of phraseSpans) {
        const n = countPhrases(
          perToken.slice(start, end).map((pt) => pt.positions.get(docIdx) ?? []),
        )
        if (n === 0) {
          all = false
          break
        }
        phrase += n
      }
      if (!all) continue
    } else {
      phrase = countPhrases(perToken.map((pt) => pt.positions.get(docIdx) ?? []))
    }

    const dl = index.lengths[docIdx] ?? avgdl
    let score = 0
    perToken.forEach((pt, i) => {
      const tf = pt.count.get(docIdx) ?? 0
      score +=
        idf[i] *
        ((tf * (BM25_K1 + 1)) /
          (tf + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgdl)))
    })

    // Where to send a reader who clicks this result: the first contiguous
    // occurrence — of the first quoted group if there is one, else of the whole
    // query. Failing that (a scattered match), the first occurrence of the
    // rarest query word, since that is the one that makes the passage
    // distinctive rather than the one that appears everywhere.
    const span = phraseSpans[0] ?? [0, perToken.length]
    let at = firstPhraseAt(
      perToken.slice(span[0], span[1]).map((pt) => pt.positions.get(docIdx) ?? []),
    )
    if (at < 0) {
      let rarest = -1
      perToken.forEach((pt, i) => {
        const pos = pt.positions.get(docIdx)
        if (pos?.length && idf[i] > rarest) {
          rarest = idf[i]
          at = pos[0]
        }
      })
    }

    results.push({
      doc: index.docs[docIdx],
      count: total,
      phrase,
      score,
      ...(at >= 0 ? { at } : {}),
    })
  }

  return results
    .sort((a, b) => b.phrase - a.phrase || b.score - a.score)
    .slice(0, limit)
}

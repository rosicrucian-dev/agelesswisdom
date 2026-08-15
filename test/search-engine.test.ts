// Tests for the shared search engine.
//
//   npm test
//
// ⚠ KEEP BYTE-IDENTICAL with the sibling project, like search-engine.ts —
//   FIX BOTH when you change it:
//     botatoolbox:   test/search-engine.test.ts
//     agelesswisdom: test/search-engine.test.ts
//
// The engine is hand-rolled (positional index, phrase counting, BM25) and lives
// in two repos that must not drift, so its invariants are pinned here rather
// than left to the comments. Node's built-in runner, no dependencies.
//
// What's deliberately locked below, because breaking any of it is silent:
//   - the tokenizer is used by BOTH the generator and the query side, so a
//     change to stopwords or folding changes what is findable at all;
//   - stopwords are dropped on both sides, which is what lets a quoted
//     "tree of life" match text where "of" was never indexed;
//   - prefix expansion applies to the last LOOSE word only, so a closed quote
//     pins the spelling;
//   - a quoted group is a hard filter, not a ranking nudge;
//   - `at` points at the first contiguous hit, else the rarest word — it is
//     what a deep link is built from.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildInvertedIndex,
  highlightParts,
  matchRanges,
  parseQuery,
  searchIndex,
  snippetParts,
  stripMarkdown,
  tokenize,
} from '../src/lib/search-engine.ts'

// ---- fixture --------------------------------------------------------------
// Three short docs whose token streams are small enough to reason about by
// hand. Stopwords are dropped at index time, so the streams are:
//   a: tree life symbol
//   b: life power flows through tree
//   c: tree life tree knowledge
const CORPUS = [
  { doc: 'a', text: 'the tree of life is a symbol' },
  { doc: 'b', text: 'life power flows through the tree' },
  { doc: 'c', text: 'the tree of life and the tree of knowledge' },
]
const index = buildInvertedIndex(CORPUS, 'en')

const docsOf = (results: Array<{ doc: string }>) => results.map((r) => r.doc)

// ---- tokenize -------------------------------------------------------------

test('tokenize lowercases, drops stopwords, folds possessives', () => {
  assert.deepEqual(tokenize("The Life-Power's light", 'en'), [
    'life',
    'power',
    'light',
  ])
})

test('tokenize keeps lone non-Latin letters but culls lone Latin ones', () => {
  // A Hebrew or Greek letter is a word in its own right in this material; a
  // stray "a"/"s" left over from folding is noise.
  assert.deepEqual(tokenize('א ב a s', 'en'), ['א', 'ב'])
})

test('tokenize applies the locale stopword list, not a universal one', () => {
  // The reason SearchIndex carries a `locale`: indexing German text with the
  // English list leaves "der"/"des" in, and then they match everything.
  assert.deepEqual(tokenize('Der Baum des Lebens', 'de'), ['baum', 'lebens'])
  assert.deepEqual(tokenize('Der Baum des Lebens', 'en'), [
    'der',
    'baum',
    'des',
    'lebens',
  ])
})

test('tokenize falls back to English for an unknown locale', () => {
  assert.deepEqual(tokenize('the tree', 'xx'), ['tree'])
})

// ---- matchRanges ----------------------------------------------------------

test('matchRanges spans the whole word, suffix included', () => {
  // Mirrors the query side's prefix expansion: searching "color" marks
  // "colors" and "coloring", so the page agrees with the index.
  assert.deepEqual(matchRanges('colors and coloring', ['color']), [
    [0, 6],
    [11, 19],
  ])
})

test('matchRanges will not match inside a word', () => {
  assert.deepEqual(matchRanges('recolor', ['color']), [])
})

test('matchRanges is empty for no tokens', () => {
  assert.deepEqual(matchRanges('anything at all', []), [])
})

// ---- snippetParts / highlightParts ---------------------------------------

test('snippetParts splits a passage into marked and unmarked runs', () => {
  assert.deepEqual(snippetParts('the tree of life', ['tree']), [
    { text: 'the ', hit: false },
    { text: 'tree', hit: true },
    { text: ' of life', hit: false },
  ])
})

test('snippetParts falls back to the opening when nothing matches', () => {
  assert.deepEqual(snippetParts('short text', ['zzz']), [
    { text: 'short text', hit: false },
  ])
})

test('snippetParts windows around the first hit without cutting a word', () => {
  const text = 'alpha '.repeat(30) + 'target ' + 'omega '.repeat(30)
  const parts = snippetParts(text, ['target'])
  const joined = parts.map((p) => p.text).join('')

  assert.ok(joined.startsWith('…alpha'), 'leads with an ellipsis, mid-word')
  assert.ok(joined.endsWith('…'), 'trails off rather than running to the end')
  assert.deepEqual(
    parts.filter((p) => p.hit).map((p) => p.text),
    ['target'],
  )
  // MAX_SNIPPET (190) plus the two ellipses.
  assert.ok(joined.length <= 192, `snippet was ${joined.length} chars`)
})

test('highlightParts marks the whole string, with no windowing', () => {
  // The difference from snippetParts: a title must never be clipped.
  const long = 'Lesson 1 - ' + 'The Life Power '.repeat(30)
  const parts = highlightParts(long, ['life'])
  assert.equal(parts.map((p) => p.text).join(''), long)
  assert.equal(parts.filter((p) => p.hit).length, 30)
})

test('highlightParts returns one unmarked run when nothing matches', () => {
  assert.deepEqual(highlightParts('The Life Power', ['zzz']), [
    { text: 'The Life Power', hit: false },
  ])
})

// ---- parseQuery -----------------------------------------------------------

test('parseQuery separates quoted groups from the loose words around them', () => {
  assert.deepEqual(parseQuery('tarot "tree of life"', 'en'), [
    { tokens: ['tarot'], quoted: false },
    { tokens: ['tree', 'life'], quoted: true },
  ])
})

test('parseQuery accepts curly quotes', () => {
  assert.deepEqual(parseQuery('“tree of life”', 'en'), [
    { tokens: ['tree', 'life'], quoted: true },
  ])
})

test('parseQuery leaves an unterminated quote loose', () => {
  // Otherwise the phrase filter would engage halfway through typing it and
  // results would vanish until the closing quote landed.
  assert.deepEqual(parseQuery('tarot "tree of', 'en'), [
    { tokens: ['tarot', 'tree'], quoted: false },
  ])
})

test('parseQuery does not treat apostrophes as delimiters', () => {
  assert.deepEqual(parseQuery("case's tarot", 'en'), [
    { tokens: ['case', 'tarot'], quoted: false },
  ])
})

// ---- buildInvertedIndex ---------------------------------------------------

test('buildInvertedIndex records docIdx, count and every position', () => {
  // Flat runs of [docIdx, count, ...positions]; the parse on the query side
  // depends on this shape exactly.
  assert.deepEqual(index.words.tree, [0, 1, 0, 1, 1, 4, 2, 2, 0, 2])
  assert.deepEqual(index.lengths, [3, 5, 4])
  assert.deepEqual(index.docs, ['a', 'b', 'c'])
})

// ---- searchIndex ----------------------------------------------------------

test('every query word must appear (AND, not OR)', () => {
  assert.deepEqual(docsOf(searchIndex(index, 'tree knowledge', 'en')), ['c'])
  assert.deepEqual(docsOf(searchIndex(index, 'tree nonesuch', 'en')), [])
})

test('contiguous matches outrank scattered ones', () => {
  // a and c have "tree life" adjacent; b has both words far apart.
  const results = searchIndex(index, 'tree life', 'en')
  assert.equal(results.length, 3)
  assert.equal(results[2].doc, 'b')
  assert.equal(results[2].phrase, 0)
  assert.ok(results.slice(0, 2).every((r) => r.phrase === 1))
})

test('a quoted group drops docs that lack the phrase, rather than demoting them', () => {
  // b has both words and is still not a result.
  assert.deepEqual(
    docsOf(searchIndex(index, '"tree of life"', 'en')).sort(),
    ['a', 'c'],
  )
})

test('stopwords are dropped on both sides, so a phrase survives them', () => {
  // "of" is never indexed, so "tree of life" can only match if the query side
  // drops it too. This is why one tokenizer serves both.
  assert.ok(searchIndex(index, '"tree of life"', 'en').length > 0)
})

test('the final loose word matches by prefix, so results stay live while typing', () => {
  const results = searchIndex(index, 'kno', 'en')
  assert.deepEqual(docsOf(results), ['c'])
  // The expansion contributes positions, not just a count — otherwise `at`
  // and the phrase count would be wrong mid-word.
  assert.equal(results[0].at, 3)
  assert.equal(results[0].phrase, 1)
})

test('prefix expansion needs three characters', () => {
  assert.deepEqual(docsOf(searchIndex(index, 'kn', 'en')), [])
})

test('quoting pins the spelling — no prefix expansion', () => {
  assert.deepEqual(docsOf(searchIndex(index, '"knowledg"', 'en')), [])
  assert.deepEqual(docsOf(searchIndex(index, 'knowledg', 'en')), ['c'])
})

test('phrase count ranks repeated occurrences first', () => {
  // c has "tree" twice.
  const results = searchIndex(index, 'tree', 'en')
  assert.equal(results[0].doc, 'c')
  assert.equal(results[0].phrase, 2)
  assert.equal(results[0].count, 2)
})

test('`at` is the first contiguous occurrence when there is one', () => {
  const [a] = searchIndex(index, 'tree life', 'en').filter((r) => r.doc === 'a')
  assert.equal(a.at, 0)
})

test('`at` falls back to the rarest word when the match is scattered', () => {
  // In b the words never adjoin; `at` should land on a query word's position
  // (4 = "tree"), not stay undefined.
  const [b] = searchIndex(index, 'tree life', 'en').filter((r) => r.doc === 'b')
  assert.equal(b.phrase, 0)
  assert.equal(b.at, 4)
})

test('a rarer word pulls its doc up the ranking', () => {
  // "knowledge" appears in one doc, "tree" in all three; BM25's idf term is
  // what makes the distinctive word decide the order.
  const results = searchIndex(index, 'life knowledge', 'en')
  assert.deepEqual(docsOf(results), ['c'])
})

test('limit truncates after ranking, not before', () => {
  assert.equal(searchIndex(index, 'tree', 'en', 1).length, 1)
  assert.equal(searchIndex(index, 'tree', 'en', 1)[0].doc, 'c')
})

test('an empty or stopword-only query returns nothing', () => {
  assert.deepEqual(searchIndex(index, '', 'en'), [])
  assert.deepEqual(searchIndex(index, 'the of and', 'en'), [])
})

// ---- stripMarkdown --------------------------------------------------------

test('stripMarkdown removes mechanics but keeps prose', () => {
  const out = stripMarkdown(
    '![a picture](img.png) see [the tree](/tree) # Heading **bold**[^1]',
  )
  assert.ok(out.includes('the tree'))
  assert.ok(out.includes('Heading'))
  assert.ok(out.includes('bold'))
  assert.ok(!out.includes('img.png'))
  assert.ok(!out.includes('/tree'))
  assert.ok(!out.includes('[^1]'))
})

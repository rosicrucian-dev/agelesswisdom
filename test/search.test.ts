// Tests for agelesswisdom's search adapter — the project-local half that turns
// an engine result into a link to a passage.
//
//   npm test
//
// The engine itself is covered by search-engine.test.ts, which is shared with
// botatoolbox. What's here is not: the block-span mapping exists because a
// lesson result deep-links to a paragraph anchor, and the title boost exists
// because BM25 is wrong about names.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildInvertedIndex } from '../src/lib/search-engine.ts'
import {
  resultBlock,
  resultHref,
  searchLessons,
  snippetUrl,
  type SearchIndex,
  type SearchLesson,
} from '../src/lib/search.ts'

// A lesson with three anchored blocks. `blocks` holds the token offset each
// span STARTS at; the title's tokens sit below the first span on purpose.
const LESSON: SearchLesson = {
  href: '/section-a/the-life-power',
  title: 'Lesson 1 - The Life Power',
  section: 'Section A',
  blocks: [4, 27, 106],
  anchors: ['p1', 'p2', 'p5'],
}

// ---- resultBlock ----------------------------------------------------------

test('resultBlock finds the span containing a position', () => {
  assert.equal(resultBlock(LESSON, 4), 0)
  assert.equal(resultBlock(LESSON, 26), 0)
  assert.equal(resultBlock(LESSON, 27), 1)
  assert.equal(resultBlock(LESSON, 105), 1)
  assert.equal(resultBlock(LESSON, 106), 2)
  assert.equal(resultBlock(LESSON, 9999), 2)
})

test('resultBlock reports -1 for a title hit', () => {
  // Titles sit below the first span, so a title match belongs to the lesson as
  // a whole rather than to a paragraph that need not contain the words.
  assert.equal(resultBlock(LESSON, 0), -1)
  assert.equal(resultBlock(LESSON, 3), -1)
})

test('resultBlock tolerates a missing position or a doc with no blocks', () => {
  assert.equal(resultBlock(LESSON, undefined), -1)
  assert.equal(resultBlock({ ...LESSON, blocks: [], anchors: [] }, 5), -1)
})

// ---- resultHref -----------------------------------------------------------

test('resultHref deep-links to the anchor of the matched block', () => {
  assert.equal(resultHref(LESSON, 30), '/section-a/the-life-power#p2')
  // The anchor is read from the parallel array, NOT derived from the index —
  // unanchored blocks (headings, JSX) make the numbering non-sequential.
  assert.equal(resultHref(LESSON, 110), '/section-a/the-life-power#p5')
})

test('resultHref falls back to the plain lesson URL for a title hit', () => {
  assert.equal(resultHref(LESSON, 1), '/section-a/the-life-power')
  assert.equal(resultHref(LESSON, undefined), '/section-a/the-life-power')
})

// ---- snippetUrl -----------------------------------------------------------

test('snippetUrl carries the index version so a deploy invalidates the cache', () => {
  assert.equal(
    snippetUrl('en', LESSON, 'abc123'),
    '/search/en/section-a/the-life-power.json?v=abc123',
  )
  // Without a stamp the URL still resolves — the sidecar is just cacheable.
  assert.equal(
    snippetUrl('de', LESSON),
    '/search/de/section-a/the-life-power.json',
  )
})

// ---- searchLessons --------------------------------------------------------

const lesson = (id: string, title: string): SearchLesson => ({
  href: `/section-a/${id}`,
  title,
  section: 'Section A',
  blocks: [0],
  anchors: ['p1'],
})

// "life" and "power" run through all of this material, so BM25 alone ranked
// the lesson actually CALLED "The Life Power" below lessons that merely say
// the words a lot. That is what the title boost corrects.
const LESSONS = [
  {
    doc: lesson('filler-one', 'Lesson 1 - Interpretation'),
    text: 'life power life power life power life power life power',
  },
  {
    doc: lesson('the-life-power', 'Lesson 2 - The Life Power'),
    text: 'this lesson opens with a single mention of the life power',
  },
  {
    doc: lesson('filler-two', 'Lesson 3 - The Sun'),
    text: 'life power appears here as well, life power again',
  },
]
const lessonIndex: SearchIndex = {
  ...buildInvertedIndex(LESSONS, 'en'),
  locale: 'en',
  version: 'test',
}

test('a title match floats to the front of its group', () => {
  const results = searchLessons(lessonIndex, 'life power', 'en')
  assert.equal(results[0].doc.title, 'Lesson 2 - The Life Power')
})

test('the boost only reorders within a match TYPE, never across it', () => {
  // Every doc here has the phrase, so the title wins. Make one scattered and
  // it must stay behind the contiguous matches despite its title.
  const scattered = {
    doc: lesson('life-and-power', 'Lesson 4 - Life Power'),
    text: 'life is one thing and power is quite another thing entirely',
  }
  const index: SearchIndex = {
    ...buildInvertedIndex([LESSONS[0], scattered], 'en'),
    locale: 'en',
  }
  const results = searchLessons(index, 'life power', 'en')
  assert.equal(results[0].doc.title, 'Lesson 1 - Interpretation')
  assert.equal(results[1].doc.title, 'Lesson 4 - Life Power')
})

test('searchLessons returns every match, not a page of them', () => {
  // The dialog lists them all and pays only for the snippets of the first few.
  assert.equal(searchLessons(lessonIndex, 'life power', 'en').length, 3)
})

test('a title match still needs the words to be in the lesson at all', () => {
  assert.deepEqual(searchLessons(lessonIndex, 'nonesuch', 'en'), [])
})

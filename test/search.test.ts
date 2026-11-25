// Tests for agelesswisdom's search adapter — the project-local half that turns
// an engine result into a link to a passage.
//
//   npm test
//
// The engine itself is covered by @rosicrucian/search's own tests. What's here
// is project-local: where a result sends the reader, and the URLs of a locale's
// index and section texts.

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildIndex, search, type SearchDocument } from "@rosicrucian/search";
import {
  resultHref,
  searchIndexUrl,
  snippetUrl,
  type LessonMeta,
  type LessonResult,
} from "../src/lib/search.ts";

const LESSON: SearchDocument<LessonMeta> = {
  id: "/section-a/the-life-power",
  title: "Lesson 1 - The Life Power",
  meta: { href: "/section-a/the-life-power", section: "Section A" },
  sections: [
    // A heading has no anchor of its own; the generator gives it the next
    // paragraph's, so a heading hit links to the passage beneath it.
    { text: "The One Force", anchor: "p1" },
    { text: "There is one force, and it is the life power.", anchor: "p1" },
    { text: "That force is conscious and creative.", anchor: "p2" },
  ],
};

const index = buildIndex([LESSON], { tokenizer: { locale: "en" } }).index;

// ---- resultHref -----------------------------------------------------------

test("resultHref deep-links to the anchor of the matched passage", () => {
  const [result] = search(index, "conscious");
  assert.equal(resultHref(result), "/section-a/the-life-power#p2");
});

test("a heading hit links to the passage beneath the heading", () => {
  const [result] = search(index, "one force");
  // The phrase is first found in the heading section, which carries p1.
  assert.equal(result.best.section, 0);
  assert.equal(resultHref(result), "/section-a/the-life-power#p1");
});

test("a title hit links to the lesson itself", () => {
  const [result] = search(index, "lesson 1");
  assert.equal(result.best.where, "title");
  assert.equal(resultHref(result), "/section-a/the-life-power");
});

test("a body hit in a section with no anchor links to the lesson itself", () => {
  const plain = buildIndex(
    [{ ...LESSON, sections: [{ text: "no anchors here" }] }],
    { tokenizer: { locale: "en" } },
  ).index;
  const [result] = search(plain, "anchors");
  assert.equal(result.best.where, "body");
  assert.equal(resultHref(result), "/section-a/the-life-power");
});

test("resultHref falls back to the id when meta is absent", () => {
  const result: LessonResult = {
    docIndex: 0,
    id: "/x",
    title: "X",
    score: 1,
    count: 1,
    phrase: 1,
    best: { where: "body", position: 0, section: 0, anchor: "p3" },
  };
  assert.equal(resultHref(result), "/x#p3");
});

// ---- URLs -----------------------------------------------------------------

test("snippetUrl is per locale and carries the index stamp", () => {
  assert.equal(
    snippetUrl("en", LESSON.id, "abc123"),
    "/search/en/section-a/the-life-power.json?v=abc123",
  );
  assert.equal(
    snippetUrl("de", LESSON.id),
    "/search/de/section-a/the-life-power.json",
  );
});

test("searchIndexUrl is per locale", () => {
  assert.equal(searchIndexUrl("en"), "/search-index.en.json");
  assert.equal(searchIndexUrl("de"), "/search-index.de.json");
});

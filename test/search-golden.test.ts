// Golden rankings for the lesson search — a project-local characterization
// test, not a contract.
//
//   npm test                      compares against test/fixtures/search-golden.json
//   UPDATE_GOLDEN=1 npm test      rewrites the fixture from the current engine
//
// It runs real queries against the built English index in public/ and pins the
// top ten results with their phrase and mention counts. The point is to make a
// ranking change visible as a diff that can be reviewed, when the engine is
// changed on purpose (see ../botatoolbox/docs/search-engine-redesign.md) — not
// to forbid change. When the fixture moves, read the diff, decide whether every
// move is an improvement, and then regenerate it.
//
// The index is a gitignored build artifact (`npm run gen:search`), so a fresh
// clone has none; the test skips in that case rather than failing.

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { loadIndex, search } from "@rosicrucian/search";
import type { LessonIndex, LessonMeta } from "../src/lib/search.ts";

const ROOT = join(import.meta.dirname, "..");
const INDEX = join(ROOT, "public/search-index.en.json");
const FIXTURE = join(ROOT, "test/fixtures/search-golden.json");
const TOP = 10;

// Chosen to exercise what the redesign is expected to change: a lesson's own
// name loose and quoted (the title boost), plain words, numbers, a prefix, a
// spelling variant, British and American spellings, a lone Hebrew letter, and
// a stopword on its own.
const QUERIES = [
  "the life power",
  '"the life power"',
  "tree of life",
  "tarot",
  "key 0",
  "lesson 12",
  "subconsciousness",
  "Tiphareth",
  "tiferet",
  "color",
  "colours",
  "occult",
  '"first matter"',
  "ב",
  "and",
];

interface GoldenRow {
  id: string;
  phrase: number;
  count: number;
}
type Golden = Record<string, GoldenRow[]>;

function run(index: LessonIndex): Golden {
  const out: Golden = {};
  for (const query of QUERIES) {
    out[query] = search(index, query)
      .slice(0, TOP)
      .map((r) => ({ id: r.id, phrase: r.phrase, count: r.count }));
  }
  return out;
}

test(
  "lesson search rankings match the golden fixture",
  { skip: existsSync(INDEX) ? false : `no built index at ${INDEX}` },
  () => {
    const index = loadIndex<LessonMeta>(
      JSON.parse(readFileSync(INDEX, "utf8")),
    );
    const actual = run(index);

    if (process.env.UPDATE_GOLDEN) {
      writeFileSync(FIXTURE, JSON.stringify(actual, null, 2) + "\n");
      return;
    }

    assert.ok(
      existsSync(FIXTURE),
      `no fixture at ${FIXTURE} — run UPDATE_GOLDEN=1 npm test once`,
    );
    const expected: Golden = JSON.parse(readFileSync(FIXTURE, "utf8"));
    for (const query of QUERIES) {
      assert.deepEqual(
        actual[query],
        expected[query],
        `ranking changed for ${JSON.stringify(query)} — review, then UPDATE_GOLDEN=1 npm test`,
      );
    }
  },
);

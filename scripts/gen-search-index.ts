/**
 * Build the full-text search index the search dialog queries.
 *
 * Reads every lesson MDX (via the curriculum, so ordering/titles/paths can
 * never drift from the site) and builds a positional inverted index with the
 * shared buildInvertedIndex from src/lib/search-engine — one file per locale.
 *
 * ## Why this runs the real MDX pipeline
 *
 * Results deep-link to a paragraph (`/section-a/the-life-power/#p12`), using
 * the anchor ids that plugins/rehype-lesson-anchors.mjs assigns during the MDX
 * compile. Those ids are positional, so the index has to agree with the site
 * about which block is which — exactly.
 *
 * The way to guarantee that is to JOIN the site's own pipeline rather than
 * imitate it: build the processor from the shared mdx.config.mjs, run the real
 * anchor plugin, and append a collector that reads the ids back off the tree.
 * Then the numbering is identical by construction. (Measured: a hand-assembled
 * remark pipeline mis-parsed `<Cite>` as a paragraph and shifted every anchor
 * after it in 8 of 114 lessons. This approach matches the built HTML on all
 * 114.)
 *
 * Indexing the pipeline's own block text also means the index holds exactly
 * what the reader sees — post-smartypants, markup already gone — so no
 * markdown-stripping heuristics are needed.
 *
 * Runs as `prebuild`, so every build ships an index generated from the same
 * lesson text it renders. Run manually with `npm run gen:search`.
 */

import { createProcessor } from "@mdx-js/mdx";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VFile } from "vfile";

import {
  loadMdxPlugins,
  rehypePlugins as rehypeSpecs,
  remarkPlugins as remarkSpecs,
} from "../mdx.config.mjs";
import {
  getSections,
  lessonFileName,
  lessonUrl,
  numberedLessonTitle,
  sectionDirName,
} from "../src/data/curriculum.ts";
import { DEFAULT_LOCALE, LOCALES } from "../src/lib/locales.ts";
import { buildInvertedIndex, tokenize } from "../src/lib/search-engine.ts";
import type { SearchLesson } from "../src/lib/search.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- the pipeline ---------------------------------------------------------

/** One top-level block of a lesson, in document order. `anchor` is the id the
 *  anchor plugin gave it (`p1`, `p2`, …) or null for the blocks it skips by
 *  contract — headings, footnote sections and JSX. Their text is still indexed;
 *  it just attaches to the next anchored block (see `blockStarts`). */
type Block = { anchor: string | null; text: string };

/** Collected per compile, then drained. A module-level sink is the simplest
 *  way for a unified plugin to hand data back to its caller. */
let sink: Block[] = [];

/** Plain text of a hast/mdast subtree. `raw` nodes are passthrough HTML with
 *  no text of their own; the anchor plugin's pilcrow marker is stripped so it
 *  never lands in the index. */
function textOf(node: any): string {
  if (node.type === "text") return String(node.value ?? "");
  if (node.type === "raw") return "";
  if (!node.children) return "";
  return node.children.map(textOf).join("");
}

/** Reads back what the anchor plugin just did. Must run AFTER it. */
function rehypeCollectBlocks() {
  return (tree: any) => {
    for (const node of tree.children ?? []) {
      const text = textOf(node).replace(/¶/g, "").trim();
      if (!text) continue;
      const id = node.type === "element" ? node.properties?.id : undefined;
      sink.push({ anchor: id ? String(id) : null, text });
    }
  };
}

const processor = createProcessor({
  remarkPlugins: await loadMdxPlugins(remarkSpecs),
  rehypePlugins: [...(await loadMdxPlugins(rehypeSpecs)), rehypeCollectBlocks],
});

/** Compile one lesson and return its blocks in document order. */
async function blocksOf(file: string, raw: string): Promise<Block[]> {
  sink = [];
  const vfile = new VFile({ value: raw, path: file });
  // The cast is a typing artifact, not a runtime one: @mdx-js/mdx types `run`
  // as taking the estree Program its recma stages end at, but the transform
  // chain starts from the mdast Root that `parse` returns — which is what it
  // actually wants here. Our collector reads the tree mid-chain, at the rehype
  // stage, before any of that.
  await processor.run(processor.parse(vfile) as never, vfile);
  return sink;
}

/**
 * Token offset at which each ANCHORED block's span begins, aligned with the
 * order of `anchors`. A span starts where the previous anchored block ended, so
 * the heading (or JSX apparatus) introducing a paragraph counts as part of it —
 * a hit in a heading should link to the passage under it, not to the tail of
 * the section before.
 *
 * The lesson title is deliberately left OUTSIDE every span. It is prepended to
 * the text so that searching a lesson's name finds it, but a title hit is a hit
 * on the lesson as a whole — deep-linking it to the first paragraph would drop
 * the reader at a passage that need not contain the words at all. Positions
 * below the first span resolve to the plain lesson URL.
 */
function blockStarts(title: string, blocks: Block[], locale: string) {
  const starts: number[] = [];
  const anchors: string[] = [];
  let at = tokenize(title, locale).length;
  let spanStart = at;
  for (const block of blocks) {
    at += tokenize(block.text, locale).length;
    if (block.anchor) {
      starts.push(spanStart);
      anchors.push(block.anchor);
      spanStart = at;
    }
  }
  return { starts, anchors };
}

// ---- build ----------------------------------------------------------------

// One index per locale. Titles/labels come from the localized curriculum;
// lesson text comes from the locale's MDX when it exists, else the English
// transcript (mirroring exactly what the lesson page serves in that locale).
for (const locale of LOCALES) {
  const items: Array<{ doc: SearchLesson; text: string }> = [];
  // How many lessons this locale still serves as untranslated English — either
  // no file of its own, or a gen:translations skeleton still byte-identical to
  // the English master. Decides which stopword list to tokenize with (below).
  let englishText = 0;
  const pending: Array<{ title: string; blocks: Block[] }> = [];

  for (const section of getSections(locale)) {
    for (const lesson of section.lessons) {
      const relFile = path.join(
        sectionDirName(section),
        `${lessonFileName(section, lesson)}.mdx`,
      );
      const enFile = path.join(
        ROOT,
        "content",
        "lessons",
        DEFAULT_LOCALE,
        relFile,
      );
      let file = path.join(ROOT, "content", "lessons", locale, relFile);
      if (!fs.existsSync(file)) file = enFile;

      const raw = fs.readFileSync(file, "utf8");
      if (
        locale === DEFAULT_LOCALE ||
        file === enFile ||
        raw === fs.readFileSync(enFile, "utf8")
      ) {
        englishText++;
      }

      const title = numberedLessonTitle(section, lesson);
      const blocks = await blocksOf(file, raw);
      pending.push({ title, blocks });
      items.push({
        doc: {
          href: lessonUrl(section, lesson),
          title,
          section: section.label,
          // Filled in below, once the tokenizer locale is known.
          blocks: [],
          anchors: [],
        },
        // Index the title too, so "Tree of Life" matches the titled lesson.
        text: [title, ...blocks.map((b) => b.text)].join(" "),
      });
    }
  }

  // Tokenize with the stopword list of the language actually in the text, not
  // the language of the URL. A dark-launched locale whose lessons are still
  // English skeletons would otherwise be indexed with its own stopword list,
  // leaving every English stopword ("the", "of", "and") in the index — bloating
  // it and letting junk queries match every lesson. Majority vote, so the index
  // flips to the locale's own tokenizer as soon as it is really translated.
  const mostlyEnglish = englishText * 2 > items.length;
  const indexLocale = mostlyEnglish ? DEFAULT_LOCALE : locale;

  // Block spans depend on the tokenizer, so they are computed once it is known.
  let anchored = 0;
  let sidecarBytes = 0;
  // Content hash of every sidecar in this locale, which becomes the `?v=` on
  // their URLs. The sidecars sit at stable paths, so without it a reader's
  // service worker could serve last deploy's passage text forever (they are
  // cached hard precisely because they never change WITHIN a deploy). Changing
  // any lesson changes the stamp, which changes every sidecar URL, which is a
  // cache miss — so a deploy invalidates exactly what it should.
  const version = createHash("sha256");
  items.forEach((item, i) => {
    const { starts, anchors } = blockStarts(
      pending[i].title,
      pending[i].blocks,
      indexLocale,
    );
    item.doc.blocks = starts;
    item.doc.anchors = anchors;
    anchored += anchors.length;

    // Snippet sidecar: the text of each anchored block, parallel to `anchors`.
    // Kept OUT of the index — the full block text is the whole corpus (~2.4 MB
    // for English), which would triple a payload every reader downloads to
    // search at all. The dialog fetches only the lessons it is showing.
    const text = pending[i].blocks
      .filter((b) => b.anchor)
      .map((b) => b.text.replace(/\s+/g, " ").trim());
    const sidecar = path.join(
      ROOT,
      "public",
      "search",
      locale,
      `${item.doc.href.replace(/^\//, "")}.json`,
    );
    fs.mkdirSync(path.dirname(sidecar), { recursive: true });
    const json = JSON.stringify(text);
    fs.writeFileSync(sidecar, json);
    sidecarBytes += Buffer.byteLength(json);
    version.update(json);
  });

  const index = {
    ...buildInvertedIndex(items, indexLocale),
    locale: indexLocale,
    // Rides in the index because the dialog already has the index in hand when
    // it builds a sidecar URL — no second manifest to fetch, and no generated
    // module for the app build to depend on.
    version: version.digest("hex").slice(0, 12),
  };
  const out = path.join(ROOT, "public", `search-index.${locale}.json`);
  fs.writeFileSync(out, JSON.stringify(index));

  const bytes = fs.statSync(out).size;
  const note =
    indexLocale === locale
      ? ""
      : ` — tokenized as '${indexLocale}' (${englishText}/${items.length} lessons untranslated)`;
  console.log(
    `search index (${locale}): ${index.docs.length} lessons, ` +
      `${Object.keys(index.words).length} words, ${anchored} anchors, ` +
      `${(bytes / 1024).toFixed(0)} KB -> ${path.relative(ROOT, out)}${note}\n` +
      `  snippets (${locale}): ${items.length} sidecars, ` +
      `${(sidecarBytes / 1024).toFixed(0)} KB total, ` +
      `${(sidecarBytes / 1024 / (items.length || 1)).toFixed(0)} KB average ` +
      `-> public/search/${locale}/`,
  );
}

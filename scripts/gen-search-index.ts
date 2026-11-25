/**
 * Build the full-text search index the search dialog queries, and the
 * section-text files beside it — one index and one set of files per locale.
 *
 * A lesson is one document: its numbered title, and its top-level blocks as
 * the sections, each carrying the anchor id the MDX pipeline gave it
 * (`p1`, `p2`, …) so a result deep-links to the passage. Built with
 * @rosicrucian/search's buildIndex, which records how it tokenized so the
 * dialog can never query differently.
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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VFile } from "vfile";

import {
  buildIndex,
  loadIndex,
  type SearchDocument,
} from "@rosicrucian/search";
import {
  loadMdxPlugins,
  rehypePlugins as rehypeSpecs,
  remarkPlugins as remarkSpecs,
} from "../mdx.config.mjs";
import {
  getSections,
  lessonSourceFile,
  lessonUrl,
  numberedLessonTitle,
} from "../src/data/curriculum.ts";
import { DEFAULT_LOCALE, LOCALES } from "../src/lib/locales.ts";
import type { LessonMeta } from "../src/lib/search.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- the pipeline ---------------------------------------------------------

/** One top-level block of a lesson, in document order. `anchor` is the id the
 *  anchor plugin gave it (`p1`, `p2`, …) or null for the blocks it skips by
 *  contract — headings, footnote sections and JSX. */
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
 * Blocks → sections. An anchored block keeps its anchor. An UNANCHORED block
 * (a heading, the footnotes, JSX apparatus) takes the anchor of the NEXT
 * anchored block — the trailing ones, the last — so a hit in a heading
 * excerpts the heading with its words marked and links to the passage beneath
 * it, which is what the reader came for. (Before this, a heading hit linked
 * the same way but excerpted an unmarked paragraph.)
 *
 * The lesson title is NOT a section: the engine indexes it as the title
 * stream, boosted, and a title hit links to the lesson top rather than to a
 * first paragraph that need not contain the words.
 */
function toSections(blocks: Block[]): Array<{ text: string; anchor?: string }> {
  let next = [...blocks].reverse().find((b) => b.anchor)?.anchor ?? undefined;
  const out: Array<{ text: string; anchor?: string }> = new Array(
    blocks.length,
  );
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.anchor) next = block.anchor;
    out[i] = next ? { text: block.text, anchor: next } : { text: block.text };
  }
  return out;
}

// ---- build ----------------------------------------------------------------

// One index per locale. Titles/labels come from the localized curriculum;
// lesson text comes from the locale's MDX when it exists, else the English
// transcript (mirroring exactly what the lesson page serves in that locale).
for (const locale of LOCALES) {
  const docs: SearchDocument<LessonMeta>[] = [];
  // How many lessons this locale still serves as untranslated English — either
  // no file of its own, or a gen:translations skeleton still byte-identical to
  // the English master. Decides which stopword list to tokenize with (below).
  let englishText = 0;

  for (const section of getSections(locale)) {
    for (const lesson of section.lessons) {
      // The lesson's file (src/data/curriculum.ts: this site's transcript,
      // or the books repository's text), English where the locale has none
      // of its own.
      const enFile = lessonSourceFile(DEFAULT_LOCALE, section.id, lesson.id);
      let file = lessonSourceFile(locale, section.id, lesson.id);
      if (!fs.existsSync(file)) file = enFile;

      const raw = fs.readFileSync(file, "utf8");
      if (
        locale === DEFAULT_LOCALE ||
        file === enFile ||
        raw === fs.readFileSync(enFile, "utf8")
      ) {
        englishText++;
      }

      const href = lessonUrl(section, lesson);
      docs.push({
        id: href,
        title: numberedLessonTitle(section, lesson),
        meta: { href, section: section.label },
        sections: toSections(await blocksOf(file, raw)),
      });
    }
  }

  // Tokenize with the stopword list of the language actually in the text, not
  // the language of the URL. A dark-launched locale whose lessons are still
  // English skeletons would otherwise be indexed with its own stopword list,
  // leaving every English stopword ("the", "of", "and") in the index — bloating
  // it and letting junk queries match every lesson. Majority vote, so the index
  // flips to the locale's own tokenizer as soon as it is really translated.
  // The index records the choice in its header; the dialog reads it from there.
  const mostlyEnglish = englishText * 2 > docs.length;
  const indexLocale = mostlyEnglish ? DEFAULT_LOCALE : locale;

  const { index, sections } = buildIndex(docs, {
    tokenizer: { locale: indexLocale },
  });

  // Section texts: one small file per lesson, kept OUT of the index — together
  // they are the whole corpus (~2.4 MB for English), which would more than
  // double a payload every reader downloads to search at all. The dialog
  // fetches only the lessons it is showing. Their URLs carry the index's
  // content stamp (`?v=`): they sit at stable paths and are cached hard by the
  // service worker, so the stamp is what makes a deploy invalidate them.
  let sectionBytes = 0;
  let anchored = 0;
  for (const doc of docs) {
    const file = path.join(
      ROOT,
      "public",
      "search",
      locale,
      `${doc.id.replace(/^\//, "")}.json`,
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const json = JSON.stringify(sections[doc.id]);
    fs.writeFileSync(file, json);
    sectionBytes += Buffer.byteLength(json);
    anchored += doc.sections.filter((s) => s.anchor).length;
  }

  // A round trip through JSON and loadIndex proves the file on disk is one the
  // dialog will accept, before it is written.
  const json = JSON.stringify(index);
  loadIndex(JSON.parse(json));
  const out = path.join(ROOT, "public", `search-index.${locale}.json`);
  fs.writeFileSync(out, json);

  const bytes = Buffer.byteLength(json);
  const note =
    indexLocale === locale
      ? ""
      : ` — tokenized as '${indexLocale}' (${englishText}/${docs.length} lessons untranslated)`;
  console.log(
    `search index (${locale}): ${index.docs.length} lessons, ` +
      `${index.terms.length} words, ${anchored} anchored sections, ` +
      `${(bytes / 1024).toFixed(0)} KB -> ${path.relative(ROOT, out)}${note}\n` +
      `  section texts (${locale}): ${docs.length} files, ` +
      `${(sectionBytes / 1024).toFixed(0)} KB total, ` +
      `${(sectionBytes / 1024 / (docs.length || 1)).toFixed(0)} KB average ` +
      `-> public/search/${locale}/`,
  );
}

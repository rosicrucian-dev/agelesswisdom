/**
 * Builds the two "download everything" artifacts served from the About page:
 *   public/downloads/all-lessons.zip  — every per-lesson PDF: core sections
 *                                        under school-of-ageless-wisdom/sections/,
 *                                        the separately-published "Additional
 *                                        Material" under its own top-level
 *                                        additional-material/ folder.
 *   public/downloads/all-lessons.pdf  — a title page + every CORE lesson merged
 *                                        in curriculum order (School of Ageless
 *                                        Wisdom only; no additional material),
 *                                        with a nested section -> lesson outline.
 *
 * Runs AFTER pdf:lessons (it consumes the PDFs that step writes) and, like
 * those PDFs, is a derived artifact regenerated on every deploy — never
 * committed. Its tools (zip, ghostscript, poppler's pdfinfo) are platform-
 * independent, so the output is deterministic across macOS and the Linux CI
 * runner — unlike the Chrome render, which is the only step that was sensitive
 * to the build machine.
 *
 *   npm run pdf:bundles
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getAllSections,
  lessonDiskPath,
  numberedLessonTitle,
  type Lesson,
  type Section,
} from "../../src/data/curriculum.ts";
import { PUBLIC_DIR, buildPdf, escapeHtml, fontFaceCss } from "./render.ts";
import { lessonBodyHtml, lessonCss } from "./lessons.ts";

const PDF_DIR = path.join(PUBLIC_DIR, "lessons");
const OUT_DIR = path.join(PUBLIC_DIR, "downloads");
const ZIP = path.join(OUT_DIR, "all-lessons.zip");
const MERGED = path.join(OUT_DIR, "all-lessons.pdf");
const SITE_TITLE = "The School of Ageless Wisdom";

type Grouped = { section: Section; lessons: { lesson: Lesson; pdf: string }[] };

/** Ordered lessons that actually have a rendered PDF on disk, grouped by
 *  section. A lesson without a PDF — e.g. the donor-excluded MAGIC.06, which
 *  has no MDX — is simply skipped, so it never enters either bundle. */
function collectSections(): Grouped[] {
  let groups: Grouped[] = [];
  for (let section of getAllSections()) {
    let lessons: { lesson: Lesson; pdf: string }[] = [];
    for (let lesson of section.lessons) {
      let { dir, file } = lessonDiskPath(section.id, lesson.id);
      let pdf = path.join(PDF_DIR, dir, `${file}.pdf`);
      if (fs.existsSync(pdf)) lessons.push({ lesson, pdf });
    }
    if (lessons.length) groups.push({ section, lessons });
  }
  return groups;
}

function pageCount(pdf: string): number {
  let out = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  let m = out.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error(`could not read page count from ${pdf}`);
  return Number(m[1]);
}

/** Encode a bookmark title as a UTF-16BE hex string, the pdfmark form that
 *  survives non-ASCII (em dashes, accented names) intact. */
function pdfMarkText(value: string): string {
  let hex = "FEFF"; // BOM
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

/** A minimal cover: the site name centered on an otherwise blank US-Letter
 *  page, rendered through the shared Chrome pipeline so its type matches the
 *  lessons exactly. */
function renderTitlePage(dest: string) {
  let html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>${fontFaceCss()}
@page { size: 8.5in 11in; margin: 0; }
html, body { height: 100%; margin: 0; }
body {
  align-items: center;
  color: #211f1a;
  display: flex;
  font-family: "Print Literata", serif;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}
h1 { font-size: 30pt; font-weight: 700; line-height: 1.2; margin: 0; padding: 0 1in; }
</style>
</head>
<body><h1>${escapeHtml(SITE_TITLE)}</h1></body>
</html>`;
  let tmpHtml = dest.replace(/\.pdf$/, ".html");
  fs.writeFileSync(tmpHtml, html);
  buildPdf(tmpHtml, dest);
  fs.rmSync(tmpHtml, { force: true });
}

/** zip of the per-lesson PDFs, staged into two top-level folders:
 *    school-of-ageless-wisdom/sections/<section>/NN-title.pdf   (core)
 *    additional-material/<section>/NN-title.pdf                 (separate)
 *  so the archive reads as the School of Ageless Wisdom curriculum plus a
 *  clearly-distinct set of separately-published material. */
function buildZip(core: Grouped[], additional: Grouped[]) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(ZIP, { force: true }); // zip appends to an existing archive otherwise
  let stage = fs.mkdtempSync(path.join(os.tmpdir(), "zip-"));
  try {
    let topDirs: string[] = [];
    for (let g of core) {
      fs.cpSync(
        path.join(PDF_DIR, g.section.id),
        path.join(stage, "school-of-ageless-wisdom", "sections", g.section.id),
        { recursive: true },
      );
    }
    if (core.length) topDirs.push("school-of-ageless-wisdom");
    for (let g of additional) {
      fs.cpSync(
        path.join(PDF_DIR, g.section.id),
        path.join(stage, "additional-material", g.section.id),
        { recursive: true },
      );
    }
    if (additional.length) topDirs.push("additional-material");
    execFileSync("zip", ["-r", "-q", "-X", ZIP, ...topDirs], { cwd: stage });
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

/** All lessons as ONE continuously-paginated document: each lesson's masthead
 *  + body separated by a page break, so the footer counter(page) runs 1..N
 *  across the whole file rather than restarting per lesson. */
function mergedLessonsHtml(groups: Grouped[]): string {
  let blocks = groups
    .flatMap((g) =>
      g.lessons.map(
        ({ lesson }) =>
          `<section class="merged-lesson">${lessonBodyHtml(g.section, lesson)}</section>`,
      ),
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>${lessonCss()}
.merged-lesson { break-before: page; }
.merged-lesson:first-child { break-before: auto; }
</style>
</head>
<body>
${blocks}
</body>
</html>`;
}

/** Title page + the single continuous lessons PDF, merged with a nested
 *  section/lesson outline. Ghostscript embeds the outline (pdfmark) and, with
 *  /prepress, keeps images un-downsampled and fonts embedded. Bookmark page
 *  positions come from the per-lesson PDFs' page counts, which match the
 *  continuous render (identical CSS, one break per lesson). */
function buildMerged(groups: Grouped[]) {
  let tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bundles-"));
  try {
    let title = path.join(tmp, "_title.pdf");
    renderTitlePage(title);

    let lessonsHtml = path.join(tmp, "_lessons.html");
    fs.writeFileSync(lessonsHtml, mergedLessonsHtml(groups));
    let lessonsPdf = path.join(tmp, "_lessons.pdf");
    buildPdf(lessonsHtml, lessonsPdf);

    let marks: string[] = [];
    let page = pageCount(title) + 1; // first lesson starts after the title page
    let lessonPages = 0;

    for (let { section, lessons } of groups) {
      let secTitle = section.title
        ? `${section.label} — ${section.title}`
        : section.label;
      // Parent entry, collapsed, anchored to its first lesson's first page;
      // /Count -N makes the next N entries its children.
      marks.push(
        `[/Count -${lessons.length} /Page ${page} /Title ${pdfMarkText(secTitle)} /OUT pdfmark`,
      );
      for (let { lesson, pdf } of lessons) {
        marks.push(
          `[/Page ${page} /Title ${pdfMarkText(numberedLessonTitle(section, lesson))} /OUT pdfmark`,
        );
        let n = pageCount(pdf);
        page += n;
        lessonPages += n;
      }
    }

    let rendered = pageCount(lessonsPdf);
    if (rendered !== lessonPages) {
      console.warn(
        `[bundles] continuous render is ${rendered} pages but per-lesson ` +
          `counts sum to ${lessonPages}; bookmark pages may be off by the drift.`,
      );
    }

    let marksFile = path.join(tmp, "marks.ps");
    fs.writeFileSync(marksFile, marks.join("\n") + "\n");

    fs.mkdirSync(OUT_DIR, { recursive: true });
    execFileSync("gs", [
      "-dBATCH",
      "-dNOPAUSE",
      "-q",
      "-sDEVICE=pdfwrite",
      "-dPDFSETTINGS=/prepress",
      "-dCompatibilityLevel=1.7",
      `-sOutputFile=${MERGED}`,
      title,
      lessonsPdf,
      marksFile,
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  let groups = collectSections();
  let core = groups.filter((g) => !g.section.additional);
  let additional = groups.filter((g) => g.section.additional);
  let lessonTotal = groups.reduce((n, g) => n + g.lessons.length, 0);
  if (!lessonTotal) {
    throw new Error(
      "no lesson PDFs found in public/lessons — run `npm run pdf:lessons` first",
    );
  }
  // Zip carries everything (core + additional, separated); the single merged
  // PDF is School of Ageless Wisdom material only — no additional material.
  buildZip(core, additional);
  buildMerged(core);
  let coreTotal = core.reduce((n, g) => n + g.lessons.length, 0);
  console.log(
    `bundled ${lessonTotal} lessons (${coreTotal} core + ${lessonTotal - coreTotal} additional):`,
  );
  console.log(`  ${path.relative(process.cwd(), ZIP)}  (all)`);
  console.log(`  ${path.relative(process.cwd(), MERGED)}  (core only)`);
}

main();

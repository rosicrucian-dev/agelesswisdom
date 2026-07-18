/**
 * Generates one typeset PDF per lesson — the "PDF" button on each lesson page.
 *
 * Usage:
 *   npm run pdf:lessons              # HTML + PDF for every lesson
 *   npm run pdf:lessons -- --html-only   # skip the (slow) Chrome step; preview HTML
 *   npm run pdf:lessons -- section-a/01-the-life-power   # one lesson (by dir/file)
 *
 * Design: US Letter, restrained "refined handout" — the vendored Literata
 * serif, a compact masthead (section · lesson eyebrow, title, hairline rule),
 * justified body, centered small-caps subheads, page number + site name in the
 * footer. No cover page, no drop cap. Reuses the shared MDX->HTML->PDF core in
 * render.ts, so the book and the lessons stay typographically consistent and a
 * style tweak here is a single edit + regenerate.
 *
 * Reads committed MDX from content/lessons/; writes intermediate HTML to
 * output/print/lessons/ (gitignored) and the committed PDF to
 * public/lessons/<section>/<file>.pdf (same path the lesson page already
 * checks, so no app wiring changes).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllSections,
  lessonDiskPath,
  lessonTitleParts,
  numberedLessonTitle,
  type Lesson,
  type Section,
} from "../../src/data/curriculum.ts";
import {
  CONTENT_DIR,
  ROOT,
  buildPdf,
  escapeHtml,
  fontFaceCss,
  mdxToHtml,
  sharedElementsCss,
} from "./render.ts";

const HTML_DIR = path.join(ROOT, "output", "print", "lessons");
const PDF_DIR = path.join(ROOT, "public", "lessons");

export function lessonCss(): string {
  return `${fontFaceCss()}
@page {
  size: 8.5in 11in;
  margin: 1in 1.4in 0.85in;
  @bottom-center {
    content: counter(page);
    font-family: "Print Literata", "Print Hebrew", "Print Math", "Print Symbols", "Print Symbols 2", serif;
    font-size: 9pt;
    color: #6b6456;
  }
  @bottom-right {
    content: "agelesswisdom.school";
    font-family: "Print Literata", "Print Hebrew", "Print Math", "Print Symbols", "Print Symbols 2", serif;
    font-size: 8pt;
    letter-spacing: 0.02em;
    color: #9a927f;
  }
}
* {
  box-sizing: border-box;
}
html {
  color: #211f1a;
  font-family: "Print Literata", "Print Hebrew", "Print Math", "Print Symbols", "Print Symbols 2", serif;
  font-size: 11.5pt;
  line-height: 1.5;
}
body {
  margin: 0;
  font-kerning: normal;
  text-rendering: optimizeLegibility;
}
h1,
h2,
h3,
h4,
p {
  margin: 0;
}
.lesson-masthead {
  margin-bottom: 0.34in;
}
.lesson-masthead .eyebrow {
  color: #6b6456;
  font-size: 8.5pt;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.lesson-masthead h1 {
  font-size: 20pt;
  font-weight: 700;
  line-height: 1.16;
  margin: 0.06in 0 0.14in;
}
.lesson-masthead .rule {
  border: 0;
  border-top: 0.75pt solid #cbc4b4;
  margin: 0;
}
.lesson-body h2,
.lesson-body h3,
.lesson-body h4,
.lesson-body h5 {
  break-after: avoid;
  font-weight: 650;
  line-height: 1.2;
  margin: 0.26in 0 0.08in;
  text-align: center;
}
.lesson-body h2 {
  font-size: 14pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.lesson-body h3 {
  font-size: 12.5pt;
}
.lesson-body p {
  hyphens: auto;
  orphans: 3;
  text-align: justify;
  widows: 3;
}
/* Handout style for the per-lesson PDFs: paragraphs separated by space
 * (~2/3 line), no first-line indent — never both. Echoes the original typed
 * correspondence lessons and gives the page room to breathe. The compiled
 * book edition uses the classic indented-no-space style instead. */
.lesson-body p + p {
  margin-top: 0.16in;
}
.lesson-body h2 + p,
.lesson-body h3 + p,
.lesson-body h4 + p,
.lesson-body blockquote + p,
.lesson-body figure + p,
.lesson-body table + p,
.lesson-body ol + p,
.lesson-body ul + p {
  text-indent: 0;
}
${sharedElementsCss()}`;
}

/** The masthead + body fragment for one lesson (no <html>/<style> wrapper), so
 *  it can be used standalone (per-lesson PDF) or concatenated into a single
 *  continuously-paginated document (the merged all-lessons.pdf). */
export function lessonBodyHtml(section: Section, lesson: Lesson): string {
  let { dir, file } = lessonDiskPath(section.id, lesson.id);
  let mdxPath = path.join(CONTENT_DIR, dir, `${file}.mdx`);
  let markdown = fs.readFileSync(mdxPath, "utf8");
  let withoutFirstHeading = markdown.replace(/^# .+(?:\n+|$)/, "");
  let { unit, title } = lessonTitleParts(section, lesson);
  let heading = title ?? numberedLessonTitle(section, lesson);
  let eyebrow = `${section.label} · ${unit}`;
  return `<header class="lesson-masthead">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <h1>${escapeHtml(heading)}</h1>
    <hr class="rule">
  </header>
  <div class="lesson-body">
${mdxToHtml(withoutFirstHeading)}
  </div>`;
}

function lessonDocumentHtml(section: Section, lesson: Lesson): string {
  let { title } = lessonTitleParts(section, lesson);
  let heading = title ?? numberedLessonTitle(section, lesson);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(heading)} — ${escapeHtml(section.label)}</title>
  <style>${lessonCss()}</style>
</head>
<body>
${lessonBodyHtml(section, lesson)}
</body>
</html>`;
}

function main() {
  let args = process.argv.slice(2);
  let htmlOnly = args.includes("--html-only");
  let only = args.filter((a) => !a.startsWith("--")); // optional dir/file filters

  let count = 0;
  let skipped: string[] = [];

  for (let section of getAllSections()) {
    for (let lesson of section.lessons) {
      let { dir, file } = lessonDiskPath(section.id, lesson.id);
      let key = `${dir}/${file}`;
      if (only.length && !only.includes(key)) continue;

      let mdxPath = path.join(CONTENT_DIR, dir, `${file}.mdx`);
      if (!fs.existsSync(mdxPath)) {
        skipped.push(key);
        continue;
      }

      let htmlDir = path.join(HTML_DIR, dir);
      fs.mkdirSync(htmlDir, { recursive: true });
      let htmlPath = path.join(htmlDir, `${file}.html`);
      fs.writeFileSync(htmlPath, lessonDocumentHtml(section, lesson));

      if (!htmlOnly) {
        let pdfDir = path.join(PDF_DIR, dir);
        fs.mkdirSync(pdfDir, { recursive: true });
        buildPdf(htmlPath, path.join(pdfDir, `${file}.pdf`));
      }
      count++;
      console.log(`${htmlOnly ? "html" : "pdf "} ${key}`);
    }
  }

  console.log(
    `\n${count} lesson ${htmlOnly ? "HTML files" : "PDFs"} written` +
      (skipped.length
        ? `; skipped ${skipped.length} without MDX: ${skipped.join(", ")}`
        : "."),
  );
}

// Run only when invoked directly (`npm run pdf:lessons`), not when another
// script imports lessonCss / lessonBodyHtml from here (e.g. bundles.ts).
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

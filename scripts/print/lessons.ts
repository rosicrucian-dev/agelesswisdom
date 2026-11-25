/**
 * Generates one typeset PDF per lesson — the "PDF" button on each lesson page.
 *
 * Usage:
 *   npm run pdf:lessons              # HTML + PDF for every lesson
 *   npm run pdf:lessons -- --html-only   # skip the (slow) Chrome step; preview HTML
 *   npm run pdf:lessons -- section-a/01-the-life-power   # one lesson (by dir/file)
 *
 * Two editions of every lesson, from one stylesheet (PAGE_FORMATS): print, on
 * US Letter, to public/lessons/ (the lesson page's PDF button); and screen, a
 * 6 × 8.5in page with narrow margins for reading on a tablet or computer, to
 * public/lessons-screen/. Only the page changes; the type is the same. The
 * books repository sets its whole books the same two ways (print/book.ts).
 *
 * Design: restrained "refined handout" — the vendored Literata
 * serif, a compact masthead (section · lesson eyebrow, title, hairline rule),
 * justified body, centered small-caps subheads, page number + site name in the
 * footer. No cover page, no drop cap. Reuses the shared MDX->HTML->PDF core in
 * render.ts, so the book and the lessons stay typographically consistent and a
 * style tweak here is a single edit + regenerate.
 *
 * Reads committed MDX from content/lessons/; writes intermediate HTML to
 * output/print/<edition>/ and the PDF to public/lessons/<section>/<file>.pdf
 * (the path the lesson page checks at build time) and
 * public/lessons-screen/<section>/<file>.pdf. Both are gitignored: the
 * Deploy workflow regenerates the PDFs before every build.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllSections,
  lessonDiskPath,
  lessonSourceFile,
  lessonTitleParts,
  numberedLessonTitle,
  type Lesson,
  type Section,
} from "../../src/data/curriculum.ts";
import { DEFAULT_LOCALE } from "../../src/lib/locales.ts";
import {
  ROOT,
  buildPdf,
  escapeHtml,
  fontFaceCss,
  mdxToHtml,
  sharedElementsCss,
} from "./render.ts";

export type PageFormat = "print" | "screen";
export const PAGE_FORMATS: readonly PageFormat[] = ["print", "screen"];

/** The page of each edition: the books repository's (print/book.ts), so a
 *  lesson and a book from the same shelf share their page as their type. */
const GEOMETRY: Record<PageFormat, { size: string; margin: string }> = {
  print: { size: "8.5in 11in", margin: "1in 1.4in 0.85in" },
  screen: { size: "6in 8.5in", margin: "0.6in 0.55in 0.7in" },
};

/** Where each edition's PDFs go, a folder per section beneath. */
export const PDF_DIRS: Record<PageFormat, string> = {
  print: path.join(ROOT, "public", "lessons"),
  screen: path.join(ROOT, "public", "lessons-screen"),
};
const HTML_DIRS: Record<PageFormat, string> = {
  print: path.join(ROOT, "output", "print", "lessons"),
  screen: path.join(ROOT, "output", "print", "lessons-screen"),
};

export function lessonCss(format: PageFormat = "print"): string {
  const page = GEOMETRY[format];
  return `${fontFaceCss()}
@page {
  size: ${page.size};
  margin: ${page.margin};
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
/* The 1px right inset is a workaround for a Chrome print-to-PDF rounding bug,
   not a design margin. The print page's content box is 5.7in = 547.2 CSS px wide
   (the screen page's, 4.9in = 470.4px, is fractional the same way);
   Chrome LAYS OUT into a whole-pixel 548 but CLIPS the page at the exact
   fractional 547.2, so the last ~0.8px of anything reaching the right edge is
   cut away — visible in the PDF content stream as a border rect at x 547..548
   under a clip of width 547.2. That chopped a full-width table's right rule to
   a third of its weight (while the left rule, and every rule of a narrower
   table, stayed full). Reserving 1px keeps every right edge — table borders and
   the last glyph of a justified line alike — inside the clip. */
body {
  margin: 0;
  padding-right: 1px;
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
  const source = lessonSourceFile(DEFAULT_LOCALE, section.id, lesson.id);
  const markdown = fs.readFileSync(source, "utf8");
  // The lesson's title, set in the masthead instead: `#` in this site's
  // transcripts, `##` in a text of the books repository.
  const withoutFirstHeading = markdown.replace(/^#{1,2} .+(?:\n+|$)/, "");
  const { unit, title } = lessonTitleParts(section, lesson);
  const heading = title ?? numberedLessonTitle(section, lesson);
  const eyebrow = `${section.label} · ${unit}`;
  return `<header class="lesson-masthead">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <h1>${escapeHtml(heading)}</h1>
    <hr class="rule">
  </header>
  <div class="lesson-body">
${mdxToHtml(withoutFirstHeading, source)}
  </div>`;
}

function lessonDocumentHtml(
  section: Section,
  lesson: Lesson,
  format: PageFormat,
): string {
  const { title } = lessonTitleParts(section, lesson);
  const heading = title ?? numberedLessonTitle(section, lesson);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(heading)} — ${escapeHtml(section.label)}</title>
  <style>${lessonCss(format)}</style>
</head>
<body>
${lessonBodyHtml(section, lesson)}
</body>
</html>`;
}

function main() {
  const args = process.argv.slice(2);
  const htmlOnly = args.includes("--html-only");
  const only = args.filter((a) => !a.startsWith("--")); // optional dir/file filters

  let count = 0;
  const skipped: string[] = [];

  for (const section of getAllSections(DEFAULT_LOCALE)) {
    for (const lesson of section.lessons) {
      const { dir, file } = lessonDiskPath(section.id, lesson.id);
      const key = `${dir}/${file}`;
      if (only.length && !only.includes(key)) continue;

      if (
        !fs.existsSync(lessonSourceFile(DEFAULT_LOCALE, section.id, lesson.id))
      ) {
        skipped.push(key);
        continue;
      }

      for (const format of PAGE_FORMATS) {
        const htmlDir = path.join(HTML_DIRS[format], dir);
        fs.mkdirSync(htmlDir, { recursive: true });
        const htmlPath = path.join(htmlDir, `${file}.html`);
        fs.writeFileSync(htmlPath, lessonDocumentHtml(section, lesson, format));

        if (!htmlOnly) {
          const pdfDir = path.join(PDF_DIRS[format], dir);
          fs.mkdirSync(pdfDir, { recursive: true });
          buildPdf(htmlPath, path.join(pdfDir, `${file}.pdf`));
        }
      }
      count++;
      console.log(`${htmlOnly ? "html" : "pdf "} ${key}`);
    }
  }

  console.log(
    `\n${count} lessons written, ${htmlOnly ? "HTML" : "PDF"} in each edition` +
      (skipped.length
        ? `; skipped ${skipped.length} without MDX: ${skipped.join(", ")}`
        : "."),
  );
}

// Run only when invoked directly (`npm run pdf:lessons`), not when another
// script imports lessonCss / lessonBodyHtml from here (e.g. bundles.ts).
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

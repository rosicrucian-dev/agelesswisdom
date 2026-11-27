/**
 * Builds the "download everything" archives served from the About page, one
 * per edition of the lessons (lessons.ts):
 *   public/downloads/all-lessons.zip         the print edition (US Letter)
 *   public/downloads/all-lessons-screen.zip  the screen edition
 * each holding every per-lesson PDF of the School's curriculum in that
 * edition, under school-of-ageless-wisdom/sections/. Sections marked
 * `additional` in the curriculum (separately-published material, such as
 * the hidden Seven Stages) are left out: the archive is the School alone.
 *
 * The School's lessons as one whole-book PDF (in both editions) is the books
 * repository's release, which the About page links; they are not merged here any more.
 *
 * Runs AFTER pdf:lessons (it consumes the PDFs that step writes) and, like
 * those PDFs, is a derived artifact regenerated on every deploy — never
 * committed. zip is preinstalled on the runner.
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
  type Lesson,
  type Section,
} from "../../src/data/curriculum.ts";
import { DEFAULT_LOCALE } from "../../src/lib/locales.ts";
import { PAGE_FORMATS, PDF_DIRS, type PageFormat } from "./lessons.ts";
import { PUBLIC_DIR } from "./render.ts";

const OUT_DIR = path.join(PUBLIC_DIR, "downloads");
const zipPath = (format: PageFormat) =>
  path.join(
    OUT_DIR,
    format === "print" ? "all-lessons.zip" : `all-lessons-${format}.zip`,
  );

type Grouped = { section: Section; lessons: { lesson: Lesson; pdf: string }[] };

/** Ordered lessons that actually have a rendered PDF on disk, grouped by
 *  section. A lesson without a PDF — e.g. the donor-excluded MAGIC.06, which
 *  has no MDX — is simply skipped, so it never enters the archive. */
function collectSections(pdfDir: string): Grouped[] {
  const groups: Grouped[] = [];
  for (const section of getAllSections(DEFAULT_LOCALE)) {
    const lessons: { lesson: Lesson; pdf: string }[] = [];
    for (const lesson of section.lessons) {
      const { dir, file } = lessonDiskPath(section.id, lesson.id);
      const pdf = path.join(pdfDir, dir, `${file}.pdf`);
      if (fs.existsSync(pdf)) lessons.push({ lesson, pdf });
    }
    if (lessons.length) groups.push({ section, lessons });
  }
  return groups;
}

/** zip of the per-lesson PDFs, staged as
 *    school-of-ageless-wisdom/sections/<section>/NN-title.pdf */
function buildZip(pdfDir: string, zip: string, core: Grouped[]) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(zip, { force: true }); // zip appends to an existing archive otherwise
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "zip-"));
  try {
    for (const g of core) {
      fs.cpSync(
        path.join(pdfDir, g.section.id),
        path.join(stage, "school-of-ageless-wisdom", "sections", g.section.id),
        { recursive: true },
      );
    }
    execFileSync("zip", ["-r", "-q", "-X", zip, "school-of-ageless-wisdom"], {
      cwd: stage,
    });
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function main() {
  for (const format of PAGE_FORMATS) {
    const pdfDir = PDF_DIRS[format];
    const zip = zipPath(format);
    const core = collectSections(pdfDir).filter((g) => !g.section.additional);
    const lessonTotal = core.reduce((n, g) => n + g.lessons.length, 0);
    if (!lessonTotal) {
      throw new Error(
        `no lesson PDFs found in ${path.relative(process.cwd(), pdfDir)} — run \`npm run pdf:lessons\` first`,
      );
    }
    buildZip(pdfDir, zip, core);
    console.log(
      `bundled ${lessonTotal} lessons: ${path.relative(process.cwd(), zip)}`,
    );
  }
}

main();

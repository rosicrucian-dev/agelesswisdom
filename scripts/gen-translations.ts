// Generates/refreshes the per-locale translation files the translator
// edits (same conventions as ../bota-toolbox — full sibling copies,
// translate the English you see):
//
//   content/curriculum/<locale>.json — a FULL copy of en.json with any
//     previously translated display values (label/title/description/
//     unitLabel, matched by section/lesson id) carried over. Structure
//     always comes fresh from English, so translated files can't rot
//     and structural edits are healed on resync.
//
//   content/lessons/<locale>/**.mdx and content/pages/<locale>/*.mdx —
//     full markdown copies of the English sources (translate prose in
//     place). Created only when missing; existing files are never
//     touched.
//
//   content/messages/<locale>.json — flat chrome-string map synced from
//     en.json (skipped until the message catalog exists).
//
// Idempotent: running it twice produces no diff.
// Run with: npm run gen:translations

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, TRANSLATION_LOCALES } from "../src/lib/locales.ts";

const ROOT = path.join(import.meta.dirname, "..");

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeIfChanged(file: string, content: string): boolean {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) {
    return false;
  }
  fs.writeFileSync(file, content);
  return true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------- curriculum ----------

const SECTION_DISPLAY = ["label", "title", "description", "unitLabel"];
const LESSON_DISPLAY = ["title", "description", "unitLabel"];

function skeletonEntry(
  en: Record<string, unknown>,
  prev: unknown,
  fields: string[],
): { out: Record<string, unknown>; total: number; translated: number } {
  const out: Record<string, unknown> = { ...en };
  let total = 0;
  let translated = 0;
  const prevRec = isRecord(prev) ? prev : {};
  for (const field of fields) {
    if (typeof en[field] !== "string") continue;
    total++;
    const prevValue = prevRec[field];
    if (typeof prevValue === "string" && prevValue !== en[field]) {
      out[field] = prevValue;
      translated++;
    }
  }
  return { out, total, translated };
}

for (const locale of TRANSLATION_LOCALES) {
  const enSections = readJson(
    path.join(ROOT, "content", "curriculum", `${DEFAULT_LOCALE}.json`),
  ) as Record<string, unknown>[];
  const dest = path.join(ROOT, "content", "curriculum", `${locale}.json`);
  const prevSections = fs.existsSync(dest)
    ? (readJson(dest) as Record<string, unknown>[])
    : [];
  const prevById = new Map(prevSections.map((s) => [s.id, s]));

  let total = 0;
  let translated = 0;
  const skeleton = enSections.map((section) => {
    const prev = prevById.get(section.id);
    const s = skeletonEntry(section, prev, SECTION_DISPLAY);
    total += s.total;
    translated += s.translated;
    const prevLessons = new Map(
      (isRecord(prev) && Array.isArray(prev.lessons) ? prev.lessons : [])
        .filter(isRecord)
        .map((l) => [l.id, l]),
    );
    s.out.lessons = (section.lessons as Record<string, unknown>[]).map(
      (lesson) => {
        const l = skeletonEntry(
          lesson,
          prevLessons.get(lesson.id),
          LESSON_DISPLAY,
        );
        total += l.total;
        translated += l.translated;
        return l.out;
      },
    );
    return s.out;
  });

  const changed = writeIfChanged(
    dest,
    JSON.stringify(skeleton, null, 2) + "\n",
  );
  console.log(
    `${changed ? "wrote  " : "current"} content/curriculum/${locale}.json — ${translated}/${total} translated`,
  );
}

// ---------- markdown copies (lessons + pages) ----------

function copyTree(kindDir: string) {
  const enDir = path.join(ROOT, "content", kindDir, DEFAULT_LOCALE);
  if (!fs.existsSync(enDir)) return;
  for (const locale of TRANSLATION_LOCALES) {
    let created = 0;
    let existing = 0;
    const walk = (rel: string) => {
      for (const entry of fs.readdirSync(path.join(enDir, rel), {
        withFileTypes: true,
      })) {
        const relPath = path.join(rel, entry.name);
        if (entry.isDirectory()) {
          walk(relPath);
        } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
          const dest = path.join(ROOT, "content", kindDir, locale, relPath);
          if (fs.existsSync(dest)) {
            existing++;
          } else {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(path.join(enDir, relPath), dest);
            created++;
          }
        }
      }
    };
    walk(".");
    console.log(
      `content/${kindDir}/${locale}: ${created} skeleton(s) created, ${existing} already present`,
    );
  }
}

copyTree("lessons");
copyTree("pages");

// ---------- chrome messages ----------

{
  const enPath = path.join(
    ROOT,
    "content",
    "messages",
    `${DEFAULT_LOCALE}.json`,
  );
  if (fs.existsSync(enPath)) {
    const en = readJson(enPath) as Record<string, string>;
    for (const locale of TRANSLATION_LOCALES) {
      const dest = path.join(ROOT, "content", "messages", `${locale}.json`);
      const prev = fs.existsSync(dest)
        ? (readJson(dest) as Record<string, string>)
        : {};
      const out: Record<string, string> = {};
      let translated = 0;
      for (const [key, english] of Object.entries(en)) {
        const value = typeof prev[key] === "string" ? prev[key] : english;
        out[key] = value;
        if (value !== english) translated++;
      }
      for (const key of Object.keys(prev)) {
        if (!(key in out)) {
          console.warn(
            `gen-translations: messages/${locale}.json: key "${key}" no longer exists in English — kept, please review`,
          );
          out[key] = prev[key];
        }
      }
      const changed = writeIfChanged(dest, JSON.stringify(out, null, 2) + "\n");
      console.log(
        `${changed ? "wrote  " : "current"} content/messages/${locale}.json — ${translated}/${Object.keys(en).length} translated`,
      );
    }
  }
}

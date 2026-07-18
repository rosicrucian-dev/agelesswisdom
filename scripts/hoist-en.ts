// Moves the English export from out/en/ up to the export root after
// `next build` — wired as the first half of the npm `postbuild` script,
// ahead of gen-sw (which scans the final layout).
//
// Every route lives under src/app/[locale]/, so the build emits English
// pages at out/en/... — but production serves English unprefixed
// (existing URLs, bookmarks, and the installed-PWA start_url '/' all
// predate locales). This script merges the out/en/ tree into out/
// (which already holds public/ assets like tarot/ and splash/, plus
// root metadata files — hence a per-file merge, not a rename), then
// deletes the emptied out/en/. Any file-level collision is a bug —
// fail loudly rather than clobber.
//
// Dev parity: next.config.mjs has a dev-only fallback rewrite mapping
// unprefixed paths to /en/, so dev serves the same URL shape without
// this script.
//
// Run standalone with: npm run hoist:en [export-dir]

import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { TRANSLATION_LOCALES } from "../src/lib/locales.ts";

const outDir = process.argv[2] ?? "out";
const enDir = join(outDir, "en");

if (!existsSync(enDir)) {
  throw new Error(
    `hoist-en: ${enDir}/ not found — already hoisted, or not a fresh export?`,
  );
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(enDir);
for (const full of files) {
  const rel = relative(enDir, full);
  const dest = join(outDir, rel);
  if (existsSync(dest)) {
    // The root already has public/ assets and metadata routes; an English
    // page landing on one of those names means a route/asset conflict
    // that must be resolved, not silently overwritten.
    throw new Error(`hoist-en: collision at ${dest} — refusing to overwrite`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(full, dest);
}

// Only empty directories remain under out/en/ (every file above either
// moved or threw).
rmSync(enDir, { recursive: true });

// Sanity: the hoist produced a root home page, and every translated
// locale's tree is still in place — all locales made it through the
// build.
for (const [file, what] of [
  [join(outDir, "index.html"), "hoisted English home page"],
  ...TRANSLATION_LOCALES.map(
    (l) => [join(outDir, l, "index.html"), `${l} home page`] as const,
  ),
] as const) {
  if (!existsSync(file)) {
    throw new Error(`hoist-en: missing ${what} at ${file}`);
  }
}

console.log(
  `hoist-en: moved ${files.length} files from ${enDir}/ to ${outDir}/`,
);

// Generates the service worker (out/sw.js) from scripts/sw.template.js after
// `next build` — wired up as the npm `postbuild` script, so both the CI build
// and the GitHub Pages deploy produce it automatically.
//
// Scans the static export and builds the precache manifest:
//   - every page (**/index.html, plus 404.html)
//   - every build asset (_next/static/**, content-hashed by Next)
//   - root-level icons + web manifest
//   - the default-locale search index
// Each entry carries a sha-256 content hash so the worker only re-downloads
// files that actually changed between deploys. Everything else (lesson PDFs,
// lesson images, RSC .txt payloads, splash screens, the snippet sidecars) is
// deliberately NOT precached — the worker caches those at runtime as they're
// browsed, so a first visit doesn't pull ~75MB of PDFs.
//
// The search index is the one runtime-sized file that IS precached: it is what
// makes search work offline, and being rev-tracked it costs one download per
// deploy instead of a background revalidation in every session that searches.
//
// Run standalone with: npm run gen:sw [export-dir]

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { DEFAULT_LOCALE, TRANSLATION_LOCALES } from "../src/lib/locales.ts";

/** The one search index that gets precached — see the header. */
const SEARCH_INDEX = `search-index.${DEFAULT_LOCALE}.json`;

const outDir = process.argv[2] ?? "out";
const templatePath = join("scripts", "sw.template.js");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

// Export-relative POSIX path → served URL path.
function toUrl(rel: string): string {
  const posix = rel.split(sep).join("/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) {
    // trailingSlash: true — pages are served at their directory URL.
    return `/${posix.slice(0, -"index.html".length)}`;
  }
  return `/${posix}`;
}

const ROOT_ASSET = /^[^/\\]+\.(png|ico|webmanifest)$/;

const precachePaths = walk(outDir)
  .map((full) => relative(outDir, full))
  .filter((rel) => {
    const posix = rel.split(sep).join("/");
    // Translated-locale pages (/de/** etc.) are NOT precached —
    // installing the PWA shouldn't multiply the download for locales
    // most users never open; the runtime cache picks them up as they're
    // browsed. (English sits at the root after scripts/hoist-en.ts.)
    if (TRANSLATION_LOCALES.some((l) => posix.startsWith(`${l}/`))) {
      return false;
    }
    if (posix.endsWith("/index.html") || posix === "index.html") return true;
    if (posix === "404.html") return true;
    if (posix.startsWith("_next/static/")) return true;
    if (posix === SEARCH_INDEX) return true;
    return ROOT_ASSET.test(posix);
  })
  .sort();

const manifest = precachePaths.map((rel) => ({
  url: toUrl(rel),
  rev: createHash("sha256")
    .update(readFileSync(join(outDir, rel)))
    .digest("hex")
    .slice(0, 12),
}));

if (manifest.length < 100) {
  // A complete export has 100+ pages; a tiny manifest means we scanned a
  // partial/wrong directory and would ship a worker that "works" but caches
  // almost nothing. Fail loudly instead.
  throw new Error(
    `gen-sw: only ${manifest.length} precache entries found in ${outDir}/ — is this a complete export?`,
  );
}

// The stamp the sidecar URLs carry, read back from the index the search
// generator just wrote. The worker uses it to retire superseded sidecars.
const searchVersion: string = JSON.parse(
  readFileSync(join(outDir, SEARCH_INDEX), "utf8"),
).version;
if (!searchVersion) {
  throw new Error(
    `gen-sw: ${SEARCH_INDEX} has no version stamp — is gen:search up to date?`,
  );
}

let sw = readFileSync(templatePath, "utf8");
for (const [token, value] of [
  ["__PRECACHE_MANIFEST__", JSON.stringify(manifest)],
  ["__SEARCH_VERSION__", JSON.stringify(searchVersion)],
] as const) {
  if (sw.split(token).length !== 2) {
    throw new Error(`gen-sw: template must contain ${token} exactly once`);
  }
  sw = sw.replace(token, value);
}

writeFileSync(join(outDir, "sw.js"), sw);

const pages = manifest.filter((e) => e.url.endsWith("/")).length;
console.log(
  `gen-sw: wrote ${join(outDir, "sw.js")} — ${manifest.length} precache entries (${pages} pages), search v${searchVersion}`,
);

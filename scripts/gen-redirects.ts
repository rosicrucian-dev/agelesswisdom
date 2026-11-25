// Writes static redirect stubs for URLs that have MOVED — wired into the
// npm `postbuild` script AFTER hoist-en (so the English tree already sits at
// the export root) and BEFORE gen-sw (which scans the final layout).
//
// Why stubs and not a redirect rule: the site is a static export on GitHub
// Pages, so there is no server to answer with a 301, and the zone is
// DNS-only on Cloudflare (GitHub Pages answers every request directly), so
// there is no edge to hold a redirect rule either. A generated page at the
// old path is the only mechanism available.
//
// Each stub carries THREE redirects, deliberately layered:
//   1. <script> location.replace(...) — the real one. It is the only form
//      that can carry the QUERY STRING and FRAGMENT across, and both matter
//      here: `?q=` drives on-page search highlighting (use-highlight-query)
//      and `#p12` is a paragraph anchor that readers copy themselves via the
//      gutter button (copy-anchor.tsx). A bare meta-refresh drops the
//      fragment in several browsers, which would silently strand every deep
//      link anyone has ever shared.
//   2. <meta http-equiv="refresh"> — the no-JavaScript fallback.
//   3. A visible <a> — the no-JavaScript, no-meta floor, and what a crawler
//      that ignores both still follows.
//
// `noindex` + `canonical` tell search engines the old URL is not a duplicate
// to be ranked but a pointer; the sitemap lists only the new URLs, because it
// is generated from the curriculum, which no longer knows the old id.
//
// These stubs are PERMANENT. They cost ~1 KB each and the links they rescue
// (bookmarks, the Google index, copied passage links) have no expiry.
//
// Run standalone with: npm run gen:redirects [export-dir]

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getAllSections, type Section } from "../src/data/curriculum.ts";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../src/lib/locales.ts";
import { SITE_URL } from "../src/lib/site.ts";

const outDir = process.argv[2] ?? "out";
const basePath = process.env.BASE_PATH ?? "";

/**
 * Sections that have been RENAMED, oldId -> newId.
 *
 * `section-final` was a positional placeholder that outlived its purpose: the
 * source never calls this material a "section" (Book 5 is "Hermetic Alchemy –
 * Science and Practice"), and it was not even last — three sections follow it
 * in the curriculum. The other nine section ids are the books' own
 * designations and are NOT renamed.
 *
 * Add to this map rather than deleting from it: an entry retires only when
 * the URL it rescues is certainly dead, which for an indexed page is never.
 */
const RENAMED_SECTIONS: Record<string, string> = {
  "section-final": "hermetic-alchemy",
};

function stub(target: string): string {
  const absolute = `${SITE_URL}${target}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Moved</title>
<link rel="canonical" href="${absolute}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
</head>
<body>
<p>This page has moved to <a href="${target}">${target}</a>.</p>
</body>
</html>
`;
}

/** Export-relative directory for a locale's copy of a path. English is
 *  hoisted to the root by hoist-en, so it takes no locale prefix. */
function localeDir(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "" : locale;
}

let written = 0;
for (const locale of LOCALES) {
  // Structure comes from the curriculum, so the lesson list is always the
  // real one — a stub can never drift from the pages it points at.
  const curriculum: Section[] = getAllSections(locale);

  for (const [oldId, newId] of Object.entries(RENAMED_SECTIONS)) {
    const section = curriculum.find((s: Section) => s.id === newId);
    if (!section) {
      throw new Error(
        `gen-redirects: no section "${newId}" in the ${locale} curriculum — ` +
          `the rename map is stale, and these stubs would point nowhere.`,
      );
    }

    // LESSONS ONLY. A section root is not a page — there is no route that
    // emits /<section>/index.html, and /section-a/ answers 404 in production
    // today. Stubbing the old section root would turn a 404 into a redirect
    // that lands on another 404, which is strictly worse than leaving it.
    const paths = section.lessons.map((lesson: { id: string }) => ({
      from: `${oldId}/${lesson.id}`,
      to: `${newId}/${lesson.id}`,
    }));

    for (const { from, to } of paths) {
      const file = join(outDir, localeDir(locale), from, "index.html");
      if (existsSync(file)) {
        throw new Error(
          `gen-redirects: ${file} already exists — a real page occupies a ` +
            `path this map claims is retired. Refusing to clobber it.`,
        );
      }
      const targetFile = join(outDir, localeDir(locale), to, "index.html");
      if (!existsSync(targetFile)) {
        throw new Error(
          `gen-redirects: ${file} would point at ${targetFile}, which does ` +
            `not exist. A stub that lands on a 404 is worse than no stub.`,
        );
      }
      mkdirSync(dirname(file), { recursive: true });
      // trailingSlash: true, so every target keeps its slash.
      const target = `${basePath}/${join(localeDir(locale), to)}/`;
      writeFileSync(file, stub(target), "utf8");
      written += 1;
    }
  }
}

console.log(
  `gen-redirects: wrote ${written} redirect stubs for ` +
    `${Object.keys(RENAMED_SECTIONS).length} renamed section(s)`,
);

# The School of Ageless Wisdom

A reading site for the early lesson curriculum of Paul Foster Case, live at
[agelesswisdom.school](https://agelesswisdom.school). It is a static site:
the lesson text is Markdown (MDX) in this repository, built once into plain
HTML and served from GitHub Pages. There is no server and no database.

Lesson text is published from editions used with permission; see the
[About](https://agelesswisdom.school/about/) page.

## Getting started

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. English serves unprefixed; German is previewable
at `/de/` but hidden from the language switcher until released.

**Dev-server gotcha (Next.js 16):** `next dev` runs as a background daemon that
survives Ctrl+C. A "restart" often starts a second instance on port 3001 while
the stale one keeps 3000 and its stale CSS. To really restart:

```bash
pkill -f "next dev"; rm -rf .next; npm run dev
```

## Commands

| Command                    | What it does                                                             |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run typecheck`        | `tsc --noEmit`. The default check; prefer it over a full build.          |
| `npm run lint`             | ESLint, including the rule that internal links use the locale wrapper.   |
| `npm test`                 | Node's built-in test runner over `test/*.test.ts`.                       |
| `npm run format`           | Prettier. CI runs `prettier --check`.                                    |
| `npm run verify:build`     | A real static build into `.next-verify` without disturbing a dev server. |
| `npm run build`            | The production build into `out/` (what the Deploy workflow runs).        |
| `npm run gen:search`       | Rebuild the per-locale search indexes. Runs automatically on `prebuild`. |
| `npm run gen:translations` | Resync the German files from English (see Localization).                 |
| `npm run pdf:lessons`      | Typeset one PDF per lesson with headless Chrome into `public/lessons/`.  |
| `npm run pdf:bundles`      | Merge those PDFs into the downloads on the About page.                   |
| `npm run check:shared`     | Assert the files shared with botatoolbox are still byte-identical.       |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check, tests,
`check:shared`, `pdf:lessons`, and the build on every pull request. Pushes to
`main` run the Deploy workflow instead, which also generates the PDFs and
bundles before building, then publishes `out/` to GitHub Pages.

## Repository layout

```
content/
  curriculum/<locale>.json   sections and lessons: ids, order, titles
  lessons/<locale>/<section>/<NN-lesson>.mdx   the lesson text
  messages/<locale>.json     UI strings
  pages/<locale>/*.mdx       standalone prose (about, overview intro)
src/
  app/                       Next.js routes, all under [locale]/
  components/                UI
  data/                      loaders for curriculum, lessons, pages
  lib/                       locales, messages, search, site constants
  icons/
plugins/rehype-lesson-anchors.mjs   paragraph ids (p1, p2, ...) for deep links
mdx.config.mjs               the MDX plugin list, defined once
mdx-components.tsx           how MDX elements render (images, links, custom tags)
scripts/                     build steps and generators (see headers in each)
test/                        search engine and search adapter tests
public/                      static assets; generated files are gitignored
```

Generated and never committed: `public/search-index.*.json`, `public/search/`,
`public/lessons/`, `public/downloads/`, `out/`, `output/`.

## Editing lesson text

The MDX files under `content/lessons/en/` are the source of truth. Every
correction is a direct edit there. The printed editions are the authority for
wording; Case's own spellings and archaic usage stay as printed. Never
modernize.

Format cheat-sheet:

- `# Title` once at the top. Subheadings as `##`. Headings get an id derived
  from their text.
- Paragraphs, `> blockquotes`, lists, and GFM tables are plain Markdown.
  `--` becomes an em dash and straight quotes become curly at build time.
- Footnotes: `[^1]` in the text, `[^1]: ...` at the end of the file.
- Images: `![Caption|WIDTHxHEIGHT](/images/lessons/<section>/<file>)`. The
  dimensions after the `|` are required; `mdx-components.tsx` reads them so
  the image can be sized before it loads.
- Links to other lessons are root-relative: `[Section B](/#section-b)` or
  `[the Wisdom Alphabet](/section-a/the-wisdom-alphabet)`. They are made
  locale-aware automatically.
- Custom tags, all defined in `mdx-components.tsx`:
  - `<Cite>Source, page</Cite>` after a blockquote for its attribution.
  - `<EditorNote>...</EditorNote>` for a short aside in the editors' voice,
    such as `[This image is unavailable.]`.
  - `<KeepTogether>...</KeepTogether>` around a short unit that should not
    break across a page in the PDF. No effect on the web.
  - `<TarotGroups />` renders the tarot-group tableaus (one lesson uses it).

Paragraph deep links (`/section-a/the-life-power/#p12`) are numbered by
position at build time by `plugins/rehype-lesson-anchors.mjs`. Its header
states the numbering contract. Inserting a paragraph shifts every later
anchor in that lesson, which is expected; the search index is rebuilt from
the same pipeline on every build so it never goes out of step.

## The curriculum manifest

`content/curriculum/en.json` defines the sections and lessons. A section's
`id` is its URL segment and its directory name under `content/lessons/`, and
is never derived from its label. Some ids are the source's own section names
(`section-a`, `section-first`); sections the source does not name are named
for their content (`hermetic-alchemy`, `oracle-of-tarot`).

Section fields: `label` (full name, shown in the sidebar and overview),
`shortLabel` (breadcrumb and lesson eyebrow), `unitLabel` (the noun used for
numbering, "Lesson"), `additional` (material published separately, grouped
under its own heading on the overview), `hidden` (built but not listed).
Lesson fields: `id`, `title`, optional `description`, `unitLabel`, and
`unnumbered` for standalone pieces.

Lesson files carry a two-digit reading-order prefix (`05-fire.mdx`) that
comes from their position in the manifest; URLs use the bare id.

**Renaming a section id changes its public URL.** Add the old and new id to
`RENAMED_SECTIONS` in `scripts/gen-redirects.ts`, which writes redirect stubs
at the old paths after every build. Entries there are permanent.

One Section D lesson is intentionally absent from the manifest and the lesson
files. The note at the top of `src/data/curriculum.ts` explains; do not add it.

## Localization

Routes live under `src/app/[locale]/`. English is built at `/en/` and hoisted
to the root after the build by `scripts/hoist-en.ts`; other locales stay
prefixed. `src/lib/locales.ts` owns the locale list and the release gate:
a locale in `UNRELEASED_LOCALES` is built and reachable by URL but hidden
from the switcher, the first-visit bounce, and the sitemap.

The one rule: every file that carries language exists per locale, side by
side, and translators translate the English they see. A missing translation
falls back to English per file, so a translator can never break the build.
`npm run gen:translations` creates missing siblings and resyncs the
curriculum and message files from English while keeping translated values.

Structure (ids, ordering, which lessons exist) is read from `en.json` only;
a translated manifest may override display fields, which are listed in
`SECTION_DISPLAY_FIELDS` and `LESSON_DISPLAY_FIELDS` in
`src/data/curriculum-helpers.ts`.

All internal links go through `Link` from `src/components/locale-link.tsx`
(ESLint enforces this). Client components read UI strings with `useT()`;
server components call `t(locale, key)`.

## Search

Search is client-side over a prebuilt inverted index per locale
(`scripts/gen-search-index.ts`, run on `prebuild`). The generator compiles
each lesson through the same MDX pipeline as the site, defined once in
`mdx.config.mjs`, so the paragraph anchors it records match the rendered
page exactly. A result deep-links to the matched paragraph and carries the
query in `?q=` so the page can mark the words.

The engine (`src/lib/search-engine.ts`) and four hooks are shared
byte-for-byte with the sibling project botatoolbox; `scripts/check-shared.ts`
lists them. They keep that project's formatting and are excluded from
Prettier here. Fix bugs in both repositories.

Result snippets come from small per-lesson JSON sidecars fetched on demand,
not from the index, so the index stays small enough to download before the
first keystroke.

## Offline and PWA

`scripts/gen-sw.ts` writes a service worker after the build that precaches
every page, the build assets, and the English search index. It registers
only when the site runs as an installed home-screen app, so ordinary visits
stay plain web pages. iOS launch screens are generated by
`npm run gen:splash` from `src/lib/splash.ts`.

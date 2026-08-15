/**
 * Server-only loader for standalone prose pages (about, the overview
 * intro). Same model as lessons: full sibling MDX per locale at
 * content/pages/<locale>/<page>.mdx (en is the master; a missing
 * translation falls back to the English file). Skeletons come from
 * `npm run gen:translations`.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, type Locale } from "../lib/locales.ts";

function pageExists(locale: string, page: string): boolean {
  return fs.existsSync(
    path.join(process.cwd(), "content", "pages", locale, `${page}.mdx`),
  );
}

// Free-identifier holes so Turbopack builds the `content/pages/*/*.mdx`
// glob (same pattern as importLessonMdx).
async function importPageMdx(locale: string, page: string) {
  return (await import(`../../content/pages/${locale}/${page}.mdx`)).default;
}

export async function getPageContent(locale: Locale, page: string) {
  let contentLocale =
    locale !== DEFAULT_LOCALE && pageExists(locale, page)
      ? locale
      : DEFAULT_LOCALE;
  return importPageMdx(contentLocale, page);
}

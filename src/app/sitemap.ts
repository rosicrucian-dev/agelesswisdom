import { type MetadataRoute } from "next";

import { getSections, lessonUrl } from "@/data/curriculum";
import { DEFAULT_LOCALE, RELEASED_LOCALES, type Locale } from "@/lib/locales";

// Required by `output: 'export'` for metadata routes — emits a static
// /sitemap.xml file at build time instead of treating it as dynamic.
export const dynamic = "force-static";

const SITE = "https://agelesswisdom.school";

// Trailing slashes match the site's canonical URLs (next.config sets
// `trailingSlash: true`, so `/about` redirects to `/about/`).
const staticRoutes = ["/", "/about/"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Each logical page exists once per RELEASED locale: English
  // unprefixed (the build's /en/ tree is hoisted to the root by
  // scripts/hoist-en.ts), translated locales under /<locale>/. All rows
  // carry the same hreflang alternates; x-default points at English.
  // Same convention as ../bota-toolbox.
  function url(locale: Locale, path: string): string {
    if (locale === DEFAULT_LOCALE) return `${SITE}${path}`;
    return `${SITE}/${locale}${path === "/" ? "/" : path}`;
  }
  function entries(path: string): MetadataRoute.Sitemap {
    const alternates = {
      languages: {
        ...Object.fromEntries(RELEASED_LOCALES.map((l) => [l, url(l, path)])),
        "x-default": url(DEFAULT_LOCALE, path),
      },
    };
    return RELEASED_LOCALES.map((locale) => ({
      url: url(locale, path),
      lastModified,
      alternates,
    }));
  }

  return [
    ...staticRoutes,
    ...getSections(DEFAULT_LOCALE).flatMap((section) =>
      section.lessons.map((lesson) => `${lessonUrl(section, lesson)}/`),
    ),
  ].flatMap(entries);
}

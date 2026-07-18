// Locale definitions and URL helpers, ported from ../bota-toolbox (same
// conventions). The site is a static export, so locale routing is
// purely path-based: German lives under /de/..., and English serves
// unprefixed at the root (the build generates English under /en/ and
// scripts/hoist-en.ts moves it to the root of out/; in dev a fallback
// rewrite in next.config.mjs maps unprefixed paths to /en/ so both
// environments share the production URL shape).
//
// ADDING A LOCALE is compiler-guided:
//   1. Add the code to LOCALES and its native name to LOCALE_LABELS.
//   2. Run `npm run gen:translations`, then follow the type errors —
//      per-locale registries are typed Record<TranslationLocale, …>.
// Keep it in UNRELEASED_LOCALES until the translation is validated.

export const LOCALES = ["en", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE = "en" satisfies Locale;

/** The locales that carry translations (everything but English). */
export type TranslationLocale = Exclude<Locale, typeof DEFAULT_LOCALE>;

export const TRANSLATION_LOCALES = LOCALES.filter(
  (l): l is TranslationLocale => l !== DEFAULT_LOCALE,
);

// Native-language display names for the language switcher (each entry
// labelled in its own tongue — that's who it's for).
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
};

// Locales still being translated: fully built and reachable by direct
// URL (/de/… — that's how the translator previews their work), but
// hidden from the language switcher, the first-visit bounce, and the
// sitemap until validated. Remove a locale from this list to launch it.
export const UNRELEASED_LOCALES: readonly Locale[] = ["de"];

/** Locales offered to users (switcher, bounce, sitemap). */
export const RELEASED_LOCALES = LOCALES.filter(
  (l) => !UNRELEASED_LOCALES.includes(l),
);

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Narrow a route param to a Locale. Next's route validators want params
 * typed as plain strings; dynamicParams=false on the [locale] layout
 * guarantees only real locales ever reach a page, so this is just the
 * type-level bridge (falling back to English defensively).
 */
export function toLocale(value: string): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Prefix an internal path for a locale: "/section-a/x/" →
 * "/de/section-a/x/" for German, unchanged for English. External URLs,
 * hash/query-only hrefs, and already-prefixed paths pass through.
 * (basePath is NOT handled here — next/link adds it; imperative
 * navigation must prepend NEXT_PUBLIC_BASE_PATH itself.)
 */
export function localeHref(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (!path.startsWith("/")) return path;
  if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path;
  return `/${locale}${path}`;
}

/**
 * Split a pathname into its locale and the unprefixed path. Use the
 * returned path for any pathname comparison so English and German
 * behave identically.
 */
export function stripLocale(pathname: string): {
  locale: Locale;
  path: string;
} {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}` || pathname === `/${locale}/`) {
      return { locale, path: "/" };
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

const PREF_KEY = "botacourse:locale";

/** Persist the user's explicit language choice (read by the first-visit
 * bounce in the [locale] layout; an explicit pick always wins). */
export function saveLocalePref(locale: Locale): void {
  try {
    window.localStorage.setItem(PREF_KEY, locale);
  } catch {
    // Private browsing / storage disabled — fail silently.
  }
}

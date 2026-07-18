// UI chrome translation, same conventions as ../bota-toolbox:
// content/messages/<locale>.json are FULL sibling files — en.json is
// the source, translated siblings are the same file with values
// translated in place (synced by `npm run gen:translations`). A missing
// translated key falls back to English; unknown keys warn at load.
// Statically imported (no fs) so client components can use it too.

import de from "../../content/messages/de.json";
import en from "../../content/messages/en.json";

import { DEFAULT_LOCALE, type Locale, type TranslationLocale } from "./locales";

export type MessageKey = keyof typeof en;

const english: Record<string, string> = en;

// Record<TranslationLocale, …>: adding a locale to LOCALES makes tsc
// flag the missing dictionary import here.
const dictionaries: Record<TranslationLocale, Record<string, string>> = {
  de: de as Record<string, string>,
};

{
  for (const [locale, dict] of Object.entries(dictionaries)) {
    for (const key of Object.keys(dict)) {
      if (!(key in en)) {
        console.warn(
          `[i18n] messages/${locale}.json: key "${key}" is not in en.json — was the English key renamed? This translation no longer renders.`,
        );
      }
    }
  }
}

export function t(locale: Locale, key: MessageKey): string {
  if (locale === DEFAULT_LOCALE) return english[key];
  return dictionaries[locale as TranslationLocale]?.[key] ?? english[key];
}

/** t() with simple `{var}` interpolation, e.g. tf(locale, "overview.lessons", { n: 92 }). */
export function tf(
  locale: Locale,
  key: MessageKey,
  vars: Record<string, string | number>,
): string {
  let out = t(locale, key);
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

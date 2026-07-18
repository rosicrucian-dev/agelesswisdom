"use client";

import { useLocale } from "@/components/locale-provider";
import {
  LOCALE_LABELS,
  RELEASED_LOCALES,
  localeHref,
  saveLocalePref,
  stripLocale,
  type Locale,
} from "@/lib/locales";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { usePathname } from "next/navigation";

// Navbar language dropdown, ported from ../bota-toolbox. The button
// shows the current locale; the menu lists released languages in their
// own tongue. Picking one saves the preference and jumps to the same
// page in that locale as a FULL navigation on purpose: a locale switch
// swaps the top-level [locale] segment, so a client-side navigation
// re-renders the entire tree — loading the target page's static HTML
// directly is faster and guarantees <html lang> and metadata are
// rebuilt. Hidden while only one locale is released.

const LANGUAGES: ReadonlyArray<{ id: Locale; label: string }> =
  RELEASED_LOCALES.map((id) => ({ id, label: LOCALE_LABELS[id] }));

function CheckIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.427-.003l-3.5-3.6a1 1 0 1 1 1.434-1.394l2.788 2.868 6.785-6.877a1 1 0 0 1 1.414-.008Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  // With a single released locale there is nothing to switch to — keep
  // the navbar clean until a translation launches.
  if (LANGUAGES.length < 2) return null;

  function switchTo(target: Locale) {
    if (target === locale) return;
    saveLocalePref(target);
    const { path } = stripLocale(pathname);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    window.location.assign(
      base + localeHref(target, path) + window.location.search,
    );
  }

  return (
    <Menu>
      <MenuButton
        className="flex h-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold tracking-tight text-gray-950 uppercase hover:bg-gray-950/5 data-open:bg-gray-950/5 dark:text-white dark:hover:bg-white/5 dark:data-open:bg-white/5"
        aria-label="Language"
      >
        {locale}
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-2 w-36 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-gray-950/10 focus:outline-none dark:bg-gray-900 dark:ring-white/10"
      >
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang.id}>
            <button
              type="button"
              lang={lang.id}
              onClick={() => switchTo(lang.id)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-gray-700 data-focus:bg-gray-950/5 dark:text-gray-300 dark:data-focus:bg-white/5"
            >
              {lang.label}
              {lang.id === locale && (
                <CheckIcon className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

"use client";

import { useLocale } from "@/components/locale-provider";
import { useMemo } from "react";
import { t, tf, type MessageKey } from "./messages";

/**
 * Client-side chrome translation bound to the current page's locale.
 * Returned callbacks are referentially stable per locale, so they can
 * sit in hook dependency arrays without defeating memoization.
 */
export function useT() {
  const locale = useLocale();
  return useMemo(
    () => ({
      t: (key: MessageKey) => t(locale, key),
      tf: (key: MessageKey, vars: Record<string, string | number>) =>
        tf(locale, key, vars),
    }),
    [locale],
  );
}

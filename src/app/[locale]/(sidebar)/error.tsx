"use client";

import { useEffect } from "react";

import { useT } from "@/lib/use-t";
import {
  canRecoverFromVersionSkew,
  recoverFromVersionSkew,
} from "@/lib/version-skew";

// Segment error boundary for the sidebar shell. Renders inside
// (sidebar)/layout, so the sidebar/nav stay put. A stale-build (version-skew)
// navigation self-heals with a single reload; any other error shows a
// recoverable fallback with Try again (re-render the segment) / Reload.
export default function SidebarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Decided during render (a pure check) so a routine deploy never flashes the
  // "something went wrong" copy; the effect then performs the reload. When the
  // guard says no (the error survived a reload, so it's a real bug) we render
  // the visible fallback straight away.
  const { t } = useT();
  const reloading = canRecoverFromVersionSkew(error);

  useEffect(() => {
    if (reloading) recoverFromVersionSkew(error);
  }, [error, reloading]);

  if (reloading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
        <p className="text-base text-gray-600 dark:text-gray-400">
          {t("error.updating")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {t("error.kicker")}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        {t("error.title")}
      </h1>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
        {t("error.body")}
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {t("error.tryAgain")}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-900 ring-1 ring-gray-300 transition ring-inset hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-gray-800"
        >
          {t("error.reload")}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { isVersionSkewError, recoverFromVersionSkew } from "@/lib/version-skew";

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
  // Start in the "reloading" state for skew errors so we never flash the
  // "something went wrong" copy for a routine deploy; the effect then performs
  // the guarded reload. If the guard blocks it (the error survived a reload,
  // so it's a real bug) we drop to the visible fallback.
  const [reloading, setReloading] = useState(() => isVersionSkewError(error));

  useEffect(() => {
    if (!isVersionSkewError(error)) return;
    if (!recoverFromVersionSkew(error)) setReloading(false);
  }, [error]);

  if (reloading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
        <p className="text-base text-gray-600 dark:text-gray-400">Updating…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        This page hit an error
      </h1>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
        Try again, or reload to get the latest version of the app.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-900 ring-1 ring-gray-300 ring-inset transition hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-gray-800"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

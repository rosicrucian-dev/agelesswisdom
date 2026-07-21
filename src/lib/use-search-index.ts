import { useCallback, useEffect, useState } from "react";

import type { SearchIndex } from "@/lib/search";

// Fetch the current locale's search index on mount and cache it (per locale) for
// the session. SSR-safe: the fetch only runs in the effect, on the client.
// `status` lets the dialog show a loading state vs. an error + Retry.
// (Mirrors botatoolbox's useSearchIndex; the fetch is keyed by locale here since
// agelesswisdom ships one index per locale.)
const cache = new Map<string, Promise<SearchIndex>>();
function fetchIndex(locale: string): Promise<SearchIndex> {
  let promise = cache.get(locale);
  if (!promise) {
    promise = fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search-index.${locale}.json`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`search index: HTTP ${res.status}`);
        return res.json() as Promise<SearchIndex>;
      })
      .catch((err) => {
        cache.delete(locale); // don't cache a failure — allow retry
        throw err;
      });
    cache.set(locale, promise);
  }
  return promise;
}

export type SearchIndexState =
  | { status: "loading"; index: null }
  | { status: "ready"; index: SearchIndex }
  | { status: "error"; index: null };

export function useSearchIndex(locale: string): SearchIndexState & {
  retry: () => void;
} {
  const [state, setState] = useState<SearchIndexState>({
    status: "loading",
    index: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchIndex(locale)
      .then((index) => {
        if (alive) setState({ status: "ready", index });
      })
      .catch(() => {
        if (alive) setState({ status: "error", index: null });
      });
    return () => {
      alive = false;
    };
  }, [locale, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", index: null });
    setAttempt((a) => a + 1);
  }, []);

  return { ...state, retry };
}

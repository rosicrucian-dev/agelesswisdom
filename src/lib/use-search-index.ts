// Fetch a prebuilt search index and cache it for the session.
//
// ⚠ KEEP BYTE-IDENTICAL with the sibling project, like search-engine.ts —
//   FIX BOTH when you change it:
//     botatoolbox:   src/lib/use-search-index.ts
//     agelesswisdom: src/lib/use-search-index.ts
//   Generic over the index type and keyed by URL precisely so it can be: a
//   caller passes its own index type and works out its own URL (per locale, per
//   collection), and nothing project-specific leaks in here.
//
// SSR-safe: the fetch only runs in the effect, on the client. `status` lets a
// dialog show loading vs. an error with a retry.

import { useCallback, useEffect, useState } from 'react'

// Keyed by URL so distinct indexes — a second locale, another collection —
// never clobber each other's entry.
const cache = new Map<string, Promise<unknown>>()

function fetchIndex<Index>(url: string): Promise<Index> {
  let promise = cache.get(url)
  if (!promise) {
    promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`search index ${url}: HTTP ${res.status}`)
        return res.json()
      })
      .catch((err) => {
        cache.delete(url) // don't cache a failure — allow retry
        throw err
      })
    cache.set(url, promise)
  }
  return promise as Promise<Index>
}

export type SearchIndexState<Index> =
  | { status: 'loading'; index: null }
  | { status: 'ready'; index: Index }
  | { status: 'error'; index: null }

export function useSearchIndex<Index>(
  url: string,
): SearchIndexState<Index> & { retry: () => void } {
  const [state, setState] = useState<SearchIndexState<Index>>({
    status: 'loading',
    index: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    fetchIndex<Index>(url)
      .then((index) => {
        if (alive) setState({ status: 'ready', index })
      })
      .catch(() => {
        if (alive) setState({ status: 'error', index: null })
      })
    return () => {
      alive = false
    }
  }, [url, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', index: null })
    setAttempt((a) => a + 1)
  }, [])

  return { ...state, retry }
}

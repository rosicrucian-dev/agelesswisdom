// Fetch the snippet sidecars for the results currently on screen.
//
// ⚠ KEEP BYTE-IDENTICAL with the sibling project, like search-engine.ts —
//   FIX BOTH when you change it:
//     botatoolbox:   src/lib/use-snippets.ts
//     agelesswisdom: src/lib/use-snippets.ts
//
// A sidecar is one small JSON per document: the text of each of its blocks
// (lesson paragraphs, transcript paragraphs). Deliberately NOT in the search
// index — that text is the whole corpus, and every reader downloads the index
// just to type a query, so it would be paid for by everyone and used by almost
// nobody. Fetched per displayed row instead.
//
// TUNING: this hook has no limit of its own. The caller decides which rows get
// snippets simply by which URLs it passes — pass the first N, or pass none at
// all to turn snippets off entirely. Keeping the policy at the call site is
// what makes it a one-number change in each project.

import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<string[]>>()

function fetchSidecar(url: string): Promise<string[]> {
  let promise = cache.get(url)
  if (!promise) {
    promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`snippets ${url}: HTTP ${res.status}`)
        return res.json() as Promise<string[]>
      })
      .catch((err) => {
        cache.delete(url) // a failed fetch shouldn't poison later queries
        throw err
      })
    cache.set(url, promise)
  }
  return promise
}

/**
 * Block texts for each requested URL, keyed by that URL. A missing entry just
 * means "not here yet" — a row renders fine without its snippet and fills in on
 * the next paint, so a slow network degrades rather than blocks.
 *
 * Debounced: results change on every keystroke, and firing a dozen requests per
 * character would waste nearly all of them. Cached for the session and shared
 * across queries, which is what makes this cheap in practice — successive
 * searches over the same material mostly re-show documents already fetched.
 */
export function useSnippets(urls: string[]): Map<string, string[]> {
  const [loaded, setLoaded] = useState<Map<string, string[]>>(new Map())
  // Only re-run when the actual set changes, not on every render.
  const key = urls.join('\n')

  useEffect(() => {
    if (!key) return
    let alive = true
    const timer = setTimeout(() => {
      for (const url of urls) {
        fetchSidecar(url)
          .then((blocks) => {
            if (!alive) return
            setLoaded((prev) => {
              if (prev.get(url) === blocks) return prev
              const next = new Map(prev)
              next.set(url, blocks)
              return next
            })
          })
          .catch(() => {
            /* no snippet for this row; it still works */
          })
      }
    }, 150)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return loaded
}

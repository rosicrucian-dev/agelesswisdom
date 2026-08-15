// Reveal more of a long list as the reader scrolls toward its end.
//
// ⚠ KEEP BYTE-IDENTICAL with the sibling project, like search-engine.ts —
//   FIX BOTH when you change it:
//     botatoolbox:   src/lib/use-chunked-limit.ts
//     agelesswisdom: src/lib/use-chunked-limit.ts
//
// Used for search snippets: every result is listed, but only the first `chunk`
// fetch their sidecar. A fixed number assumes people read top-down, and plenty
// don't — flicking to the bottom of a list to see its range is ordinary
// behaviour, and that reader would hit rows with no snippet. This grows the
// number instead, a chunk at a time, so the detail follows them down.
//
// Deliberately a scroll position check rather than per-row IntersectionObservers:
// no refs threaded through row components, no observer lifecycle to manage
// against a list that changes on every keystroke, and if the handler never
// fires the reader simply keeps the first chunk. Nothing breaks.

import { useState, type UIEvent } from 'react'

/** How close to the end counts as "about to need more". Roughly one panel. */
const NEAR_END_PX = 400

export function useChunkedLimit(
  chunk: number,
  /** Total items available; the limit stops growing once it covers them. */
  total: number,
  /** Changing this resets the limit — a new query starts from one chunk. */
  resetKey: string,
): { limit: number; onScroll: (event: UIEvent<HTMLElement>) => void } {
  const [state, setState] = useState({ key: resetKey, limit: chunk })

  // Reset during render rather than in an effect: an effect would paint once
  // at the previous query's limit before correcting itself.
  if (state.key !== resetKey) setState({ key: resetKey, limit: chunk })
  const limit = state.key === resetKey ? state.limit : chunk

  function onScroll(event: UIEvent<HTMLElement>) {
    if (limit >= total) return // everything is already revealed
    const el = event.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= NEAR_END_PX) return
    setState((prev) => ({ key: prev.key, limit: prev.limit + chunk }))
  }

  return { limit, onScroll }
}

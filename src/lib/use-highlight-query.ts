// Mark the searched words on the page a search result opened.
//
// ⚠ KEEP BYTE-IDENTICAL with the sibling project, like search-engine.ts —
//   FIX BOTH when you change it:
//     botatoolbox:   src/lib/use-highlight-query.ts
//     agelesswisdom: src/lib/use-highlight-query.ts
//
// The term travels in `?q=` — the query string, not the fragment, so it can sit
// alongside a `#p12` deep link rather than competing with it.
//
// Phrase-first: the query's words in order, with any punctuation or space
// between, are marked as ONE span — so "Builders of the Adytum" marks the whole
// phrase, not every scattered "of"/"the". If the phrase isn't on the page (a
// loose match), it falls back to the distinctive CONTENT words only (stopwords
// dropped), so common words are never marked on their own.
//
// The marking is done on the live DOM after render — the content is trusted,
// build-time output from our own markdown/MDX — so wrapping matched text nodes
// in <mark> is safe. `dep` re-runs the pass when the rendered content changes.

import { useEffect, type RefObject } from 'react'

import { tokenize } from '@/lib/search-engine'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Wrap every match of `re` inside `container` in <mark> and return the first
// one (or null), so the caller can tell WHICH block the reader landed in.
function markMatches(container: HTMLElement, re: RegExp): HTMLElement | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) textNodes.push(node as Text)

  let first: HTMLElement | null = null
  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    re.lastIndex = 0
    if (!re.test(text)) continue
    re.lastIndex = 0
    const frag = document.createDocumentFragment()
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)))
      }
      const mark = document.createElement('mark')
      mark.className =
        'rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-400/30'
      mark.textContent = m[0]
      if (!first) first = mark
      frag.appendChild(mark)
      last = m.index + m[0].length
      if (re.lastIndex === m.index) re.lastIndex++ // guard against zero-width
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)))
    }
    textNode.parentNode?.replaceChild(frag, textNode)
  }
  // Only take the reader somewhere if nothing else already has. A `#p12` deep
  // link means the browser has ALREADY put them at the passage the result was
  // about, which is chosen from the index and is not always the document's
  // first match — scrolling here would drag them somewhere else.
  if (!window.location.hash) first?.scrollIntoView({ block: 'center' })
  return first
}

export function useHighlightQuery(
  ref: RefObject<HTMLElement | null>,
  {
    dep,
    locale,
    onLand,
  }: {
    /** Re-run the marking pass when this changes (e.g. the lesson slug). */
    dep?: unknown
    /**
     * Locale of the TEXT ON THE PAGE — which is not always the locale in the
     * URL, since an untranslated page falls back to the English original. It
     * picks the stopword list for the content-word fallback below; getting it
     * wrong marks the destination language's stopwords ("der", "die", "und")
     * while dropping its real words, which is precisely what that fallback
     * exists to avoid. Defaults to English.
     */
    locale?: string
    /**
     * Called with the index of the `[data-para]` block the first match landed
     * in, and how far through its text the match sits, when the container
     * numbers its blocks. Lets a player cue audio to the moment the words are
     * spoken; pages with nothing to cue simply omit it.
     */
    onLand?: (blockIndex: number, fraction: number) => void
  } = {},
): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const q = new URLSearchParams(window.location.search).get('q')?.trim()
    if (!q) return

    // Phrase: the query's word runs in order, joined by non-word gaps.
    const words = q.match(/[\p{L}\p{N}']+/gu) ?? []
    if (words.length === 0) return
    const phrase = new RegExp(
      '\\b' + words.map(escapeRegExp).join('\\W+') + '\\b',
      'giu',
    )
    // Report the block a match landed in, if the container numbers them, and
    // how far through its text the match sits.
    const land = (mark: HTMLElement | null): boolean => {
      if (!mark) return false
      const para = mark.closest<HTMLElement>('[data-para]')
      const index = para?.dataset.para
      if (para && index !== undefined) {
        const before = document.createRange()
        before.setStart(para, 0)
        before.setEndBefore(mark)
        const total = para.textContent?.length ?? 0
        onLand?.(Number(index), total ? before.toString().length / total : 0)
      }
      return true
    }

    if (land(markMatches(container, phrase))) return

    // Fallback: distinctive content words only (stopwords dropped).
    const content = tokenize(q, locale)
    if (content.length === 0) return
    const wordsRe = new RegExp(
      '\\b(' + content.map(escapeRegExp).join('|') + ')\\b',
      'giu',
    )
    land(markMatches(container, wordsRe))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep, locale])
}

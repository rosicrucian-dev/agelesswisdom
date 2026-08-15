"use client";

// Full-text search dialog: a HeadlessUI combobox over the prebuilt inverted
// index in public/search-index.json (see src/lib/search.ts and
// scripts/gen-search-index.ts). Modeled on the sister project's
// (bota-toolbox) SearchDialog, adapted from a title index to full text.
// Default-exported so next/dynamic in search.tsx can lazy-load this chunk on
// first use; the index itself is fetched only when the dialog first opens.

import { useLocaleRouter } from "@/components/locale-link";
import { useLocale } from "@/components/locale-provider";
import { SearchIcon } from "@/icons/search-icon";
import {
  highlightParts,
  matchRanges,
  parseQuery,
  resultBlock,
  resultHref,
  searchIndexUrl,
  searchLessons,
  snippetParts,
  snippetUrl,
  type SearchIndex,
  type SearchResult,
  type SnippetPart,
} from "@/lib/search";
import { useChunkedLimit } from "@/lib/use-chunked-limit";
import { useSearchIndex } from "@/lib/use-search-index";
import { useSnippets } from "@/lib/use-snippets";
import { useT } from "@/lib/use-t";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import { clsx } from "clsx";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

/**
 * How many results get a snippet AT A TIME. Every match is listed; these pay
 * for their sidecar fetch (~6 KB gzipped each), and scrolling toward the end
 * reveals another chunk (see useChunkedLimit). So this is the bandwidth-vs-
 * detail dial, not a ceiling — set it to 0 to turn snippets off entirely.
 *
 * A session can never exceed the whole corpus (0.9 MB gzipped), which the
 * service worker then keeps. Same number in botatoolbox's dialog.
 */
const SNIPPET_ROWS = 25;

/** Renders text split by snippetParts, emphasising the matched words. Used for
 *  both the title and the snippet so a row marks the same words in both. */
function Marked({ parts }: { parts: SnippetPart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark
            key={i}
            className="bg-transparent font-semibold text-current dark:text-current"
          >
            {part.text}
          </mark>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The passage to SHOW for a result, once its sidecar has arrived.
 *
 * `block` is where the result LINKS — the anchored block whose token span
 * contains the match. That is the right destination but not always the right
 * quotation: a span begins at the heading that introduces it, so a hit in a
 * heading resolves to a paragraph whose own text never contains the words, and
 * the reader would get an unmarked snippet under a marked title. Prefer the
 * linked block, fall back to the first block that visibly matches, and failing
 * both show how the lesson opens (which is also the title-hit case, where there
 * is no block of its own). Same rule as botatoolbox's dialog.
 */
function pickSnippet(
  blocks: string[] | undefined,
  block: number,
  tokens: string[],
): SnippetPart[] | null {
  if (!blocks?.length) return null;
  const linked = blocks[block < 0 ? 0 : block];
  if (linked && matchRanges(linked, tokens).length > 0) {
    return snippetParts(linked, tokens);
  }
  const visible = blocks.find((b) => matchRanges(b, tokens).length > 0);
  return snippetParts(visible ?? linked ?? blocks[0], tokens);
}

export default function SearchDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const router = useLocaleRouter();
  const { t, tf } = useT();
  const locale = useLocale();
  let pathname = usePathname();
  let [query, setQuery] = useState("");
  const { status, index, retry } = useSearchIndex<SearchIndex>(
    searchIndexUrl(locale),
  );

  // Close (and reset) when navigation completes — but not on mount, which
  // happens the moment the user first opens the dialog.
  let previousPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== previousPathname.current) {
      previousPathname.current = pathname;
      setOpen(false);
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Tokenize/query with the locale the INDEX was built with, not the page
  // locale — an untranslated locale is indexed as English (see
  // scripts/gen-search-index.ts), and the two sides must agree.
  const queryLocale = index?.locale ?? locale;

  const results = useMemo(
    () =>
      index && query.trim() ? searchLessons(index, query, queryLocale) : [],
    [index, query, queryLocale],
  );

  const segments = useMemo(
    () => parseQuery(query, queryLocale),
    [query, queryLocale],
  );
  // A multi-word query matches either as a contiguous phrase or with the words
  // merely scattered through the lesson; the count column reports whichever
  // this is. The ordering already puts phrase matches first.
  const isMultiWord = segments.reduce((n, s) => n + s.tokens.length, 0) > 1;
  // A "quoted" group makes the phrase a hard filter, so an empty result set
  // means something more specific than "no lesson mentions these words".
  const isQuoted = segments.some((s) => s.quoted && s.tokens.length > 1);

  // Block texts for the top rows, so each can show the passage it matched.
  // Arrives after the list does; rows render fine without it.
  // Snippets follow the reader down the list a chunk at a time, so someone who
  // flicks to the bottom doesn't land among rows with no passage shown.
  const { limit: snippetRows, onScroll } = useChunkedLimit(
    SNIPPET_ROWS,
    results.length,
    query,
  );
  // The index's content stamp rides on every sidecar URL so a deploy
  // invalidates them; see snippetUrl.
  const version = index?.version;
  const snippetUrls = useMemo(
    () =>
      results
        .slice(0, snippetRows)
        .map((r) => snippetUrl(queryLocale, r.doc, version)),
    [results, snippetRows, queryLocale, version],
  );
  const snippets = useSnippets(snippetUrls);
  const queryTokens = useMemo(
    () => segments.flatMap((s) => s.tokens),
    [segments],
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
        setQuery("");
      }}
      className="fixed inset-0 z-50"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-950/25 backdrop-blur-xs data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <div className="fixed inset-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-20 lg:px-8 lg:py-[15vh]">
        <DialogPanel
          transition
          // Clear of the notch when the site is running as an installed app.
          style={{ marginTop: "env(safe-area-inset-top)" }}
          className="mx-auto transform-gpu overflow-hidden rounded-lg bg-white shadow-xl ring ring-gray-950/10 data-closed:scale-95 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:max-w-xl dark:bg-gray-900 dark:ring-white/10"
        >
          <Combobox<SearchResult>
            onChange={(result) => {
              if (!result) return;
              // Two separate slots, doing two separate jobs: the FRAGMENT deep
              // links to the matched passage (#p12), and the QUERY STRING
              // carries the words so the page can mark them. They don't
              // compete, so a result can both land you in the right place and
              // show you which words put you there.
              const href = resultHref(result.doc, result.at);
              const [path, anchor] = href.split("#");
              router.push(
                `${path}?q=${encodeURIComponent(query.trim())}` +
                  (anchor ? `#${anchor}` : ""),
              );
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <SearchIcon className="size-5 shrink-0 stroke-gray-500 dark:stroke-gray-400" />
              <ComboboxInput
                autoFocus
                placeholder={t("search.placeholder")}
                className="flex-auto bg-transparent text-base/6 text-gray-950 outline-hidden placeholder:text-gray-500 sm:text-sm/6 dark:text-white dark:placeholder:text-gray-400"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {query.trim() !== "" && (
              <div className="border-t border-gray-950/10 dark:border-white/10">
                {results.length > 0 ? (
                  <ComboboxOptions
                    static
                    onScroll={onScroll}
                    className="max-h-88 overflow-y-auto py-2"
                  >
                    {results.map((result) => {
                      const isPhrase = isMultiWord && result.phrase > 0;
                      const blocks = snippets.get(
                        snippetUrl(queryLocale, result.doc, version),
                      );
                      const snippet = pickSnippet(
                        blocks,
                        resultBlock(result.doc, result.at),
                        queryTokens,
                      );
                      return (
                        <ComboboxOption
                          key={result.doc.href}
                          value={result}
                          className={clsx(
                            "block cursor-default px-4 py-2",
                            "data-focus:bg-gray-950/5 dark:data-focus:bg-white/5",
                          )}
                        >
                          <span className="flex items-baseline gap-x-3">
                            <span className="flex-auto truncate text-sm/6 text-gray-950 dark:text-white">
                              <Marked
                                parts={highlightParts(
                                  result.doc.title,
                                  queryTokens,
                                )}
                              />
                            </span>
                            <span className="shrink-0 text-xs/6 text-gray-500 dark:text-gray-400">
                              {result.doc.section}
                            </span>
                            <span
                              className="w-10 shrink-0 text-right text-xs/6 text-gray-400 tabular-nums dark:text-gray-500"
                              title={tf(
                                isPhrase
                                  ? "search.countPhrase"
                                  : "search.countMentions",
                                {
                                  n: String(
                                    isPhrase ? result.phrase : result.count,
                                  ),
                                },
                              )}
                            >
                              {isPhrase ? result.phrase : result.count}&times;
                            </span>
                          </span>
                          {snippet && (
                            <span className="mt-0.5 line-clamp-2 text-xs/5 text-gray-500 dark:text-gray-400">
                              <Marked parts={snippet} />
                            </span>
                          )}
                        </ComboboxOption>
                      );
                    })}
                  </ComboboxOptions>
                ) : status === "error" ? (
                  <p className="px-4 py-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
                    {t("search.unavailable")}{" "}
                    <button
                      type="button"
                      onClick={retry}
                      className="font-medium text-gray-950 underline dark:text-white"
                    >
                      {t("search.retry")}
                    </button>
                  </p>
                ) : status === "loading" ? (
                  <p className="px-4 py-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
                    {t("search.loading")}
                  </p>
                ) : (
                  <p className="px-4 py-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
                    {tf(isQuoted ? "search.noPhrase" : "search.noResults", {
                      // Strip the delimiters — the message quotes it already.
                      query: query.trim().replace(/["“”]/g, ""),
                    })}
                  </p>
                )}
              </div>
            )}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

"use client";

// Full-text search dialog: a HeadlessUI combobox over the prebuilt index in
// public/search-index.<locale>.json (see src/lib/search.ts and
// scripts/gen-search-index.ts), queried with @rosicrucian/search.
// Modeled on the sister project's (botatoolbox) CollectionSearchDialog.
// Default-exported so next/dynamic in search.tsx can lazy-load this chunk on
// first use; the index itself is fetched only when the dialog first opens.

import { useLocaleRouter } from "@/components/locale-link";
import { useLocale } from "@/components/locale-provider";
import { SearchIcon } from "@/icons/search-icon";
import {
  resultHref,
  searchIndexUrl,
  snippetUrl,
  type LessonIndex,
  type LessonMeta,
  type LessonResult,
} from "@/lib/search";
import { useChunkedLimit } from "@/lib/use-chunked-limit";
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
import {
  highlight,
  IndexFormatError,
  parseQuery,
  search,
  type Part,
  type Query,
} from "@rosicrucian/search";
import { useSearchIndex, useSectionTexts } from "@rosicrucian/search/react";
import { clsx } from "clsx";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

/**
 * How many results get an excerpt AT A TIME. Every match is listed; these pay
 * for their section-text fetch (~6 KB gzipped each), and scrolling toward the
 * end reveals another chunk (see useChunkedLimit). So this is the bandwidth-vs-
 * detail dial, not a ceiling — set it to 0 to turn excerpts off entirely.
 *
 * A session can never exceed the whole corpus (0.9 MB gzipped), which the
 * service worker then keeps. Same number in botatoolbox's dialog.
 */
const SNIPPET_ROWS = 25;

/** About how many characters of the matched passage to show. */
const EXCERPT_CHARS = 190;

/** Renders text split by `highlight`, emphasising the matched words. Used for
 *  both the title and the excerpt so a row marks the same words in both. */
function Marked({ parts }: { parts: Part[] }) {
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
  const pathname = usePathname();
  const [text, setText] = useState("");
  const { status, index, error, retry } = useSearchIndex<LessonMeta>(
    searchIndexUrl(locale),
  );

  // Close (and reset) when navigation completes — but not on mount, which
  // happens the moment the user first opens the dialog.
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== previousPathname.current) {
      previousPathname.current = pathname;
      setOpen(false);
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Parse once per keystroke with the index's OWN tokenizer (recorded in its
  // header — an untranslated locale is indexed as English, and the two sides
  // must agree); every row reuses the parsed query.
  const query = useMemo(
    () => (index ? parseQuery(index, text) : null),
    [index, text],
  );

  // Every match is listed; the dialog pays only for the excerpts of the first
  // few, so nothing is hidden from the reader. Memoized because this component
  // re-renders once per arriving section file.
  const results = useMemo(
    () => (index && query && query.terms.length ? search(index, query) : []),
    [index, query],
  );

  // A multi-word query matches either as a contiguous phrase or with the words
  // merely scattered through the lesson; the count column reports whichever
  // this is. The ordering already puts phrase matches first.
  const isMultiWord = (query?.terms.length ?? 0) > 1;
  // A "quoted" group makes the phrase a hard filter, so an empty result set
  // means something more specific than "no lesson mentions these words".
  const isQuoted = (query?.phrases.length ?? 0) > 0;

  // Excerpts follow the reader down the list a chunk at a time, so someone who
  // flicks to the bottom doesn't land among rows with no passage shown.
  const { limit: excerptRows, onScroll } = useChunkedLimit(
    SNIPPET_ROWS,
    results.length,
    text,
  );
  // The index's content stamp rides on every section-text URL so a deploy
  // invalidates them; see snippetUrl.
  const stamp = index?.stamp;
  const sectionUrls = useMemo(
    () =>
      results.slice(0, excerptRows).map((r) => snippetUrl(locale, r.id, stamp)),
    [results, excerptRows, locale, stamp],
  );
  const sectionTexts = useSectionTexts(sectionUrls);

  // Which passage to show: the one the result links to — `best.section`, the
  // first phrase hit, else the rarest word's. A heading section carries the
  // anchor of the paragraph beneath it, so a heading hit excerpts the heading
  // (marked) and links under it. For a title-only hit, the lesson's opening.
  const excerptFor = useMemo(() => {
    const byId = new Map<string, Part[]>();
    if (!index || !query) return byId;
    for (const result of results.slice(0, excerptRows)) {
      const texts = sectionTexts.get(snippetUrl(locale, result.id, stamp));
      if (!texts?.length) continue;
      const section =
        result.best.where === "body" ? (result.best.section ?? 0) : 0;
      const passage = texts[section] ?? texts[0];
      byId.set(
        result.id,
        highlight(index, passage, query, { window: EXCERPT_CHARS }),
      );
    }
    return byId;
  }, [index, query, results, excerptRows, sectionTexts, locale, stamp]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
        setText("");
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
          <Combobox<LessonResult>
            onChange={(result) => {
              if (!result) return;
              // Two separate slots, doing two separate jobs: the FRAGMENT deep
              // links to the matched passage (#p12), and the QUERY STRING
              // carries the words so the page can mark them. They don't
              // compete, so a result can both land you in the right place and
              // show you which words put you there.
              const href = resultHref(result);
              const [path, anchor] = href.split("#");
              router.push(
                `${path}?q=${encodeURIComponent(text.trim())}` +
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
                onChange={(event) => setText(event.target.value)}
              />
            </div>
            {text.trim() !== "" && (
              <div className="border-t border-gray-950/10 dark:border-white/10">
                {results.length > 0 && index && query ? (
                  <ComboboxOptions
                    static
                    onScroll={onScroll}
                    className="max-h-88 overflow-y-auto py-2"
                  >
                    {results.map((result) => {
                      const isPhrase = isMultiWord && result.phrase > 0;
                      const excerpt = excerptFor.get(result.id);
                      return (
                        <ComboboxOption
                          key={result.id}
                          value={result}
                          className={clsx(
                            "block cursor-default px-4 py-2",
                            "data-focus:bg-gray-950/5 dark:data-focus:bg-white/5",
                          )}
                        >
                          <span className="flex items-baseline gap-x-3">
                            <span className="flex-auto truncate text-sm/6 text-gray-950 dark:text-white">
                              <Marked
                                parts={highlight(index, result.title, query)}
                              />
                            </span>
                            <span className="shrink-0 text-xs/6 text-gray-500 dark:text-gray-400">
                              {result.meta?.section}
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
                          {excerpt && (
                            <span className="mt-0.5 line-clamp-2 text-xs/5 text-gray-500 dark:text-gray-400">
                              <Marked parts={excerpt} />
                            </span>
                          )}
                        </ComboboxOption>
                      );
                    })}
                  </ComboboxOptions>
                ) : status === "error" && error instanceof IndexFormatError ? (
                  // A stale service worker served last deploy's index to new
                  // code. Retrying would fetch the same cached file; a reload
                  // lets the new worker take over and fetch the fresh one.
                  <p className="px-4 py-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
                    {t("search.outdated")}{" "}
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="font-medium text-gray-950 underline dark:text-white"
                    >
                      {t("search.reload")}
                    </button>
                  </p>
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
                      query: text.trim().replace(/["“”]/g, ""),
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

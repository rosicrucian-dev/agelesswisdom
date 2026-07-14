"use client";

// Full-text search dialog: a HeadlessUI combobox over the prebuilt inverted
// index in public/search-index.json (see src/lib/search.ts and
// scripts/gen-search-index.ts). Modeled on the sister project's
// (bota-toolbox) SearchDialog, adapted from a title index to full text.
// Default-exported so next/dynamic in search.tsx can lazy-load this chunk on
// first use; the index itself is fetched only when the dialog first opens.

import { SearchIcon } from "@/icons/search-icon";
import { searchIndex, type SearchIndex, type SearchResult } from "@/lib/search";
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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

// Fetched once per session, shared across dialog opens.
let indexPromise: Promise<SearchIndex> | undefined;
function loadIndex(): Promise<SearchIndex> {
  return (indexPromise ??= fetch(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search-index.json`,
  ).then((res) => {
    if (!res.ok) {
      indexPromise = undefined;
      throw new Error(`search index: HTTP ${res.status}`);
    }
    return res.json();
  }));
}

export default function SearchDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  let router = useRouter();
  let pathname = usePathname();
  let [query, setQuery] = useState("");
  let [index, setIndex] = useState<SearchIndex>();
  let [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || index) return;
    let cancelled = false;
    loadIndex().then(
      (idx) => {
        if (!cancelled) setIndex(idx);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, index]);

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

  let results = useMemo(
    () => (index && query.trim() ? searchIndex(index, query) : []),
    [index, query],
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
      <DialogBackdrop className="fixed inset-0 bg-gray-950/25 backdrop-blur-xs" />
      <div className="fixed inset-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-20 lg:px-8 lg:py-[15vh]">
        <DialogPanel className="mx-auto transform-gpu overflow-hidden rounded-lg bg-white shadow-xl ring ring-gray-950/10 sm:max-w-xl dark:bg-gray-900 dark:ring-white/10">
          <Combobox<SearchResult>
            onChange={(result) => {
              if (result) router.push(result.lesson.href);
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <SearchIcon className="stroke-gray-500 dark:stroke-gray-400" />
              <ComboboxInput
                autoFocus
                placeholder="Search the lessons..."
                className="flex-auto bg-transparent text-base/6 text-gray-950 outline-hidden placeholder:text-gray-500 sm:text-sm/6 dark:text-white dark:placeholder:text-gray-400"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {query.trim() !== "" && (
              <div className="border-t border-gray-950/10 dark:border-white/10">
                {results.length > 0 ? (
                  <ComboboxOptions
                    static
                    className="max-h-88 overflow-y-auto py-2"
                  >
                    {results.map((result) => (
                      <ComboboxOption
                        key={result.lesson.href}
                        value={result}
                        className={clsx(
                          "flex cursor-default items-baseline gap-x-3 px-4 py-2",
                          "data-focus:bg-gray-950/5 dark:data-focus:bg-white/5",
                        )}
                      >
                        <span className="flex-auto truncate text-sm/6 text-gray-950 dark:text-white">
                          {result.lesson.title}
                        </span>
                        <span className="shrink-0 text-xs/6 text-gray-500 dark:text-gray-400">
                          {result.lesson.section}
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs/6 text-gray-400 tabular-nums dark:text-gray-500">
                          {result.count}&times;
                        </span>
                      </ComboboxOption>
                    ))}
                  </ComboboxOptions>
                ) : (
                  <p className="px-4 py-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
                    {failed
                      ? "Search is unavailable right now."
                      : index
                        ? `No lessons mention “${query.trim()}”.`
                        : "Loading the index…"}
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

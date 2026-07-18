"use client";

// Search trigger (navbar icon + Cmd/Ctrl-K shortcut). Same split as the
// sister project (bota-toolbox): the dialog is lazy-loaded via next/dynamic
// so neither its chunk nor the search index is paid for until first use; the
// keyboard shortcut lives out here in the always-loaded shell so it works
// before that first load.

import { IconButton } from "@/components/icon-button";
import { SearchIcon } from "@/icons/search-icon";
import { useT } from "@/lib/use-t";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SearchDialog = dynamic(() => import("./search-dialog"), {
  ssr: false,
  loading: () => null,
});

export function Search({ className }: { className?: string }) {
  const { t } = useT();
  let [open, setOpen] = useState(false);
  // The dialog only mounts once search has been used, then stays mounted so
  // the fetched index and dialog state survive re-opens.
  let [everOpened, setEverOpened] = useState(false);

  function openSearch() {
    setEverOpened(true);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setEverOpened(true);
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <IconButton
        className={className}
        aria-label={t("search.label")}
        onClick={openSearch}
      >
        <SearchIcon className="stroke-gray-950 dark:stroke-white" />
      </IconButton>
      {everOpened && <SearchDialog open={open} setOpen={setOpen} />}
    </>
  );
}

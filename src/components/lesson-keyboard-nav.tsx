"use client";

// Plain left/right arrow keys page between lessons in reading order.
// Deliberately inert when a modifier is held (Cmd/Alt+arrows are browser
// history/word-jump shortcuts), when typing in an input (e.g. the search
// dialog), or while any dialog is open.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LessonKeyboardNav({
  prevHref,
  nextHref,
}: {
  prevHref?: string;
  nextHref?: string;
}) {
  let router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      let target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      // Any open HeadlessUI dialog (search, mobile nav/sidebar) owns the keys.
      if (document.querySelector("[role='dialog']")) return;

      let href = event.key === "ArrowLeft" ? prevHref : nextHref;
      if (href) {
        event.preventDefault();
        router.push(href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, prevHref, nextHref]);

  return null;
}

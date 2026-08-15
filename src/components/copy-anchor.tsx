"use client";

import { useT } from "@/lib/use-t";
import { useEffect, useRef, useState } from "react";

/**
 * Puts the URL on the clipboard, by whatever means the browser allows.
 *
 * navigator.clipboard only exists in a SECURE CONTEXT — https or localhost.
 * Reading the site from a LAN address (http://192.168.1.x:3001, the usual way
 * to check a phone or another machine against the dev server) is not secure,
 * so the modern API is simply absent there and the copy has to fall back to a
 * hidden textarea + execCommand. Deprecated, still universally implemented,
 * and the only thing that works off-localhost over plain http.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or blocked; fall through to the legacy path.
  }

  try {
    // The reader may well have a passage selected — that is often WHY they are
    // copying a link to it — so put their selection back afterwards.
    let selection = document.getSelection();
    let previous =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    let scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.top = "0";
    scratch.style.left = "0";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    scratch.setSelectionRange(0, text.length);
    let ok = document.execCommand("copy");
    document.body.removeChild(scratch);

    if (previous && selection) {
      selection.removeAllRanges();
      selection.addRange(previous);
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Turns the pilcrow markers emitted by plugins/rehype-lesson-anchors.mjs into
 * "copy a link to this passage" buttons.
 *
 * Progressive enhancement on purpose: the markers are real `<a href="#p12">`
 * elements in the exported HTML, so with JavaScript off (or before hydration)
 * they still navigate. This intercepts the click to put the absolute URL on
 * the clipboard instead, and updates the address bar with replaceState so the
 * page doesn't jump away from what the reader is reading.
 *
 * ONE delegated listener on the content container, rather than a component per
 * block: there are up to 160 markers on a lesson page, and they are static
 * markup the server already rendered.
 */
export function CopyAnchor({
  containerId = "content",
}: {
  containerId?: string;
}) {
  const { t } = useT();
  // Announced politely for screen readers; the visual feedback is the marker
  // swapping to a check.
  const [announcement, setAnnouncement] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let container = document.getElementById(containerId);
    if (!container) return;

    function onClick(event: MouseEvent) {
      // Let modified clicks (open in new tab, save) behave normally.
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      let target = event.target as HTMLElement | null;
      let marker = target?.closest?.(
        "a.anchor-link",
      ) as HTMLAnchorElement | null;
      if (!marker) return;

      let hash = marker.getAttribute("href");
      if (!hash) return;

      // Synchronously, BEFORE any await: preventDefault after the handler has
      // yielded is too late — the browser has already followed the link.
      event.preventDefault();

      let url = `${window.location.origin}${window.location.pathname}${hash}`;

      void copyText(url).then((copied) => {
        // Reflect the anchor in the URL without scrolling — the reader is
        // already looking at the passage they just linked.
        window.history.replaceState(null, "", url);
        if (!copied) return;

        // Swap the inner span, not the <a>: the wrapper carries the baseline
        // metrics (see .anchor-link in typography.css) and replacing the <a>'s
        // textContent would throw the span away along with them.
        let glyph =
          marker.querySelector<HTMLElement>(".anchor-glyph") ?? marker;
        // Remember the glyph on the element, not in a local: a second click
        // while the check is still showing would otherwise capture "✓" as the
        // text to restore and leave the marker stuck on it.
        if (!marker.dataset.glyph) {
          marker.dataset.glyph = glyph.textContent ?? "¶";
        }
        glyph.textContent = "✓";
        marker.dataset.copied = "true";
        setAnnouncement(t("anchor.copied"));
        timers.current.push(
          setTimeout(() => {
            glyph.textContent = marker.dataset.glyph ?? "¶";
            delete marker.dataset.copied;
            setAnnouncement("");
          }, 1500),
        );
      });
    }

    container.addEventListener("click", onClick);
    let pending = timers.current;
    return () => {
      container.removeEventListener("click", onClick);
      pending.forEach(clearTimeout);
      pending.length = 0;
    };
  }, [containerId, t]);

  return (
    <div aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}

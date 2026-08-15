"use client";

// Client wrapper that marks the ?q= search term inside server-rendered
// children. The marking itself lives in the shared use-highlight-query hook,
// byte-identical with botatoolbox; this is only the ref that gives it a
// container, so the lesson body can stay a server component.

import { useHighlightQuery } from "@/lib/use-highlight-query";
import { useRef } from "react";

export function HighlightMatches({
  children,
  dep,
  locale,
  className,
  id,
}: {
  children: React.ReactNode;
  /** Re-run the marking pass when this changes (e.g. the lesson slug). */
  dep?: unknown;
  /**
   * Locale of the text being rendered — the lesson page's `contentLocale`, not
   * the URL locale, since an untranslated lesson serves the English original.
   * Picks the stopword list for the highlighter's content-word fallback.
   */
  locale?: string;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useHighlightQuery(ref, { dep, locale });
  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}

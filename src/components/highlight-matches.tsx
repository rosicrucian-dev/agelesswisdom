"use client";

// Client wrapper that marks the ?q= search term inside server-rendered
// children. The marking itself is the useMarkQuery hook from
// @rosicrucian/search; this is only the ref that gives it a container, so the
// lesson body can stay a server component.

import { SEARCH_MARK_CLASS } from "@/lib/search";
import { useMarkQuery } from "@rosicrucian/search/react";
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
   * It is how the index that produced the link was tokenized, so the marks
   * agree with what the index matched.
   */
  locale?: string;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useMarkQuery(ref, {
    tokenizer: { locale: locale ?? "en" },
    dep,
    className: SEARCH_MARK_CLASS,
  });
  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}

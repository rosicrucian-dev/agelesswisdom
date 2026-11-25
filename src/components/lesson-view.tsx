"use client";

import { useT } from "@/lib/use-t";

import type React from "react";

/**
 * Lesson body: the transcript, under an eyebrow line and a "PDF" button that
 * opens the typeset PDF of the same lesson (scripts/print/lessons.ts,
 * generated at deploy time) in a new tab.
 */
export function LessonView({
  pdfUrl,
  eyebrow,
  children,
}: {
  pdfUrl: string | null;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useT();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {eyebrow ?? <span />}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("lesson.pdfLabel")}
            title={t("lesson.pdfLabel")}
            className="flex items-center rounded-lg px-3 py-1 text-sm/6 font-medium text-gray-600 ring-1 ring-gray-950/10 ring-inset hover:text-gray-950 dark:text-gray-400 dark:ring-white/15 dark:hover:text-white"
          >
            {t("lesson.pdf")}
          </a>
        )}
      </div>

      {children}
    </div>
  );
}

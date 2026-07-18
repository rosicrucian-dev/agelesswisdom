"use client";

import { useT } from "@/lib/use-t";

import type React from "react";

/**
 * Lesson body: the extracted, verified transcript. A typeset PDF of the same
 * lesson (generated locally by editorial/print/lessons.ts) is one click away
 * via the "PDF" button in the header, opening in a new tab.
 */
export function LessonView({
  pdfUrl,
  eyebrow,
  hasText = true,
  children,
}: {
  pdfUrl: string | null;
  eyebrow?: React.ReactNode;
  /** False for "bones" lessons whose transcript hasn't been produced yet. */
  hasText?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useT();
  // The lesson body: the transcript or a placeholder.
  let body = hasText ? children : <PendingNotice />;

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

      {body}
    </div>
  );
}

/**
 * Shown in place of the transcript for "bones" lessons whose text hasn't been
 * produced yet. A downloadable PDF remains available via the PDF button.
 */
function PendingNotice() {
  const { t } = useT();
  return (
    <div
      role="note"
      className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm/6 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
    >
      <p className="font-medium text-gray-950 dark:text-white">
        {t("lesson.transcriptSoonTitle")}
      </p>
      <p className="mx-auto mt-1 max-w-sm">{t("lesson.transcriptSoonBody")}</p>
    </div>
  );
}

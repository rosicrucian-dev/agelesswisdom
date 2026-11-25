"use client";

import { useT } from "@/lib/use-t";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

import type React from "react";

/** The two editions of a lesson's typeset PDF (scripts/print/lessons.ts). */
export type LessonPdfUrls = { print: string; screen: string };

/**
 * Lesson body: the transcript, under an eyebrow line and a "PDF" menu that
 * opens the typeset PDF of the same lesson (scripts/print/lessons.ts,
 * generated at deploy time) in a new tab, in either edition: for printing
 * (US Letter) or for screens. Named as the About page's downloads are.
 */
export function LessonView({
  pdfUrls,
  eyebrow,
  children,
}: {
  pdfUrls: LessonPdfUrls | null;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useT();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {eyebrow ?? <span />}
        {pdfUrls && (
          <Menu>
            <MenuButton
              aria-label={t("lesson.pdfLabel")}
              title={t("lesson.pdfLabel")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm/6 font-medium text-gray-600 ring-1 ring-gray-950/10 ring-inset hover:text-gray-950 data-open:text-gray-950 dark:text-gray-400 dark:ring-white/15 dark:hover:text-white dark:data-open:text-white"
            >
              {t("lesson.pdf")}
              <svg
                viewBox="0 0 8 5"
                fill="none"
                aria-hidden="true"
                className="h-1.5 shrink-0 stroke-current"
              >
                <path
                  d="M1 1L4 4L7 1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              className="z-50 mt-2 w-40 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-gray-950/10 focus:outline-none dark:bg-gray-900 dark:ring-white/10"
            >
              {(
                [
                  ["print", "lesson.pdfPrint"],
                  ["screen", "lesson.pdfScreen"],
                ] as const
              ).map(([edition, label]) => (
                <MenuItem key={edition}>
                  <a
                    href={pdfUrls[edition]}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-gray-700 data-focus:bg-gray-950/5 dark:text-gray-300 dark:data-focus:bg-white/5"
                  >
                    {t(label)}
                    <span aria-hidden="true" className="text-gray-400">
                      ↗
                    </span>
                  </a>
                </MenuItem>
              ))}
            </MenuItems>
          </Menu>
        )}
      </div>

      {children}
    </div>
  );
}

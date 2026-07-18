"use client";

import { IconButton } from "@/components/icon-button";
import { Link } from "@/components/locale-link";
import {
  lessonTitleParts,
  lessonUrl,
  type Section,
} from "@/data/curriculum-helpers";
import { SidebarIcon } from "@/icons/sidebar-icon";
import { useT } from "@/lib/use-t";
import {
  CloseButton,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import { clsx } from "clsx";
import { usePathname } from "next/navigation";
import type React from "react";
import { createContext, useContext, useState } from "react";
import { Navbar } from "./navbar";

export const SidebarContext = createContext<{
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isSidebarOpen: boolean) => void;
  isMobileDialogOpen: boolean;
  setIsMobileDialogOpen: (isMobileDialogOpen: boolean) => void;
}>({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
  isMobileDialogOpen: false,
  setIsMobileDialogOpen: () => {},
});

function CourseNavigation({
  sections,
  onNavigate,
  className,
}: {
  sections: Section[];
  onNavigate?: () => void;
  className?: string;
}) {
  let pathname = usePathname();

  return (
    <div className={clsx(className, "space-y-8")}>
      {sections.map((section) => (
        <div key={section.id}>
          {section.title && (
            <p className="text-xs/5 font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
              {section.title}
            </p>
          )}
          <h2 className="text-base/7 font-semibold text-pretty text-gray-950 sm:text-sm/6 dark:text-white">
            {section.label}
          </h2>
          <ul className="mt-4 flex flex-col gap-4 border-l border-gray-950/10 text-base/7 text-gray-700 sm:mt-3 sm:gap-3 sm:text-sm/6 dark:border-white/10 dark:text-gray-400">
            {section.lessons.map((lesson) => {
              let href = lessonUrl(section, lesson);
              let { unit, title } = lessonTitleParts(section, lesson);
              return (
                <li
                  key={lesson.id}
                  className={clsx(
                    "-ml-px flex border-l border-transparent pl-4",
                    "hover:text-gray-950 hover:not-has-aria-[current=page]:border-gray-400 dark:hover:text-white",
                    "has-aria-[current=page]:border-gray-950 dark:has-aria-[current=page]:border-white",
                  )}
                >
                  <Link
                    href={href}
                    aria-current={
                      pathname === href || pathname === `${href}/`
                        ? "page"
                        : undefined
                    }
                    onNavigate={onNavigate}
                    className="group/link aria-[current=page]:font-medium aria-[current=page]:text-gray-950 dark:aria-[current=page]:text-white"
                  >
                    <span className="block text-xs/5 font-normal text-gray-400 group-aria-[current=page]/link:text-gray-500 dark:text-gray-500 dark:group-aria-[current=page]/link:text-gray-400">
                      {unit}
                    </span>
                    {title && <span className="block">{title}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MobileNavigation({
  open,
  onClose,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  sections: Section[];
}) {
  return (
    <Dialog open={open} onClose={onClose} className="lg:hidden">
      <DialogBackdrop className="fixed inset-0 bg-gray-950/25" />
      <DialogPanel className="fixed inset-y-0 left-0 isolate w-sm max-w-[calc(100%-(--spacing(11)))] overflow-y-auto bg-white ring ring-gray-950/10 sm:w-xs dark:bg-gray-950 dark:ring-white/10">
        <div className="sticky top-0 z-10 px-4 py-4 sm:px-6">
          <div className="flex h-6 shrink-0">
            <CloseButton as={IconButton}>
              <SidebarIcon className="shrink-0 stroke-gray-950 dark:stroke-white" />
            </CloseButton>
          </div>
        </div>
        <CourseNavigation
          sections={sections}
          onNavigate={onClose}
          className="px-4 pb-4 sm:px-6"
        />
      </DialogPanel>
    </Dialog>
  );
}

export function SidebarLayout({
  sections,
  children,
}: {
  sections: Section[];
  children: React.ReactNode;
}) {
  const { t } = useT();
  let [isSidebarOpen, setIsSidebarOpen] = useState(true);
  let [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);

  return (
    <SidebarContext.Provider
      value={{
        isSidebarOpen,
        setIsSidebarOpen,
        isMobileDialogOpen,
        setIsMobileDialogOpen,
      }}
    >
      <div
        data-sidebar-collapsed={isSidebarOpen ? undefined : ""}
        className="group"
      >
        <aside className="fixed inset-y-0 left-0 w-2xs overflow-y-auto border-r border-gray-950/10 group-data-sidebar-collapsed:hidden max-lg:hidden dark:border-white/10">
          <nav aria-label={t("nav.course")} className="px-6 py-4">
            <div className="sticky top-4 flex h-6">
              <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <SidebarIcon className="shrink-0 stroke-gray-950 dark:stroke-white" />
              </IconButton>
              <MobileNavigation
                open={isMobileDialogOpen}
                onClose={() => setIsMobileDialogOpen(false)}
                sections={sections}
              />
            </div>
            <div className="mt-3">
              <CourseNavigation sections={sections} className="max-lg:hidden" />
            </div>
          </nav>
        </aside>
        <div className="lg:not-group-data-sidebar-collapsed:ml-(--container-2xs)">
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

export function SidebarLayoutContent({
  breadcrumbs,
  alwaysShowNavLinks = false,
  children,
}: {
  breadcrumbs: React.ReactNode;
  /** Show the top-nav links (About) inline at all widths rather than behind
      the hamburger. The homepage opts in; lesson pages keep the hamburger. */
  alwaysShowNavLinks?: boolean;
  children: React.ReactNode;
}) {
  let {
    isSidebarOpen,
    setIsSidebarOpen,
    isMobileDialogOpen,
    setIsMobileDialogOpen,
  } = useContext(SidebarContext);

  return (
    <>
      <Navbar alwaysShowLinks={alwaysShowNavLinks}>
        <div className="flex min-w-0 shrink items-center gap-x-4">
          <IconButton
            onClick={() => setIsMobileDialogOpen(!isMobileDialogOpen)}
            className="lg:hidden"
          >
            <SidebarIcon className="shrink-0 stroke-gray-950 dark:stroke-white" />
          </IconButton>
          {!isSidebarOpen && (
            <IconButton
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="max-lg:hidden"
            >
              <SidebarIcon className="shrink-0 stroke-gray-950 dark:stroke-white" />
            </IconButton>
          )}
          <div className="min-w-0">{breadcrumbs}</div>
        </div>
      </Navbar>
      <main className="px-4 sm:px-6">{children}</main>
    </>
  );
}

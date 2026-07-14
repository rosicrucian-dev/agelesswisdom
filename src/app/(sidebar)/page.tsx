import { BreadcrumbHome, Breadcrumbs } from "@/components/breadcrumbs";
import { ContentLink } from "@/components/content-link";
import { Logo } from "@/components/logo";
import { PageSection } from "@/components/page-section";
import { ResumeButton } from "@/components/resume-progress";
import { SidebarLayoutContent } from "@/components/sidebar-layout";
import {
  getSections,
  lessonUrl,
  numberedLessonTitle,
  sectionUrlSlug,
  unitLabelOf,
} from "@/data/curriculum";
import { BookIcon } from "@/icons/book-icon";
import { LessonsIcon } from "@/icons/lessons-icon";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The School of Ageless Wisdom",
  description: "The early curriculum of Paul Foster Case.",
};

export default function Page() {
  let sections = getSections();
  let lessonCount = sections.reduce(
    (n, s) =>
      n + s.lessons.filter((l) => unitLabelOf(s, l) !== "Supplement").length,
    0,
  );

  return (
    <SidebarLayoutContent
      alwaysShowNavLinks
      breadcrumbs={
        <Breadcrumbs>
          <BreadcrumbHome />
        </Breadcrumbs>
      }
    >
      <div className="relative mx-auto max-w-7xl">
        <div
          aria-hidden="true"
          className="absolute -inset-x-2 top-0 -z-10 h-80 overflow-hidden rounded-t-2xl mask-b-from-60% sm:h-88 md:h-112 lg:-inset-x-4 lg:h-128"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-amber-100),transparent_60%),radial-gradient(ellipse_at_bottom_right,var(--color-indigo-100),transparent_60%)] opacity-70 dark:bg-[radial-gradient(ellipse_at_top_left,var(--color-amber-400),transparent_60%),radial-gradient(ellipse_at_bottom_right,var(--color-indigo-400),transparent_60%)] dark:opacity-10" />
          <div className="absolute inset-0 rounded-t-2xl outline-1 -outline-offset-1 outline-gray-950/10 dark:outline-white/10" />
        </div>
        <div className="mx-auto max-w-6xl">
          <div className="relative">
            <div className="px-4 pt-32 pb-12 lg:py-24">
              <h1 className="sr-only">Course overview</h1>
              <Logo />
              <p className="mt-7 text-base/7 text-pretty text-gray-600 dark:text-gray-400">
                In 1923, Paul Foster Case founded the School of Ageless Wisdom,
                which would later become Builders of the Adytum. For the first
                time, the school’s complete curriculum has been centrally
                organized and made available in its original format as weekly
                lessons.
              </p>
              {/* <p className="mt-4 text-sm/6 text-gray-500 dark:text-gray-500">
                Lessons made available by the{" "}
                <a
                  href="https://lvx.org"
                  className="font-medium text-gray-700 underline decoration-gray-400 underline-offset-2 hover:text-gray-950 dark:text-gray-400 dark:decoration-gray-600 dark:hover:text-white"
                >
                  Fraternity of the Hidden Light
                </a>{" "}
                and the{" "}
                <a
                  href="http://www.rogd.org"
                  className="font-medium text-gray-700 underline decoration-gray-400 underline-offset-2 hover:text-gray-950 dark:text-gray-400 dark:decoration-gray-600 dark:hover:text-white"
                >
                  Rosicrucian Order of the Golden Dawn
                </a>
                .
              </p> */}
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm/7 font-semibold text-gray-950 sm:gap-3 dark:text-white">
                <div className="flex items-center gap-1.5">
                  <BookIcon className="stroke-gray-950/40 dark:stroke-white/40" />
                  {sections.length} sections
                </div>
                <span className="hidden text-gray-950/25 sm:inline dark:text-white/25">
                  &middot;
                </span>
                <div className="flex items-center gap-1.5">
                  <LessonsIcon className="stroke-gray-950/40 dark:stroke-white/40" />
                  {lessonCount} lessons
                </div>
              </div>
              <div className="mt-10">
                <ResumeButton
                  firstHref={lessonUrl(sections[0], sections[0].lessons[0])}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-y-16 pb-10 sm:px-4">
              {sections.map((section) => (
                <PageSection
                  key={section.id}
                  id={sectionUrlSlug(section)}
                  title={section.label}
                  subtitle={section.title}
                >
                  <div className="max-w-2xl">
                    <ol className="space-y-4">
                      {section.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <ContentLink
                            title={numberedLessonTitle(section, lesson)}
                            description={lesson.description}
                            href={lessonUrl(section, lesson)}
                            type="article"
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                </PageSection>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayoutContent>
  );
}

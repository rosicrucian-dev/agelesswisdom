import {
  Breadcrumb,
  BreadcrumbHome,
  Breadcrumbs,
  BreadcrumbSeparator,
} from "@/components/breadcrumbs";
import { LessonKeyboardNav } from "@/components/lesson-keyboard-nav";
import { LessonView } from "@/components/lesson-view";
import { NextPageLink } from "@/components/next-page-link";
import { RecordLessonVisit } from "@/components/resume-progress";
import { SidebarLayoutContent } from "@/components/sidebar-layout";
import {
  getAllSections,
  getLesson,
  getLessonContent,
  lessonDiskPath,
  lessonUnitPosition,
  lessonUrl,
  numberedLessonTitle,
  sectionUrlSlug,
} from "@/data/curriculum";
import { DEFAULT_LOCALE, toLocale } from "@/lib/locales";
import { t } from "@/lib/messages";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";

/**
 * Lesson PDFs are produced by `npm run split:pdfs` from the same page
 * ranges that drive extraction. Presence is checked at build time (this
 * page is statically generated), so lessons without a facsimile simply
 * render text-only.
 */
/**
 * Whether a lesson's text transcript exists yet. "Bones" lessons ship the PDF
 * facsimile with the transcript deferred (see `textPending` in extract.ts);
 * for those the Text tab shows a placeholder instead of content.
 */
function lessonHasText(
  locale: string,
  sectionId: string,
  lessonId: string,
): boolean {
  let { dir, file } = lessonDiskPath(sectionId, lessonId);
  let rel = path.join("content", "lessons", locale, dir, `${file}.mdx`);
  return fs.existsSync(path.join(process.cwd(), rel));
}

function lessonPdfUrl(sectionId: string, lessonId: string): string | null {
  let { dir, file } = lessonDiskPath(sectionId, lessonId);
  let rel = `lessons/${dir}/${file}.pdf`;
  if (!fs.existsSync(path.join(process.cwd(), "public", rel))) return null;
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${rel}`;
}

export const dynamicParams = false;

export function generateStaticParams() {
  // Structural (id) enumeration — English source on purpose; the parent
  // [locale] layout's params multiply these across locales.
  return getAllSections(DEFAULT_LOCALE).flatMap((section) =>
    section.lessons.map((lesson) => ({
      section: sectionUrlSlug(section),
      lesson: lesson.id,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; section: string; lesson: string }>;
}): Promise<Metadata> {
  let { locale, section, lesson: lessonId } = await params;
  let lesson = getLesson(toLocale(locale), section, lessonId);

  return {
    title: lesson
      ? `${numberedLessonTitle(lesson.section, lesson)} - ${t(toLocale(locale), "meta.siteTitle")}`
      : t(toLocale(locale), "meta.siteTitle"),
    description: lesson?.description,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; section: string; lesson: string }>;
}) {
  let {
    locale: rawLocale,
    section: sectionId,
    lesson: lessonId,
  } = await params;
  let locale = toLocale(rawLocale);
  let lesson = getLesson(locale, sectionId, lessonId);

  if (!lesson) {
    notFound();
  }

  let position = lessonUnitPosition(lesson.section, lesson);
  // Read the lesson in the page's locale when a translation exists,
  // falling back to the English transcript (partial translation always
  // ships); "bones" lessons with no transcript at all keep their
  // placeholder.
  let contentLocale = lessonHasText(locale, sectionId, lessonId)
    ? locale
    : DEFAULT_LOCALE;
  let hasText = lessonHasText(contentLocale, sectionId, lessonId);
  let Content = hasText
    ? await getLessonContent(contentLocale, sectionId, lessonId)
    : null;
  let currentHref = lessonUrl(lesson.section, lesson);

  return (
    <SidebarLayoutContent
      breadcrumbs={
        <Breadcrumbs>
          <BreadcrumbHome />
          <BreadcrumbSeparator className="max-md:hidden" />
          <Breadcrumb
            href={`/#${sectionUrlSlug(lesson.section)}`}
            className="max-md:hidden"
          >
            {lesson.section.label}
          </Breadcrumb>
          <BreadcrumbSeparator />
          <Breadcrumb>{numberedLessonTitle(lesson.section, lesson)}</Breadcrumb>
        </Breadcrumbs>
      }
    >
      <RecordLessonVisit
        href={currentHref}
        label={lesson.title ?? numberedLessonTitle(lesson.section, lesson)}
      />
      <LessonKeyboardNav
        prevHref={
          lesson.prev
            ? lessonUrl(lesson.prev.section, lesson.prev.lesson)
            : undefined
        }
        nextHref={
          lesson.next
            ? lessonUrl(lesson.next.section, lesson.next.lesson)
            : undefined
        }
      />
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl pt-4 pb-10 sm:pt-6 sm:pb-14">
          <div className="w-full">
            <LessonView
              pdfUrl={lessonPdfUrl(sectionId, lessonId)}
              hasText={hasText}
              eyebrow={
                <p className="text-sm/7 font-semibold tracking-widest text-gray-500 uppercase dark:text-gray-400">
                  {lesson.section.label} · {position.unit} {position.number} of{" "}
                  {position.total}
                </p>
              }
            >
              {Content ? (
                <div id="content" className="prose">
                  <Content />
                </div>
              ) : null}
            </LessonView>
            <div className="mt-16 border-t border-gray-200 pt-8 dark:border-white/10">
              {lesson.next ? (
                <NextPageLink
                  title={numberedLessonTitle(
                    lesson.next.section,
                    lesson.next.lesson,
                  )}
                  description={lesson.next.lesson.description}
                  href={lessonUrl(lesson.next.section, lesson.next.lesson)}
                />
              ) : (
                <NextPageLink
                  title={t(locale, "end.title")}
                  description={t(locale, "end.description")}
                  href="/"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayoutContent>
  );
}

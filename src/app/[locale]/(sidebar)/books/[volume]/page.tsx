import {
  Breadcrumb,
  BreadcrumbHome,
  Breadcrumbs,
  BreadcrumbSeparator,
} from "@/components/breadcrumbs";
import { ContentLink } from "@/components/content-link";
import { Link } from "@/components/locale-link";
import { SidebarLayoutContent } from "@/components/sidebar-layout";
import {
  getSections,
  lessonUrl,
  numberedLessonTitle,
  sectionUrlSlug,
  unitLabelOf,
} from "@/data/curriculum";
import type { Section } from "@/data/curriculum-helpers";
import {
  VOLUMES,
  volumePath,
  volumePdfUrls,
  type Volume,
} from "@/data/volumes";
import { DEFAULT_LOCALE, toLocale, type Locale } from "@/lib/locales";
import { t, tf } from "@/lib/messages";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// A page for each volume the lessons were once printed as (data/volumes.ts):
// what a search for "Wisdom of Tarot pdf" should find. Which of the course
// it is, its lessons, and its PDFs, which are the books repository's.

export const dynamicParams = false;

export function generateStaticParams() {
  return VOLUMES.map((volume) => ({ volume: volume.slug }));
}

function volumeOf(slug: string): Volume {
  const volume = VOLUMES.find((v) => v.slug === slug);
  if (!volume) notFound();
  return volume;
}

function sectionsOf(locale: Locale, volume: Volume): Section[] {
  const all = getSections(locale);
  return volume.sections.map((id) => {
    const section = all.find((s) => s.id === id);
    if (!section) throw new Error(`volume ${volume.slug}: no section ${id}`);
    return section;
  });
}

/** The volume's sections by name: "Section A and Section B". */
function partName(locale: Locale, sections: Section[]): string {
  const labels = sections.map((s) => s.label);
  return labels.length === 2
    ? tf(locale, "volume.and", { a: labels[0], b: labels[1] })
    : labels.join(", ");
}

/** The page's own address, English unprefixed (scripts/hoist-en.ts). */
function pageUrl(locale: Locale, volume: Volume): string {
  const path = `${volumePath(volume)}/`;
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; volume: string }>;
}): Promise<Metadata> {
  const { locale: raw, volume: slug } = await params;
  const locale = toLocale(raw);
  const volume = volumeOf(slug);
  const part = partName(locale, sectionsOf(locale, volume));
  const title = tf(locale, "volume.metaTitle", { title: volume.printedAs });
  const description = tf(locale, "volume.metaDescription", {
    title: volume.printedAs,
    part,
  });
  return {
    title,
    description,
    alternates: { canonical: pageUrl(locale, volume) },
    openGraph: {
      title,
      description,
      url: pageUrl(locale, volume),
      type: "book",
    },
  };
}

/** schema.org's Book: the volume, under its printed title, as part of the
 *  course, with its two PDFs. */
function structuredData(locale: Locale, volume: Volume, part: string) {
  const pdfs = volumePdfUrls(volume);
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: volume.printedAs,
    alternateName: `${SITE_NAME}: ${part}`,
    author: { "@type": "Person", name: "Paul Foster Case" },
    inLanguage: "en",
    isAccessibleForFree: true,
    isPartOf: { "@type": "Book", name: SITE_NAME, url: SITE_URL },
    url: `${SITE_URL}${pageUrl(locale, volume)}`,
    encoding: [
      { name: t(locale, "volume.pdfScreen"), contentUrl: pdfs.screen },
      { name: t(locale, "volume.pdfPrint"), contentUrl: pdfs.print },
    ].map((pdf) => ({
      "@type": "MediaObject",
      ...pdf,
      encodingFormat: "application/pdf",
    })),
  };
}

const link =
  "font-medium text-gray-950 underline decoration-gray-950/25 underline-offset-4 hover:decoration-gray-950 dark:text-white dark:decoration-white/25 dark:hover:decoration-white";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; volume: string }>;
}) {
  const { locale: raw, volume: slug } = await params;
  const locale = toLocale(raw);
  const volume = volumeOf(slug);
  const sections = sectionsOf(locale, volume);
  const part = partName(locale, sections);
  const pdfs = volumePdfUrls(volume);
  const lessonCount = sections.reduce(
    (n, s) =>
      n + s.lessons.filter((l) => unitLabelOf(s, l) !== "Supplement").length,
    0,
  );
  const details: [string, ReactNode][] = [
    [t(locale, "volume.printedAs"), <i key="t">{volume.printedAs}</i>],
    [t(locale, "volume.author"), "Paul Foster Case"],
    [
      t(locale, "volume.course"),
      <Link
        key="c"
        href={`/#${sectionUrlSlug(sections[0])}`}
        className={link}
      >
        {tf(locale, "volume.courseValue", { part })}
      </Link>,
    ],
    [t(locale, "volume.lessonCount"), String(lessonCount)],
  ];

  return (
    <SidebarLayoutContent
      breadcrumbs={
        <Breadcrumbs>
          <BreadcrumbHome />
          <BreadcrumbSeparator />
          <Breadcrumb>{volume.printedAs}</Breadcrumb>
        </Breadcrumbs>
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData(locale, volume, part)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <div className="mx-auto max-w-2xl py-10 sm:py-14">
        <h1 className="text-3xl/10 font-semibold tracking-tight text-pretty text-gray-950 sm:text-4xl/12 dark:text-white">
          {volume.printedAs}
        </h1>
        <p className="mt-1 text-lg/8 text-gray-600 dark:text-gray-400">
          Paul Foster Case
        </p>
        <p className="mt-6 text-base/7 text-pretty text-gray-700 dark:text-gray-300">
          {tf(locale, "volume.intro", { title: volume.printedAs, part })}
        </p>

        <p className="mt-6 text-base/7 text-gray-700 dark:text-gray-300">
          <a href={pdfs.screen} className={link}>
            {t(locale, "volume.pdfScreen")}
          </a>
          <span aria-hidden="true" className="mx-2 text-gray-400">
            ·
          </span>
          <a href={pdfs.print} className={link}>
            {t(locale, "volume.pdfPrint")}
          </a>
        </p>

        <dl className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-gray-950/10 pt-6 text-sm/6 sm:grid-cols-[auto_1fr] dark:border-white/10">
          {details.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-gray-500 dark:text-gray-400">{term}</dt>
              <dd className="mb-2 text-gray-950 sm:mb-0 dark:text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-14 text-xl/8 font-semibold text-gray-950 dark:text-white">
          {t(locale, "volume.contents")}
        </h2>
        {sections.map((section) => (
          <section key={section.id} className="mt-6">
            {sections.length > 1 && (
              <h3 className="mb-3 text-xs/5 font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
                {section.label}
              </h3>
            )}
            <ol className="space-y-4">
              {section.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <ContentLink
                    title={numberedLessonTitle(section, lesson)}
                    description={lesson.description}
                    href={lessonUrl(section, lesson)}
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </SidebarLayoutContent>
  );
}

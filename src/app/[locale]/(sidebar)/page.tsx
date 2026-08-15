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
import { getPageContent } from "@/data/pages";
import { BookIcon } from "@/icons/book-icon";
import { LessonsIcon } from "@/icons/lessons-icon";
import { DEFAULT_LOCALE, RELEASED_LOCALES, toLocale } from "@/lib/locales";
import { t, tf } from "@/lib/messages";
import type { Metadata } from "next";
import { Fragment } from "react";

const SITE = "https://agelesswisdom.school";

// English is served unprefixed (scripts/hoist-en.ts lifts out/en/ to the
// root), every other locale under /<locale>/. Trailing slashes because
// next.config sets `trailingSlash: true`. Same rule the sitemap uses.
function localeUrl(locale: string): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}/`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  let locale = toLocale((await params).locale);
  return {
    title: t(locale, "meta.siteTitle"),
    description: t(locale, "meta.description"),
    // Canonical + hreflang in the document head. The sitemap already
    // carries these alternates, but crawlers weight the in-page tags
    // too, and the canonical is what marks this URL as the domain's
    // homepage — the page Google reads the site name from. Relative
    // paths resolve against the root layout's `metadataBase`.
    // Deliberately scoped to this page rather than the [locale] layout:
    // layout metadata is inherited by every child route, which would
    // stamp the homepage's canonical onto all of them.
    alternates: {
      canonical: localeUrl(locale),
      languages: {
        ...Object.fromEntries(RELEASED_LOCALES.map((l) => [l, localeUrl(l)])),
        "x-default": localeUrl(DEFAULT_LOCALE),
      },
    },
  };
}

// Google builds the site-name line in search results (the bit above the
// URL, which otherwise renders as the bare domain) from, in order of
// preference: WebSite structured data, og:site_name, the homepage
// <title>, then the domain as a last resort. The latter two are already
// correct, but with no structured data anywhere on the site Google falls
// through to the domain — this supplies the source it actually honors.
// Only the homepage needs it: site name is a domain-level property that
// Google extracts from the root. `url` stays the site root in every
// locale, since that identifies the site rather than this document.
// Mirrors the same block in ../botatoolbox's home page.
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "The School of Ageless Wisdom",
  url: SITE,
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  let locale = toLocale((await params).locale);
  let Intro = await getPageContent(locale, "home-intro");
  let sections = getSections(locale);
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
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
              <h1 className="sr-only">{t(locale, "overview.srTitle")}</h1>
              <Logo />
              <div className="mt-7 text-base/7 text-pretty text-gray-600 dark:text-gray-400">
                <Intro />
              </div>
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
                  {tf(locale, "overview.sections", { n: sections.length })}
                </div>
                <span className="hidden text-gray-950/25 sm:inline dark:text-white/25">
                  &middot;
                </span>
                <div className="flex items-center gap-1.5">
                  <LessonsIcon className="stroke-gray-950/40 dark:stroke-white/40" />
                  {tf(locale, "overview.lessons", { n: lessonCount })}
                </div>
              </div>
              <div className="mt-10">
                <ResumeButton
                  firstHref={lessonUrl(sections[0], sections[0].lessons[0])}
                />
              </div>

              <nav
                aria-label={t(locale, "overview.tocLabel")}
                className="mt-10 grid max-w-2xl gap-x-12 gap-y-6 sm:grid-cols-2"
              >
                {[
                  {
                    title: t(locale, "overview.curriculumTitle"),
                    items: sections.filter((s) => !s.additional),
                  },
                  {
                    title: t(locale, "overview.addendumTitle"),
                    items: sections.filter((s) => s.additional),
                  },
                ].map((group) => (
                  <div key={group.title}>
                    <p className="text-xs/5 font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
                      {group.title}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {group.items.map((section) => (
                        <li key={section.id}>
                          <a
                            href={`#${sectionUrlSlug(section)}`}
                            className="text-sm/6 text-gray-700 underline-offset-2 hover:text-gray-950 hover:underline dark:text-gray-300 dark:hover:text-white"
                          >
                            {section.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>

            <div className="grid grid-cols-1 gap-y-16 pb-10 sm:px-4">
              {sections.map((section, idx) => {
                let startsAddenda =
                  section.additional && !sections[idx - 1]?.additional;
                return (
                  <Fragment key={section.id}>
                    {startsAddenda && (
                      <div className="max-w-2xl">
                        <h2 className="text-2xl/8 font-semibold tracking-tight text-gray-950 dark:text-white">
                          {t(locale, "overview.addendumTitle")}
                        </h2>
                        <p className="mt-3 text-base/7 text-pretty text-gray-600 dark:text-gray-400">
                          {t(locale, "overview.addendumNote")}
                        </p>
                      </div>
                    )}
                    <PageSection
                      id={sectionUrlSlug(section)}
                      title={section.label}
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
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayoutContent>
  );
}

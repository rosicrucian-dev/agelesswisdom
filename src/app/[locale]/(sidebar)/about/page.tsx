import {
  Breadcrumb,
  BreadcrumbHome,
  Breadcrumbs,
  BreadcrumbSeparator,
} from "@/components/breadcrumbs";
import { SidebarLayoutContent } from "@/components/sidebar-layout";
import { getPageContent } from "@/data/pages";
import { toLocale } from "@/lib/locales";
import { t } from "@/lib/messages";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  let locale = toLocale((await params).locale);
  return {
    title: `${t(locale, "about.title")} - ${t(locale, "meta.siteTitle")}`,
    description: "About this site",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  let locale = toLocale((await params).locale);
  let Content = await getPageContent(locale, "about");
  return (
    <SidebarLayoutContent
      breadcrumbs={
        <Breadcrumbs>
          <BreadcrumbHome />
          <BreadcrumbSeparator />
          <Breadcrumb>{t(locale, "about.title")}</Breadcrumb>
        </Breadcrumbs>
      }
    >
      <div className="mx-auto max-w-2xl py-10 sm:py-14">
        <div className="prose">
          <Content />
        </div>
        <br/>
        <a href="https://rosicrucian.dev" className="inline-block">
          <img
            src="/avatar.png"
            alt="Rosicrucian Developers emblem"
            width={128}
            height={128}
            className="size-32"
          />
        </a>
      </div>
    </SidebarLayoutContent>
  );
}

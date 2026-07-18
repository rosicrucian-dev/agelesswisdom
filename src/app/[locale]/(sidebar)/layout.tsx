import { SidebarLayout } from "@/components/sidebar-layout";
import { getSections } from "@/data/curriculum";
import { toLocale } from "@/lib/locales";
import type React from "react";

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  let locale = toLocale((await params).locale);
  return (
    <SidebarLayout sections={getSections(locale)}>{children}</SidebarLayout>
  );
}

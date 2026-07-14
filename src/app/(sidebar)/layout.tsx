import { SidebarLayout } from "@/components/sidebar-layout";
import { getSections } from "@/data/curriculum";
import type React from "react";

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout sections={getSections()}>{children}</SidebarLayout>;
}

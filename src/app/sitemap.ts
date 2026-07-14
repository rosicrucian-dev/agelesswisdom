import { type MetadataRoute } from "next";

import { getSections, lessonUrl } from "@/data/curriculum";

// Required by `output: 'export'` for metadata routes — emits a static
// /sitemap.xml file at build time instead of treating it as dynamic.
export const dynamic = "force-static";

const SITE = "https://agelesswisdom.school";

// Trailing slashes match the site's canonical URLs (next.config sets
// `trailingSlash: true`, so `/about` redirects to `/about/`).
const staticRoutes = ["/", "/about/"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const lessonRoutes = getSections().flatMap((section) =>
    section.lessons.map((lesson) => ({
      url: `${SITE}${lessonUrl(section, lesson)}/`,
      lastModified,
    })),
  );
  return [
    ...staticRoutes.map((path) => ({ url: `${SITE}${path}`, lastModified })),
    ...lessonRoutes,
  ];
}

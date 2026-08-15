import { type MetadataRoute } from "next";

// Required by `output: 'export'` for metadata routes — emits a static
// /robots.txt file at build time instead of treating it as dynamic.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://agelesswisdom.school/sitemap.xml",
  };
}

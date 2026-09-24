/**
 * Site-wide constants. Anything that names the site or its deployment lives
 * here so a domain move or a base-path change is a single edit.
 */

/** Canonical origin, no trailing slash. Used for absolute URLs only (metadata,
 *  sitemap, robots, redirect stubs); in-page links stay relative. */
export const SITE_URL = "https://agelesswisdom.school";

/** The site's name where it is NOT localized (manifest, structured data,
 *  social cards, print). Localized chrome uses `meta.siteTitle` instead. */
export const SITE_NAME = "The School of Ageless Wisdom";

/**
 * URL prefix the site is served under ("" at the apex domain, "/repo" on a
 * project page). next/link and next/image add it themselves; plain hrefs,
 * fetches, and inline scripts must prepend it by hand.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

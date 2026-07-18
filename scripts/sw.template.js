/*
 * Service worker template. `scripts/gen-sw.ts` (postbuild) replaces the
 * manifest token below with the real precache manifest and writes the result
 * to out/sw.js — the deploy workflow then ships it to GitHub Pages. Edit THIS
 * file, never out/sw.js.
 *
 * Caching model:
 *   - Precache (install): every HTML page + /_next/static + root icons —
 *     so the whole course (all lesson TEXT + the app shell) works offline
 *     after one visit. Entries carry a content hash; on updates only changed
 *     files are re-downloaded, the rest are kept in place.
 *   - Runtime (as browsed): the per-lesson PDF facsimiles, lesson images, and
 *     RSC payloads — stale-while-revalidate, so anything viewed once is
 *     available offline without precaching ~75MB of PDFs up front, and a
 *     redeploy quietly refreshes them.
 *   - The full book downloads live cross-origin on a GitHub Release, so the
 *     origin check below never intercepts them.
 *
 * HTML navigations are network-first, so deploys show up immediately when
 * online; the cache is the fallback, not the source of truth.
 */

// [{ url, rev }] — rev is a content hash, injected by gen-sw.ts.
const PRECACHE_MANIFEST = __PRECACHE_MANIFEST__;

const PRECACHE = "saw-precache";
const RUNTIME = "saw-runtime-v1";
// Sentinel cache entry storing { url: rev } from the previous install, so
// unchanged files survive updates without a re-download.
const MANIFEST_URL = "/__sw-manifest__";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);

      let oldRevs = {};
      try {
        const stored = await cache.match(MANIFEST_URL);
        if (stored) oldRevs = await stored.json();
      } catch {}

      const results = await Promise.allSettled(
        PRECACHE_MANIFEST.map(async ({ url, rev }) => {
          if (oldRevs[url] === rev && (await cache.match(url))) return;
          // cache: 'no-cache' revalidates against the server rather than the
          // HTTP cache, so a stale CDN entry can't get frozen in.
          const response = await fetch(url, { cache: "no-cache" });
          if (!response.ok) throw new Error(`${response.status} ${url}`);
          await cache.put(url, response);
        }),
      );
      // Fail the install if anything failed — the browser retries the whole
      // install on a later visit, and the rev check makes retries cheap. A
      // partial precache that never heals is worse.
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(
          `precache: ${failed.length} of ${results.length} failed`,
        );
      }

      // Prune entries dropped from the manifest, then store the new revs.
      const valid = new Set(PRECACHE_MANIFEST.map((e) => e.url));
      valid.add(MANIFEST_URL);
      for (const request of await cache.keys()) {
        if (!valid.has(new URL(request.url).pathname))
          await cache.delete(request);
      }
      const newRevs = {};
      for (const { url, rev } of PRECACHE_MANIFEST) newRevs[url] = rev;
      await cache.put(MANIFEST_URL, new Response(JSON.stringify(newRevs)));

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older schemes (e.g. a future RUNTIME version bump).
      const keep = new Set([PRECACHE, RUNTIME]);
      for (const name of await caches.keys()) {
        if (name.startsWith("saw-") && !keep.has(name))
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// Network-first for page navigations: fresh when online, cached when not.
// `ignoreSearch` lets a URL with a query string resolve to the cached page.
async function handleNavigation(request) {
  const cache = await caches.open(PRECACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const url = new URL(request.url);
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Uncached deep link while offline — the home page at least keeps the
    // user inside the app instead of showing the browser's offline error.
    const home = await cache.match("/");
    if (home) return home;
    throw new Error("offline and not cached");
  }
}

// Cache-first for content-hashed build assets — a hit is immutable.
async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(PRECACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// Stale-while-revalidate for everything else (lesson PDFs, lesson images,
// RSC payload .txt): serve the cache immediately, refresh it in the
// background so the next view is current.
async function handleRuntime(request, event) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const response = await refresh;
  if (!response) throw new Error("offline and not cached");
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleStatic(request));
  } else {
    event.respondWith(handleRuntime(request, event));
  }
});

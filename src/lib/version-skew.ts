// Version-skew recovery.
//
// This site is a static export: every deploy rewrites the content-hashed JS
// chunks / RSC payloads and DELETES the previous build's files (GitHub Pages
// replaces the whole site atomically — it can't keep old assets around or do
// request-time skew protection the way Vercel/Netlify can). A browser tab
// still running an older build therefore 404s the moment a client-side
// navigation lazy-loads a chunk whose hash no longer exists: `import()`
// throws, and with no error boundary it surfaces Next's default error page.
//
// Since we can't eliminate the skew at the host, the correct recovery is to
// reload once into the fresh build. A chunk error only happens at a navigation
// boundary — the user was already leaving the current view — so a full reload
// lands them where they were headed and reads as "took a beat", not a crash.
// Guarded via sessionStorage so a *genuine*, reproducible error (one that
// survives a reload) can't reload-loop; it falls through to a visible fallback
// instead.

const RELOAD_AT_KEY = "version-skew-reload-at";
const RELOAD_WINDOW_MS = 15_000;

export function isVersionSkewError(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown } | null;
  const name = typeof e?.name === "string" ? e.name : "";
  const message = typeof e?.message === "string" ? e.message : "";
  return (
    name === "ChunkLoadError" ||
    /loading chunk \d+ failed/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message)
  );
}

// If `error` looks like version skew, reload once into the fresh build and
// return true — the caller should then render a neutral "updating" state,
// since the reload is imminent. Returns false (caller renders its normal error
// fallback) when the error isn't skew, or when we already reloaded within the
// guard window, meaning the error survived a reload and is a real bug rather
// than a stale build.
export function recoverFromVersionSkew(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isVersionSkewError(error)) return false;

  let lastReloadAt = 0;
  try {
    lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_AT_KEY)) || 0;
  } catch {}
  if (Date.now() - lastReloadAt < RELOAD_WINDOW_MS) return false;

  try {
    window.sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {}
  window.location.reload();
  return true;
}

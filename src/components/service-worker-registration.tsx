"use client";

import { useEffect } from "react";

// Registers the offline service worker (generated into out/sw.js by
// scripts/gen-sw.ts at build time), but ONLY when the site is running as an
// installed home-screen app (standalone display mode / iOS navigator.standalone).
//
// This keeps casual browser visits a plain website — no service worker, no
// ~21MB background precache. Someone who deliberately "Add to Home Screen"s
// the site opts into the offline app: on that first standalone launch the
// worker installs and precaches all lesson text + the app shell. (On iOS the
// standalone app has its own storage separate from Safari, so this is a fresh
// context anyway.) Production-only: the dev server never serves /sw.js.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // `display-mode: standalone` covers installed PWAs (Android/desktop);
    // `navigator.standalone` is the iOS home-screen flag.
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!installed) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (private mode, storage pressure) just means no
      // offline support — the app still works normally, just online-only.
    });
  }, []);

  return null;
}

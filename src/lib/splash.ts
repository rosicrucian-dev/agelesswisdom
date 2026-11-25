// Single source of truth for iOS launch screens ("splash screens").
// Consumed by two sides that must agree exactly:
//   - scripts/gen-splash.ts renders one PNG per device size × scheme into
//     public/splash/ (run `npm run gen:splash` after changing anything here,
//     and commit the images)
//   - app/layout.tsx emits the matching <link rel="apple-touch-startup-image">
//     tags via metadata.appleWebApp.startupImage
//
// iOS is strict: a startup image is used only if its pixel size matches the
// device exactly (logical CSS size × device pixel ratio) AND the media query
// matches. Anything else falls back to a plain (blank) launch.

export interface SplashDevice {
  /** Logical CSS points, portrait orientation. */
  w: number;
  h: number;
  scale: number;
}

// iPhone portrait sizes, SE (2nd gen) through the current generation.
// Duplicated logical sizes with different scales (XR vs XS Max) are distinct
// entries — iOS matches on -webkit-device-pixel-ratio too.
export const SPLASH_DEVICES: SplashDevice[] = [
  { w: 375, h: 667, scale: 2 }, // SE 2nd/3rd gen, 6s/7/8
  { w: 414, h: 736, scale: 3 }, // 6s/7/8 Plus
  { w: 375, h: 812, scale: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, scale: 2 }, // XR, 11
  { w: 414, h: 896, scale: 3 }, // XS Max, 11 Pro Max
  { w: 390, h: 844, scale: 3 }, // 12, 12 Pro, 13, 13 Pro, 14
  { w: 428, h: 926, scale: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 393, h: 852, scale: 3 }, // 14 Pro, 15, 15 Pro, 16, 17
  { w: 430, h: 932, scale: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { w: 402, h: 874, scale: 3 }, // 16 Pro, 17 Pro
  { w: 440, h: 956, scale: 3 }, // 16 Pro Max, 17 Pro Max
  { w: 420, h: 912, scale: 3 }, // Air
];

export type SplashScheme = "light" | "dark";

// Splash backgrounds match the page canvas per scheme (body is white in
// light mode, gray-950 in dark) so the launch blends into the first paint.
export const SPLASH_SCHEMES: Array<{ scheme: SplashScheme; bg: string }> = [
  { scheme: "light", bg: "#ffffff" },
  { scheme: "dark", bg: "#030712" },
];

export function splashPath(scheme: SplashScheme, d: SplashDevice): string {
  return `/splash/apple-splash-${scheme}-${d.w * d.scale}x${d.h * d.scale}.png`;
}

export function splashMedia(scheme: SplashScheme, d: SplashDevice): string {
  return [
    "screen",
    `(device-width: ${d.w}px)`,
    `(device-height: ${d.h}px)`,
    `(-webkit-device-pixel-ratio: ${d.scale})`,
    "(orientation: portrait)",
    `(prefers-color-scheme: ${scheme})`,
  ].join(" and ");
}

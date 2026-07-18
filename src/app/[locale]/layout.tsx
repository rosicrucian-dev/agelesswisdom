import { LocaleProvider } from "@/components/locale-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import {
  DEFAULT_LOCALE,
  LOCALES,
  RELEASED_LOCALES,
  TRANSLATION_LOCALES,
  toLocale,
} from "@/lib/locales";
import { clsx } from "clsx";
import localFont from "next/font/local";
import type React from "react";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Static export: only the locales above exist. Without this, dev would
// render any first segment (/fr/) as a page with a bogus locale param
// instead of 404ing like the exported site does.
export const dynamicParams = false;

const InterVariable = localFont({
  variable: "--font-inter",
  src: [
    { path: "../InterVariable.woff2", style: "normal" },
    { path: "../InterVariable-Italic.woff2", style: "italic" },
  ],
});

// Literata (TypeTogether, OFL) — Google Play Books' reading serif, used for the
// lesson reading column (see `.prose` in typography.css). Full variable font
// with optical sizing; weight axis 200–900.
const Literata = localFont({
  variable: "--font-literata",
  src: [
    { path: "../Literata.woff2", style: "normal", weight: "200 900" },
    { path: "../Literata-Italic.woff2", style: "italic", weight: "200 900" },
  ],
});

// Pre-hydration language bounce (ported from ../bota-toolbox), emitted
// only into English pages and only acting on the home page: an
// installed home-screen app relaunches at start_url, and a brand-new
// visitor with a translated-locale browser lands there too — both get
// sent to their locale's home before first paint. Deep links never
// bounce; an explicit switcher pick writes "botacourse:locale", which
// this reads first. Only RELEASED locales participate, so nothing is
// emitted while translations are dark-launched.
const BOUNCE_LOCALES = TRANSLATION_LOCALES.filter((l) =>
  RELEASED_LOCALES.includes(l),
);

const bounceScript = `try {
  if (location.pathname === "${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/") {
    var locales = ${JSON.stringify(BOUNCE_LOCALES)};
    var s = localStorage.getItem("botacourse:locale");
    var target = locales.indexOf(s) !== -1
      ? s
      : !s
        ? (navigator.languages || [navigator.language])
            .map(function (l) { return String(l).split("-")[0]; })
            .filter(function (l) { return locales.indexOf(l) !== -1; })[0]
        : null;
  if (target) {
      if (!s) localStorage.setItem("botacourse:locale", target);
      location.replace("${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/" + target + "/");
    }
  }
} catch (e) {}`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  return (
    <html
      lang={locale}
      className={clsx(
        InterVariable.variable,
        Literata.variable,
        "scroll-pt-16 font-sans antialiased dark:bg-gray-950",
      )}
    >
      <body>
        {locale === DEFAULT_LOCALE && BOUNCE_LOCALES.length > 0 && (
          <script dangerouslySetInnerHTML={{ __html: bounceScript }} />
        )}
        <LocaleProvider locale={locale}>
          <div className="isolate">{children}</div>
        </LocaleProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

// Root 404. The root layout is a pass-through (the real document lives
// under [locale]/), so this page renders its own <html>/<body> — same
// trick as global-error.tsx. Plain anchor on purpose: this boundary
// renders outside the app providers, so a full-page hop home is right.
// `dark:` styles are prefers-color-scheme media queries, so no theme
// script is needed.
export default function NotFound() {
  return (
    <html lang="en" className="antialiased dark:bg-gray-950">
      <body>
        <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            404
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            Page not found
          </h1>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            Sorry, we couldn&rsquo;t find the page you&rsquo;re looking for.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="mt-8 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  );
}

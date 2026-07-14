import Link from "next/link";

// Root 404. Renders in the root layout (no sidebar) for both unmatched URLs
// and `notFound()` calls not caught by a nearer boundary. Self-sizes with
// min-h since the root html/body carry no height.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">404</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
        Sorry, we couldn&rsquo;t find the page you&rsquo;re looking for.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        Back to home
      </Link>
    </div>
  );
}

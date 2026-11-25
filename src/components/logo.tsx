import { clsx } from "clsx";

/**
 * Text wordmark. The lessons were originally issued by Paul Foster Case's
 * School of Ageless Wisdom, so the site carries that name.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        className,
        "block font-semibold tracking-tight text-gray-950 dark:text-white",
      )}
    >
      <span className="block text-3xl/9 sm:text-4xl/10">
        The School of Ageless Wisdom
      </span>
      <span className="mt-1 block text-sm/6 font-normal tracking-widest text-gray-500 uppercase dark:text-gray-400">
        The Early Curriculum of Paul Foster Case
      </span>
    </span>
  );
}

"use client";

/**
 * Client-side "resume where you left off" for the course. Each lesson page
 * records its own href + title to localStorage on view; the overview's start
 * button reads it back, turning "Start the course" into "Continue Lesson 1 -
 * The Life Power" that jumps to the most recently opened lesson.
 */
import { Link } from "@/components/locale-link";
import { PlayIcon } from "@/icons/play-icon";
import { useT } from "@/lib/use-t";
import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "botacourse:last-lesson";

type LastLesson = { href: string; label: string };

// useSyncExternalStore compares snapshots with Object.is, so readLastLesson
// must return a STABLE reference while the underlying value is unchanged —
// re-parsing into a fresh object each render would spin an infinite loop.
// Cache by the raw localStorage string and only rebuild when it changes.
let cachedRaw: string | null = null;
let cachedValue: LastLesson | null = null;

function readLastLesson(): LastLesson | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in private-mode/sandboxed contexts; degrade to
    // the default "start from the beginning" behavior.
    return null;
  }

  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;

  cachedValue = null;
  if (raw) {
    try {
      let parsed = JSON.parse(raw);
      if (parsed && typeof parsed.href === "string") {
        cachedValue = { href: parsed.href, label: parsed.label ?? "" };
      }
    } catch {
      // Older entries may be a bare href string that isn't valid JSON; treat
      // as no resume point.
    }
  }
  return cachedValue;
}

/** Records the current lesson as the resume point. Renders nothing. */
export function RecordLessonVisit({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ href, label }));
    } catch {
      // ignore — see readLastLesson()
    }
  }, [href, label]);
  return null;
}

// Subscribe to cross-tab writes so an open overview updates if the visitor
// opens a lesson in another tab.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * The overview's primary call-to-action. The server snapshot is null, so it
 * hydrates as "Start the course" (matching the static HTML — no mismatch),
 * then reads the stored lesson on the client and upgrades to "Continue <lesson>".
 */
export function ResumeButton({ firstHref }: { firstHref: string }) {
  const { t } = useT();
  let last = useSyncExternalStore(subscribe, readLastLesson, () => null);
  let resume = last && last.href !== firstHref ? last : null;

  return (
    <Link
      href={resume?.href ?? firstHref}
      className="inline-flex items-center gap-x-2 rounded-full bg-gray-950 px-3 py-0.5 text-sm/7 font-semibold text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
    >
      <PlayIcon className="fill-white" />
      {resume
        ? resume.label
          ? `${t("resume.continue")} ${resume.label}`
          : t("resume.continue")
        : t("resume.start")}
    </Link>
  );
}

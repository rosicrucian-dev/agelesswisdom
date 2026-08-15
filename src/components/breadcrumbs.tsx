"use client";

import { Link } from "@/components/locale-link";
import { useT } from "@/lib/use-t";
import { clsx } from "clsx";
import type React from "react";

export function Breadcrumbs(props: React.ComponentProps<"nav">) {
  const { t } = useT();
  return (
    <nav
      aria-label={t("breadcrumbs.label")}
      className="flex items-center gap-x-2 text-sm/6"
      {...props}
    />
  );
}

export function BreadcrumbHome() {
  const { t } = useT();
  return (
    <Link
      href="/"
      className="min-w-0 shrink-0 text-gray-950 dark:text-white"
      aria-label={t("breadcrumbs.homeLabel")}
    >
      Home
    </Link>
  );
}

export function Breadcrumb({
  href,
  children,
  className,
}: {
  // Plain string hrefs only — the locale-aware Link prefixes them.
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (href) {
    return (
      <Link
        href={href}
        className={clsx(
          className,
          "min-w-0 truncate text-gray-950 dark:text-white",
        )}
      >
        {children}
      </Link>
    );
  }

  return (
    <span
      className={clsx(
        className,
        "min-w-0 truncate text-gray-950 last:text-gray-600 dark:last:text-gray-400",
      )}
    >
      {children}
    </span>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <span className={clsx(className, "text-gray-950/25 dark:text-white/25")}>
      /
    </span>
  );
}

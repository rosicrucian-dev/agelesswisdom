"use client";

import { useLocale } from "@/components/locale-provider";
import { localeHref } from "@/lib/locales";
import NextLink, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useMemo } from "react";

// Locale-aware navigation. All internal links/router pushes go through
// these (enforced by no-restricted-imports in eslint.config.mjs) so a
// page rendered under /de/ links within /de/ automatically, while
// English hrefs pass through byte-identical. Ported from ../bota-toolbox.

type AnchorProps = LinkProps & React.ComponentPropsWithoutRef<"a">;

export const Link = forwardRef(function Link(
  { href, ...props }: AnchorProps,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  const locale = useLocale();
  return <NextLink {...props} href={localeHref(locale, href)} ref={ref} />;
});

// Drop-in for next/navigation's useRouter: push/replace prefix string
// hrefs for the current locale, everything else delegates.
export function useLocaleRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const locale = useLocale();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, ...rest: never[]) =>
        router.push(localeHref(locale, href), ...rest),
      replace: (href: string, ...rest: never[]) =>
        router.replace(localeHref(locale, href), ...rest),
    }),
    [router, locale],
  );
}

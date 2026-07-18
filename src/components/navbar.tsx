"use client";

import { IconButton } from "@/components/icon-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/components/locale-link";
import { Search } from "@/components/search";
import { CloseIcon } from "@/icons/close-icon";
import { MenuIcon } from "@/icons/menu-icon";
import { type MessageKey } from "@/lib/messages";
import { useT } from "@/lib/use-t";
import {
  CloseButton,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import { clsx } from "clsx";
import type React from "react";
import { useState } from "react";

const links: [MessageKey, string][] = [["nav.about", "/about"]];

export function Navbar({
  children,
  alwaysShowLinks = false,
  ...props
}: React.ComponentProps<"div"> & {
  /** Show the nav links inline at every width instead of collapsing them into
      the hamburger menu below `lg`. Used on the homepage, whose short
      breadcrumb leaves room; lesson pages keep the hamburger for their longer
      breadcrumb. */
  alwaysShowLinks?: boolean;
}) {
  return (
    <div
      className={clsx(
        "sticky top-0 z-10 bg-white/90 backdrop-blur-sm dark:bg-gray-950/90",
        "flex items-center justify-between gap-x-8 px-4 py-4 sm:px-6",
      )}
      {...props}
    >
      {children}
      <SiteNavigation alwaysShowLinks={alwaysShowLinks} />
    </div>
  );
}

function MobileNavigation({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Dialog open={open} onClose={onClose} className="lg:hidden">
      <DialogBackdrop className="fixed inset-0 bg-gray-950/25" />
      <div className="fixed inset-0 flex justify-end pl-11">
        <DialogPanel className="w-full max-w-2xs bg-white px-4 py-5 ring ring-gray-950/10 sm:px-6 dark:bg-gray-950 dark:ring-white/10">
          <div className="flex justify-end">
            <CloseButton as={IconButton} onClick={onClose}>
              <CloseIcon className="stroke-gray-950 dark:stroke-white" />
            </CloseButton>
          </div>
          <div className="mt-4">
            <div className="flex flex-col gap-y-2">
              {links.map(([titleKey, href]) => (
                <CloseButton
                  as={Link}
                  key={href}
                  href={href}
                  className="block rounded-md px-4 py-1.5 text-lg/7 font-medium tracking-tight text-gray-950 hover:bg-gray-950/5 dark:text-white dark:hover:bg-white/5"
                >
                  {t(titleKey)}
                </CloseButton>
              ))}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function SiteNavigation({
  alwaysShowLinks = false,
}: {
  alwaysShowLinks?: boolean;
}) {
  const { t } = useT();
  let [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="flex items-center gap-x-6">
      <Search />
      <LanguageSwitcher />
      {/* When links are always inline, the hamburger (and its dialog) is
          unnecessary at every width. */}
      {!alwaysShowLinks && (
        <>
          <IconButton
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <MenuIcon className="fill-gray-950 dark:fill-white" />
          </IconButton>
          <MobileNavigation
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />
        </>
      )}
      <div
        className={clsx(
          "flex gap-x-6 text-sm/6 text-gray-950 dark:text-white",
          !alwaysShowLinks && "max-lg:hidden",
        )}
      >
        {links.map(([titleKey, href]) => (
          <Link key={href} href={href}>
            {t(titleKey)}
          </Link>
        ))}
      </div>
    </nav>
  );
}

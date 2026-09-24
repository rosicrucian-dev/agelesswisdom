import { Button } from "@headlessui/react";
import { clsx } from "clsx";
import type React from "react";

export function IconButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      type="button"
      className={clsx(
        className,
        // The button's BOX is the same 32px as the chip drawn behind it. It
        // used to be only as big as the icon (~16x14) with the chip painted
        // as an oversized centered pseudo-element, so the chip bled 8px past
        // the element on every side: flex gaps reserved space for the icon
        // but not for the thing you can actually see, and the chip crowded
        // whatever sat next to it. Sizing the box to the chip also makes the
        // hit area a real 32px, which clears WCAG 2.2's 24px target minimum
        // (2.5.8) that a 16px button did not.
        "relative grid size-8 place-items-center *:relative",
        "before:absolute before:inset-0 before:rounded-md",
        "before:bg-white/75 before:backdrop-blur-sm dark:before:bg-gray-950/75",
        "data-hover:before:bg-gray-950/5 dark:data-hover:before:bg-white/5",
        "focus:outline-hidden data-focus:before:outline-2 data-focus:before:outline-blue-700 data-focus:before:outline-solid",
      )}
      {...props}
    />
  );
}

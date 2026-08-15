import clsx from "clsx";
import type React from "react";

export function SearchIcon({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={clsx(className, "h-4 shrink-0")}
      {...props}
    >
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25L14 14" strokeLinecap="round" />
    </svg>
  );
}

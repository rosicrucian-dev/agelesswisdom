import type React from "react";

export function PageSection({
  title,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
}) {
  return (
    <section
      {...props}
      // gap-x-6 is load-bearing, not decorative. The links in the content
      // column bleed their hover background OUTWARD (ContentLink is
      // `-mx-3 px-3`, so the chip starts 12px left of the text). Without a
      // gutter the two columns touch, and that chip reached back across the
      // boundary and sat on top of the section title. The gutter gives the
      // bleed somewhere to go and still leaves 12px of clear space.
      // Horizontal only, so the stacked mobile layout (col-span-full) is
      // unaffected.
      className="grid scroll-mt-8 grid-cols-4 gap-x-6 border-t border-gray-950/10 dark:border-white/10"
    >
      <div className="col-span-full sm:col-span-1">
        <div className="-mt-px inline-flex border-t border-gray-950 pt-px dark:border-white">
          <div className="pt-4 text-sm/7 font-semibold text-gray-950 sm:pt-10 dark:text-white">
            {title}
          </div>
        </div>
      </div>
      <div className="col-span-full pt-6 sm:col-span-3 sm:pt-10">
        {children}
      </div>
    </section>
  );
}

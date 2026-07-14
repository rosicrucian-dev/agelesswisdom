import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { TarotGroups } from "./src/components/tarot-groups";

function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (typeof node === "object" && "props" in node) {
    return getTextContent(
      (node as { props: { children: ReactNode } }).props.children,
    );
  }

  return "";
}

function generateId(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Image dimensions ride along in the alt text as "description|WIDTHxHEIGHT"
// (emitted by scripts/extract.ts) so next/image can size them statically.
const IMAGE_DIMENSION_REGEX = /^[^|]*\|\d+x\d+$/;

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Preserve any id the markdown pipeline already set (e.g. remark-gfm's
    // "footnote-label"); otherwise derive one from the heading text.
    h1: ({ children, id, ...props }) => {
      let resolvedId = id ?? generateId(getTextContent(children));
      return (
        <h1 id={resolvedId} {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ children, id, ...props }) => {
      let resolvedId = id ?? generateId(getTextContent(children));
      return (
        <h2 id={resolvedId} {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ children, id, ...props }) => {
      let resolvedId = id ?? generateId(getTextContent(children));
      return (
        <h3 id={resolvedId} {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ children, id, ...props }) => {
      let resolvedId = id ?? generateId(getTextContent(children));
      return (
        <h4 id={resolvedId} {...props}>
          {children}
        </h4>
      );
    },
    img: ({ alt = "", ...props }) => {
      if (IMAGE_DIMENSION_REGEX.test(alt)) {
        let [width, height] = alt.split("|")[1].split("x").map(Number);
        return (
          <Image
            {...props}
            alt={alt.split("|")[0]}
            width={width}
            height={height}
          />
        );
      }
      // No dimensions available; fall back to a plain img. Note this does
      // not get basePath prefixed, so extracted content should always carry
      // dimensions.
      return <img alt={alt} {...props} />;
    },
    // Internal cross-references (lesson-to-lesson links) go through
    // next/link so the basePath is prefixed and navigation stays client-side.
    a: ({ href = "", children, ...props }) =>
      href.startsWith("/") ? (
        <Link href={href} {...props}>
          {children}
        </Link>
      ) : (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    // Custom components usable in lesson MDX.
    TarotGroups,
    // Print-only page-break hint: keeps a labeled unit (a titled list, a short
    // verse) whole on one page in the PDF. The web has no pages, so it renders
    // its children unchanged — a pure pass-through with zero DOM impact.
    KeepTogether: ({ children }: { children?: ReactNode }) => <>{children}</>,
    ...components,
  };
}

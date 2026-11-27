/**
 * The volumes the School's lessons were printed in, under titles of their
 * own ("Wisdom of Tarot"), before this site gathered them as one course.
 * People still look for the lessons by those titles, so each has a page,
 * /books/<slug>/, saying which of the course it is, with its lessons and
 * its PDFs.
 *
 * The PDFs are the books repository's volumes (book.json's `volumes` in
 * content/books/books/school-of-ageless-wisdom/typescript/): the same text
 * and setting as the whole book, the volume's sections only, published at
 * pdf.rosicrucian.dev as <slug>.pdf and <slug>-screen.pdf. A slug here is
 * a volume's name there; keep the two lists alike.
 */
export interface Volume {
  /** Its page's address and its PDFs' name: the printed title, slugged. */
  slug: string;
  /** The title it was printed under. A title, not translated. */
  printedAs: string;
  /** The sections of the course it holds, by id, in order. */
  sections: string[];
}

export const VOLUMES: readonly Volume[] = [
  {
    slug: "occult-fundamentals-and-spiritual-unfoldment",
    printedAs: "Occult Fundamentals and Spiritual Unfoldment",
    sections: ["section-a", "section-b"],
  },
  {
    slug: "esoteric-secrets-of-meditation-and-magic",
    printedAs: "Esoteric Secrets of Meditation and Magic",
    sections: ["section-c", "section-d"],
  },
  {
    slug: "wisdom-of-tarot",
    printedAs: "Wisdom of Tarot",
    sections: ["section-first"],
  },
  {
    slug: "tarot-revelations",
    printedAs: "Tarot Revelations",
    sections: ["section-second"],
  },
  {
    slug: "hermetic-alchemy",
    printedAs: "Hermetic Alchemy",
    sections: ["hermetic-alchemy"],
  },
];

export const PDF_HOST = "https://pdf.rosicrucian.dev";

export const volumePath = (volume: Volume) => `/books/${volume.slug}`;

export const volumePdfUrls = (volume: Volume) => ({
  screen: `${PDF_HOST}/${volume.slug}-screen.pdf`,
  print: `${PDF_HOST}/${volume.slug}.pdf`,
});

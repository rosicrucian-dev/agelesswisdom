/**
 * Which sections' English text is the books repository's (../books, the
 * submodule at content/books; its README is the format), and where: a
 * work and an edition under content/books/books/, and for a book in parts
 * the part, a folder named as the section is. A lesson is the Nth file
 * there, NN.mdx; its slug, title and URL are this site's, from
 * content/curriculum/en.json. The repository is the master of these texts:
 * fix them there, with a ledger line, never here. German, where a lesson
 * has it, is still this site's own, content/lessons/de/.
 */
export interface BookSource {
  work: string;
  edition: string;
  /** The folder of the part, for a book in parts. */
  part?: string;
}

const school = (part: string): BookSource => ({
  work: "school-of-ageless-wisdom",
  edition: "typescript",
  part,
});

export const BOOK_SOURCES: Readonly<Record<string, BookSource>> = {
  "section-a": school("section-a"),
  "section-b": school("section-b"),
  "section-c": school("section-c"),
  "section-d": school("section-d"),
  "section-first": school("section-first"),
  "section-second": school("section-second"),
  "hermetic-alchemy": school("hermetic-alchemy"),
};

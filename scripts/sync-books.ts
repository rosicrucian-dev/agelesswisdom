// Copies every edition's figures from the books repository (the submodule
// at content/books: books/<work>/<edition>/images/**) to
// public/images/books/<work>/<edition>/, where the format's
// remark-book-images plugin (content/books/plugins/) points the texts'
// relative references (the repository's README). Every edition (the ones
// this site shows are src/data/book-sources.ts). Run before every dev
// server and build (`predev`, `prebuild`); the output is git-ignored, and
// nothing else under public/images/books/ is kept.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const SRC = "content/books/books";
const OUT = "public/images/books";

if (!existsSync(SRC)) {
  throw new Error(
    `sync-books: ${SRC} is missing: check out the books submodule (git submodule update --init)`,
  );
}

const count = (dir: string): number =>
  readdirSync(dir).reduce((n, f) => {
    const p = join(dir, f);
    return n + (statSync(p).isDirectory() ? count(p) : 1);
  }, 0);

rmSync(OUT, { recursive: true, force: true });
let n = 0;
for (const work of readdirSync(SRC)) {
  if (!existsSync(join(SRC, work, "work.json"))) continue;
  for (const edition of readdirSync(join(SRC, work))) {
    const images = join(SRC, work, edition, "images");
    if (!existsSync(images)) continue;
    const out = join(OUT, work, edition);
    mkdirSync(out, { recursive: true });
    cpSync(images, out, { recursive: true });
    n += count(images);
  }
}
console.log(`sync-books: ${n} figures under ${OUT}/`);

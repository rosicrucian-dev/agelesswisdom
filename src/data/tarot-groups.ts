/**
 * The "Tarot Groups" tableau's data, the books repository's
 * (content/books/print/tarot-groups.ts: the eight groups' offset tables,
 * and the grids derived from them), so the web component
 * (src/components/tarot-groups.tsx) and the print, which the repository's
 * renderer draws, can never disagree.
 */
export {
  TAROT_GRIDS_PER_GROUP,
  TAROT_GROUPS,
  tarotGridNumbers,
  type TarotGroup,
} from "../../content/books/print/tarot-groups.ts";

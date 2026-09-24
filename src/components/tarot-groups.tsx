// The eight "Tarot Groups" from Tarot Instruction 2, Supplement 1. The grids
// are derived from the offset tables in src/data/tarot-groups.ts (shared with
// the print renderer, so web and PDF can never disagree).
//
// Laid out as the book does: a 4-wide tableau per group — the group name in the
// top-left cell, the fourteen grids following, the bottom-right cell blank.
// On narrow screens the name becomes a full-width heading and the grids stack.

import {
  TAROT_GRIDS_PER_GROUP,
  TAROT_GROUPS,
  tarotGridNumbers,
  type TarotGroup,
} from "@/data/tarot-groups";

function MiniGrid({ group, k }: { group: TarotGroup; k: number }) {
  return (
    <div className="tg-grid">
      {tarotGridNumbers(group, k).map((n, i) => (
        <span key={i}>{n}</span>
      ))}
    </div>
  );
}

export function TarotGroups() {
  return (
    <div className="tg-root">
      {TAROT_GROUPS.map((group) => (
        <section key={group.name} className="tg-group" aria-label={group.name}>
          <div className="tg-label">{group.name}</div>
          {Array.from({ length: TAROT_GRIDS_PER_GROUP }, (_, i) => (
            <MiniGrid key={i} group={group} k={i + 1} />
          ))}
          <div className="tg-blank" aria-hidden="true" />
        </section>
      ))}
    </div>
  );
}

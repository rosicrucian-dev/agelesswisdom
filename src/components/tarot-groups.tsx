// The eight "Tarot Groups" from Tarot Instruction 2, Supplement 1.
//
// The 112 nine-Key combinations fall into eight groups of fourteen. Each group
// is one of the eight symmetries of the square (the dihedral group D4) applied
// to a basic 3x3 arrangement of nine consecutive Keys. Grid k (k = 1..14) holds
// the nine consecutive numbers k-1 .. k+7; the offset matrix for each group
// fixes which of those numbers sits in each cell. Deriving the grids rather than
// transcribing them keeps every one of the 112 arrangements provably correct
// (the printed tables are the source of truth and were verified against these).
//
// Laid out as the book does: a 4-wide tableau per group — the group name in the
// top-left cell, the fourteen grids following, the bottom-right cell blank.
// On narrow screens the name becomes a full-width heading and the grids stack.

const GROUPS: { name: string; offsets: readonly (readonly number[])[] }[] = [
  {
    name: "First Group",
    offsets: [
      [-1, 0, 1],
      [2, 3, 4],
      [5, 6, 7],
    ],
  },
  {
    name: "Second Group",
    offsets: [
      [1, 0, -1],
      [4, 3, 2],
      [7, 6, 5],
    ],
  },
  {
    name: "Third Group",
    offsets: [
      [-1, 2, 5],
      [0, 3, 6],
      [1, 4, 7],
    ],
  },
  {
    name: "Fourth Group",
    offsets: [
      [5, 2, -1],
      [6, 3, 0],
      [7, 4, 1],
    ],
  },
  {
    name: "Fifth Group",
    offsets: [
      [5, 6, 7],
      [2, 3, 4],
      [-1, 0, 1],
    ],
  },
  {
    name: "Sixth Group",
    offsets: [
      [7, 6, 5],
      [4, 3, 2],
      [1, 0, -1],
    ],
  },
  {
    name: "Seventh Group",
    offsets: [
      [7, 4, 1],
      [6, 3, 0],
      [5, 2, -1],
    ],
  },
  {
    name: "Eighth Group",
    offsets: [
      [1, 4, 7],
      [0, 3, 6],
      [-1, 2, 5],
    ],
  },
];

function MiniGrid({
  offsets,
  k,
}: {
  offsets: readonly (readonly number[])[];
  k: number;
}) {
  return (
    <div className="tg-grid">
      {offsets.map((row, r) =>
        row.map((offset, c) => <span key={`${r}-${c}`}>{k + offset}</span>),
      )}
    </div>
  );
}

export function TarotGroups() {
  return (
    <div className="tg-root">
      {GROUPS.map((group) => (
        <section key={group.name} className="tg-group" aria-label={group.name}>
          <div className="tg-label">{group.name}</div>
          {Array.from({ length: 14 }, (_, i) => (
            <MiniGrid key={i} offsets={group.offsets} k={i + 1} />
          ))}
          <div className="tg-blank" aria-hidden="true" />
        </section>
      ))}
    </div>
  );
}

// Verify the files that are meant to be BYTE-IDENTICAL with the sibling
// project really are.
//
//   npm run check:shared
//
// These files are copied between the two repos by hand (see the header in
// each). That works fine right up until someone edits one side and forgets the
// other — which is silent, and which prettier once did on its own. This turns
// "remember to sync" into "the script tells you".
//
// Skips cleanly when the sibling isn't checked out, so it's safe in CI.
// This script is itself on the list, so the two copies of the LIST can't drift
// apart either.

import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const SHARED = [
  'src/lib/search-engine.ts',
  'src/lib/use-search-index.ts',
  'src/lib/use-highlight-query.ts',
  'src/lib/use-snippets.ts',
  'src/lib/use-chunked-limit.ts',
  'test/search-engine.test.ts',
  'scripts/check-shared.ts',
]

// These files carry botatoolbox's formatting (no semicolons, single quotes).
// That is a no-op for prettier THERE, so botatoolbox needs no .prettierignore —
// but in agelesswisdom, formatting one of them rewrites every line and breaks
// the invariant silently. So: wherever a project has a .prettierignore, every
// shared file must be listed in it. That drift has happened; this catches it.
const IGNORE_FILE = '.prettierignore'

const ROOT = resolve(import.meta.dirname, '..')
const PAIR = ['agelesswisdom', 'botatoolbox']
const here = basename(ROOT)
const siblingName = PAIR.find((name) => name !== here) ?? PAIR[1]
const sibling = resolve(ROOT, '..', siblingName)

if (!existsSync(sibling)) {
  console.log(`check:shared: ${siblingName} not checked out — skipped`)
  process.exit(0)
}

const drifted = SHARED.filter((rel) => {
  const mine = join(ROOT, rel)
  const theirs = join(sibling, rel)
  if (!existsSync(mine) || !existsSync(theirs)) return true
  return readFileSync(mine, 'utf8') !== readFileSync(theirs, 'utf8')
})

// A shared file that prettier is allowed to touch will drift on the next
// format, so treat an unlisted one as a failure now rather than after the fact.
const unignored = SHARED.filter((rel) => {
  for (const root of [ROOT, sibling]) {
    const path = join(root, IGNORE_FILE)
    if (!existsSync(path)) continue
    if (!readFileSync(path, 'utf8').split(/\r?\n/).includes(rel)) return true
  }
  return false
})

if (drifted.length === 0 && unignored.length === 0) {
  console.log(
    `check:shared: ${SHARED.length} files identical with ${siblingName}`,
  )
  process.exit(0)
}

if (unignored.length > 0) {
  console.error(
    `\ncheck:shared: ${unignored.length} shared file(s) are missing from a ` +
      `${IGNORE_FILE}:\n` +
      unignored.map((f) => `    ${f}`).join('\n') +
      `\n\n  Prettier will reformat them and break the byte-for-byte match.\n` +
      `  Add each line to every ${IGNORE_FILE} that exists across the pair.\n`,
  )
}

if (drifted.length > 0) {
  console.error(
    `\ncheck:shared: ${drifted.length} of ${SHARED.length} shared files have ` +
      `DRIFTED from ${siblingName}:\n` +
      drifted.map((f) => `    ${f}`).join('\n') +
      `\n\n  They are meant to be byte-identical. Copy the newer one across:\n` +
      `    cp ${drifted[0]} ../${siblingName}/${drifted[0]}\n`,
  )
}
process.exit(1)

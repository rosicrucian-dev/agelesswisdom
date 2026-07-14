#!/usr/bin/env bash
#
# squash.sh — collapse the ENTIRE history of the current branch into a single
# "Initial commit" (no co-author, no trailers) and force-push it to origin.
#
# This repository is kept as a single-commit history on purpose. Run this
# whenever you want to fold accumulated commits (including the auto-generated
# "Updates" commits) back down to one clean root commit.
#
# WARNING: destructive. It rewrites branch history locally AND on the remote
# with --force. Anyone who has cloned the repo will need to re-clone.
#
# Usage:
#   ./scripts/squash.sh        # prompts for confirmation
#   ./scripts/squash.sh -y     # skip the prompt (non-interactive)
#
set -euo pipefail

MSG="Initial commit"
REMOTE="origin"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "error: not inside a git repository" >&2
  exit 1
}

# Run from the repo root so `git add -A` covers the whole tree.
cd "$(git rev-parse --show-toplevel)"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

ASSUME_YES=0
case "${1:-}" in
  -y | --yes) ASSUME_YES=1 ;;
esac

echo "About to squash ALL history of '$BRANCH' into a single '$MSG'"
echo "and force-push to '$REMOTE/$BRANCH'. This rewrites remote history."
if [ "$ASSUME_YES" -ne 1 ]; then
  printf "Continue? [y/N] "
  read -r reply
  case "$reply" in
    y | Y | yes | YES) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

# Build one parentless (root) commit whose tree is the current working tree.
# The author is whatever git user.name/user.email is configured; -m alone
# means no Co-Authored-By or other trailers.
git add -A
tree="$(git write-tree)"
commit="$(git commit-tree "$tree" -m "$MSG")"
git reset --hard "$commit"

# Push as the active GitHub CLI account when available, so the push is
# attributed to whoever `gh` is logged in as rather than a stale keychain
# credential. Falls back to the plain remote credential helper otherwise.
if command -v gh >/dev/null 2>&1; then
  git -c credential.helper='!gh auth git-credential' push --force "$REMOTE" "$BRANCH"
else
  git push --force "$REMOTE" "$BRANCH"
fi

echo "Done. '$BRANCH' is now a single '$MSG' ($(git rev-parse --short HEAD))."

---
name: worktree-feature-pr
description: >-
  Create a git worktree and new feature branch so local dirty diffs or stashes
  stay untouched, then commit, push, and open a PR from that worktree. Use when
  the user wants an isolated worktree, not to disturb WIP, or to PR from a clean
  checkout beside the current workspace.
---

# Worktree → Feature Branch → PR

Ship work from a **new worktree** so the primary checkout’s uncommitted diff/stash remains undisturbed.

## When to use

- Working tree is dirty / has a stash you must not touch
- Need a parallel branch without `git stash` gymnastics
- User asks for worktree isolation

## 1. Snapshot primary state (read-only)

```bash
PRIMARY=$(pwd)
git rev-parse --show-toplevel
git status -sb
git branch --show-current
git fetch origin
```

Do **not** stash, reset, or checkout away from dirty files unless the user explicitly allows it.

## 2. Create worktree + branch

Pick names:

- Branch: `feature/<slug>` or user-provided
- Path: sibling of repo root, e.g. `../<repo>-<slug>` (avoid nesting inside the main worktree)

```bash
ROOT=$(git rev-parse --show-toplevel)
REPO=$(basename "$ROOT")
BASE=main   # or default branch: gh repo view --json defaultBranchRef -q .defaultBranchRef.name
SLUG=<slug>
BRANCH=feature/$SLUG
WT="$(dirname "$ROOT")/${REPO}-${SLUG}"

git worktree add -b "$BRANCH" "$WT" "origin/$BASE"
```

If the branch already exists: `git worktree add "$WT" "$BRANCH"`.

## 3. Do the work in the worktree

```bash
cd "$WT"
# edit / copy only the intended changes into this tree
# run the project's test suite (see the repo's own agent docs or CI workflow)
```

- Commit **only** when the user asked to commit (or clearly asked to open a PR, which implies commit).
- Follow repo commit-message style; no secrets.
- Keep the primary `$PRIMARY` directory unchanged.

## 4. Push and open PR

```bash
git push -u origin HEAD
gh pr create --draft --title "<title>" --body "$(cat <<'EOF'
## Summary
- <1-3 bullets>

## Test plan
- [ ] <checks>

EOF
)"
```

`--draft` is the default for agent-opened PRs: the work is ready to be *looked at*, not to land. Marking it ready (`gh pr ready`) and merging are the human's calls — see [git-hygiene](../git-hygiene/SKILL.md). Open a non-draft PR only when the user asks for one.

Return the PR URL, and say what needs a human eye: judgment calls made, anything unverified.

## 5. Cleanup after the PR merges

A worktree outlives its PR. Once the branch is merged, the worktree is a stale checkout of code that no longer exists as a branch — remove it rather than leaving it to rot.

Do this when the user asks, or offer once the PR is confirmed merged. Never remove a worktree on your own initiative just because a PR merged; the user may still be using it.

### 5a. Confirm the branch actually merged

Ask GitHub — **do not** trust `git branch --merged`:

```bash
gh pr list --state merged --head "$BRANCH" --json number,mergedAt --jq '.[] | "\(.number) merged \(.mergedAt)"'
```

Squash and rebase merges rewrite commits, so a merged branch is *not* an ancestor of `$BASE`. `git branch --merged` omits it and `git branch -d` refuses it. The PR state is the authority. (Same rule as [triage-dependabot](../triage-dependabot/SKILL.md) — for the same reason.)

### 5b. Remove the worktree, then the branch

```bash
cd "$PRIMARY"          # never remove the worktree you are standing in
git worktree list      # confirm path + that you are not in $WT
git worktree remove "$WT"
git branch -D "$BRANCH"   # -D: -d refuses squash-merged branches
git worktree prune        # drops admin refs for any manually-deleted dirs
```

`-D` is safe **only** because 5a confirmed the merge. Without that check it is how work gets lost.

### 5c. If `git worktree remove` refuses — do not reach for `--force`

The refusal looks like:

```
fatal: '<path>' contains modified or untracked files, use --force to delete it
```

Treat that message as a **finding, not an obstacle.** Ignored build artifacts do *not* trigger it: a worktree containing only `.gitignore`d output — build directories, dependency caches — removes cleanly, because ignored files are not counted. So if Git objects here, it found something genuinely unsaved: a file you created that no ignore rule covers, or an uncommitted edit to a tracked file.

Look before deleting:

```bash
git -C "$WT" status --short
```

Then handle what you find — commit it, move it out, or report it to the user. Use `--force` only once you have seen the contents and confirmed they are disposable. The one routine exception is `git worktree remove --force` for a worktree on a *removable drive or dead path*, where the files are already gone.

### 5d. Report

Say which worktree and branch were removed, and what (if anything) you kept and why. "Worktree removed, branch `feature/x` deleted, PR #N merged" is the whole report when it goes cleanly.

## Rules

- Do not disturb the original worktree’s index, WIP, or stash.
- Do not force-push to default branches.
- Prefer worktrees over stashing when the user said “don’t disturb local diff.”
- Never `cd` out of `$PRIMARY` to remove a worktree you are inside of.
- Never `--force` a worktree removal you have not inspected with `git status --short` first.

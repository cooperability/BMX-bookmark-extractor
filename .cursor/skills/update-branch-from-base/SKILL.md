---
name: update-branch-from-base
description: >-
  Bring a feature branch up to date with its PR base (rebase or merge) without
  squashing, resolving conflicts cleanly. Use when the branch is behind main,
  GitHub says "out of date", or the user asks to sync/update from base before
  merge without rewriting to a single commit.
---

# Update Branch From Base

Refresh a feature branch onto the latest base **without** squashing. For rebase + squash plus the merge-readiness gates, use [premerge-cleanup](../premerge-cleanup/SKILL.md) instead.

## 1. Identify branch & base

```bash
git status -sb
git branch --show-current
gh pr view --json baseRefName,headRefName,mergeable,url
git fetch origin
```

Default base: PR base → `main` → `master`. Abort if detached or on the default branch.

## 2. Choose strategy

| Situation | Strategy |
|-----------|----------|
| User said “rebase” / clean history preferred | `git rebase origin/$BASE` |
| Shared branch with other pushers / user said “merge” | `git merge origin/$BASE` |
| Unclear | Prefer **rebase** for unshared feature branches; ask if already pushed and others may have pulled |

## 3. Resolve conflicts

Same discipline as rebase-squash skill: preserve feature intent, `git add`, continue/abort cleanly. No interactive rebase.

## 4. Push

```bash
# after rebase:
git push --force-with-lease
# after merge:
git push
```

Only `--force-with-lease` on the feature branch after rebase. Never on default branches.

## 5. Confirm

```bash
gh pr view --json mergeable,mergeStateStatus,commits
```

Report: strategy used, conflicts (if any), PR URL, whether checks need a re-run.

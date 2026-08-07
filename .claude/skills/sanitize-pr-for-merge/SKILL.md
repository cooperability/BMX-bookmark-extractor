---
name: sanitize-pr-for-merge
description: >-
  End-to-end GitHub PR hygiene before merge: update from base, resolve
  conflicts, optional squash, run tests, and confirm merge readiness. Use when
  the user asks to sanitize a PR, make a PR merge-ready, or clean up before merge.
---

# Sanitize PR For Merge

Orchestrate branch hygiene + verification. Delegate details to sibling skills; do not skip conflict or test failures.

## Checklist

Copy and track:

```
- [ ] Identify PR, base, head; confirm not default branch
- [ ] Working tree safe (clean, or use worktree-feature-pr)
- [ ] Update from base (rebase or merge)
- [ ] Resolve all conflicts
- [ ] Squash if user wants a single commit (rebase-squash-before-merge)
- [ ] Push with --force-with-lease only when history was rewritten
- [ ] Run automated tests + lint/typecheck from .claude/cli/
- [ ] gh pr view mergeability / CI green or reported
```

## Flow

1. `gh pr view` + `git status`. If WIP in the wrong tree → `worktree-feature-pr` or ask.
2. Behind base only → `update-branch-from-base`. Behind + messy commits → `rebase-squash-before-merge`.
3. `run-automated-tests` (and quality gates if this repo’s CLI catalog lists them).
4. Summarize: URL, commit graph (one line), test result, remaining blockers (reviews, CI, protections).

## Rules

- No interactive git; no force-push to `main`/`master`.
- Do not merge the PR unless the user explicitly asks to merge.
- Do not weaken CI or delete failing tests to go green.

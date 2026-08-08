---
name: premerge-cleanup
description: >-
  Post-approval, pre-integration cleanup: update from base, resolve conflicts,
  squash to clean history, run the merge-readiness gates, and confirm the branch
  passes in aggregate. Stops at merge-ready and never merges. Use when the user
  asks to rebase, squash before merge, sanitize a PR, clean up commit history, or
  make a branch merge-ready.
---

# Pre-merge Cleanup

The last step before a human integrates. Takes an approved branch and leaves it clean, current, verified, and merge-ready — then stops.

**Never merge.** Integration is the human's action from the GitHub UI, and that boundary is the point of this skill, not an omission from it. Do not merge, do not enable auto-merge, do not mark a draft ready.

Never use interactive git (`rebase -i`, `add -i`) — it cannot be driven non-interactively. `git reset --soft` does the same work as a scripted operation.

## Checklist

```
- [ ] PR, base, head identified; not on the default branch
- [ ] Working tree safe (clean, or isolated in a worktree)
- [ ] Updated from base, conflicts resolved
- [ ] Squashed to the history the user wants
- [ ] Pushed with --force-with-lease (only after a rewrite)
- [ ] Tests, lint, typecheck pass
- [ ] Hard gates pass, with evidence
- [ ] Branch passes in aggregate, not only per commit
- [ ] Merge-readiness reported; merge left to the human
```

## 1. Preconditions

```bash
git status
git branch --show-current
gh pr view --json number,baseRefName,url 2>/dev/null || true
```

- Refuse on `main`/`master` unless the user explicitly wants a different flow.
- Dirty tree: commit, or move the work to a worktree ([worktree-feature-pr](../worktree-feature-pr/SKILL.md)). Never stash someone's work to make room.
- Base is the PR's `baseRefName`, else `main`, else `master`.

## 2. Update from base

```bash
git fetch origin
BASE=<from PR or default>
git rebase "origin/$BASE"
```

Per conflicted file: read both sides, preserve feature intent *and* the base's change, `git add <file>`, then `GIT_EDITOR=true git rebase --continue`.

If it will not resolve cleanly, `git rebase --abort` and report the blocker. Never leave a half-rebased branch without saying so.

Only refreshing, with no squash wanted? [update-branch-from-base](../update-branch-from-base/SKILL.md) is the smaller operation.

## 3. Squash

Record what must survive before collapsing the range:

```bash
FORK=$(git merge-base HEAD "origin/$BASE")
git log --oneline "$FORK"..HEAD     # what will be collapsed
git diff --stat "$FORK"..HEAD       # what must be identical afterwards
```

Then:

```bash
FORK=$(git merge-base HEAD "origin/$BASE")   # recompute: the rebase moved it
git reset --soft "$FORK"
git status                                   # staged diff must match the diffstat above
git commit -m "<type>: <concise why>"
git diff "$FORK"..HEAD --stat                # verify nothing changed in the squash
```

`--soft` moves the branch pointer while leaving index and working tree untouched, so the whole feature stays staged and becomes one commit.

**Reset to the merge-base, not to `origin/$BASE`.** They coincide only on a freshly rebased branch. On a diverged one, resetting to `origin/$BASE` stages the inverse of every base commit you lack — committing that silently reverts other people's work. The merge-base form is correct either way.

Match the message style already in `git log`. Want several logical commits instead of one? Reset to the fork point and stage in batches with `git add -p` — still no `-i`.

## 4. Push

```bash
git push --force-with-lease
gh pr view --json mergeable,mergeStateStatus,url
```

`--force-with-lease` only, and only on the feature branch. If the lease is refused, the remote moved: fetch, inspect, ask. Never escalate to bare `--force`, never force-push a base branch.

## 5. Merge-readiness gates

The hard gates and the rubric live in [verified-change-loop](../verified-change-loop/SKILL.md). Apply them from there; do not restate them here, or the copies drift and stop agreeing on what passing means.

Two responsibilities are this skill's:

**Run the hard gates and report each with its evidence.** They are cheap, deterministic, and blocking. A branch failing one is not merge-ready however well the diff reads.

**Grade the branch in aggregate.** Commits that each passed alone can still add up to something that should not merge — scope creep invisible per commit, code orphaned by a later commit, one problem solved two ways, a late commit contradicting an early one, or a total change that no longer matches the PR description. Grade the full diff against the merge-base.

Where the user asked for a graded pass, run gate 2 of `verified-change-loop` and report the score. Otherwise run the hard gates and say a graded pass was not requested — never imply a grade that was not produced.

## 6. Report

Branch, base, conflicts touched, final commit subject, PR URL, gate results with evidence, and what still blocks integration — reviews, CI, branch protections.

End with the state, not an action: *merge-ready, awaiting your review and merge*.

## Rules

- Never merge, never auto-merge, never mark a draft ready.
- Never weaken CI or delete a failing test to go green.
- Never report merge-ready with a failing gate. Report the failure and stop. Waiving a gate is the user's explicit call, and belongs in the summary rather than a footnote.

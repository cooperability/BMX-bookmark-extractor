---
name: rebase-squash-before-merge
description: >-
  Rebase a feature branch onto the latest base, resolve conflicts, and squash
  to a clean commit history before merge. Use when the user asks to rebase,
  squash before merge, clean up commit history, or sanitize a PR branch.
---

# Rebase, Resolve Conflicts, Squash

Sanitize the current PR/feature branch so it is one (or few) clean commits on top of the latest base. Works in any git repo with `gh` optional for PR metadata.

**Never** use interactive git (`rebase -i`, `add -i`). **Never** force-push to `main`/`master`.

## 0. Preconditions

```bash
git status
git branch --show-current
gh pr view --json number,baseRefName,url 2>/dev/null || true
```

- Refuse if on `main`/`master` (unless user explicitly wants a different flow).
- Note dirty files: commit, stash, or move work to a worktree (`worktree-feature-pr` skill) before rebasing.
- Detect base: PR `baseRefName`, else `main`, else `master`.

## 1. Update base

```bash
git fetch origin
BASE=main   # or from PR
git rebase origin/$BASE
```

## 2. Resolve conflicts

For each conflicted file:

1. Read both sides; preserve **feature intent** + required base changes.
2. Fix file; `git add <file>`.
3. `git rebase --continue` (set `GIT_EDITOR=true` if needed to accept the message).
4. If stuck: `git rebase --abort` and report the blocker—do not leave a half-rebased state without telling the user.

Prefer resolving in the worktree that owns the branch; do not delete the user’s unrelated WIP.

## 3. Squash (non-interactive)

After a successful rebase, squash **all commits unique to this branch** into one unless the user asked to keep logical commits:

```bash
BASE=main
git reset --soft origin/$BASE
git status   # confirm staged diff is the full feature
git commit -m "$(cat <<'EOF'
<type>: <concise why>

EOF
)"
```

Message style: match recent `git log` on the branch/repo. One subject line; optional body for migration/risk notes.

If the user wants N logical commits, split with staged hunks / multiple soft-reset boundaries—still no `-i`.

## 4. Push & verify PR

```bash
git push --force-with-lease
gh pr view --json mergeable,mergeStateStatus,url
```

- Use `--force-with-lease` only on the **feature** branch after rewrite.
- If lease fails, fetch and reconcile—do not `--force` without asking.
- Optionally run the project's test suite. Take the command from the repo's own agent docs (`.cursor/cli/test/COMMANDS.md`, `AGENTS.md`, `CLAUDE.md`) if present; otherwise read it off the CI workflow or the README rather than guessing.

## 5. Report

Branch name, base, conflicts touched, final commit subject, PR URL, whether CI should be re-watched.

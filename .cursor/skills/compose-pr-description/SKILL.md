---
name: compose-pr-description
description: >-
  Read the current git diff (and recent commits) and compose a PR title plus
  body, or a commit subject/body. Use when the user asks for a PR description,
  PR title, commit message, changelog blurb, or to summarize branch changes
  for GitHub.
---

# Compose PR Description

Turn the actual diff into a precise GitHub title + body (or commit message). Prefer evidence over memory of the chat.

## 1. Gather scope

Default: all changes that would land if opened/merged now.

```bash
git status -sb
git diff --stat
git diff          # unstaged
git diff --cached # staged
# branch vs base (prefer PR base, else main/master):
git fetch origin 2>/dev/null || true
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo main)
git log --oneline origin/$BASE...HEAD 2>/dev/null
git diff --stat origin/$BASE...HEAD 2>/dev/null
```

If the user names files, commits, or “this chat’s work,” bound the summary to that set. Include untracked paths that are part of the change (list them; don’t invent file contents).

## 2. Analyze

Group changes by intent (feat / fix / chore / docs / refactor / test / ci). Note:

- User-facing behavior vs tooling-only
- Breaking changes, migrations, new scripts
- Test / a11y / security implications
- What is *not* included (explicit non-goals)

Ignore noise: lockfile churn detail, generated noise, line-ending-only files unless that’s the point.

## 3. Write the title

One line, ≤72 chars when possible, conventional style matching `git log`:

```text
type(scope): imperative summary
```

Examples: `chore(ai): add Cursor and Claude agent skills`, `fix(oc): restore mobile numpad`.

No trailing period. No “WIP” unless user asked.

## 4. Write the body

Use this shape (PR or commit — same structure; shorten for a solo commit):

```markdown
## Summary
- <why / outcome bullet>
- <why / outcome bullet>
- <why / outcome bullet>

## Changes
- <area>: <what changed>

## Test plan
- [ ] <command or manual check>
- [ ] <command or manual check>
```

Rules:

- Lead with **why**, not file laundry lists
- Bullets are scannable; no essay
- Test plan mirrors `.cursor/cli/` / `.claude/cli/` commands when relevant
- If opening a PR, ready-to-paste for `gh pr create --title ... --body ...`

## 5. Deliver

Output in this order:

1. **Title** (alone, copy-pasteable)
2. **Body** (fenced markdown)
3. Optional one-line **alt title** if two framings are reasonable

Do not create the commit or PR unless the user asks.

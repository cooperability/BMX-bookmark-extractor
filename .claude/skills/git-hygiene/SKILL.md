---
name: git-hygiene
description: >-
  Audit and fix repository-level git hygiene: merge settings such as
  auto-delete-on-merge and branch protection, stale local and remote branches,
  cross-platform line endings via .gitattributes, keeping secrets and bloat out
  of history, reflog recovery, and the agent working practice of siloed
  worktrees plus draft-PR handoff. Use when the user asks to clean up branches,
  tidy a repo, stop branches piling up after merge, configure repo or merge
  settings, protect a default branch, fix CRLF/LF churn between Windows and
  macOS or Linux, or recover from a bad rebase, reset, or force-push.
---

# Git Hygiene

Repo-level maintenance, as opposed to per-PR work. Three distinct layers, and it matters which one a fix belongs to:

| Layer | Lives in | Changed by |
|---|---|---|
| **Repo settings** (merge strategies, auto-delete) | GitHub's config, *not* the repo | `gh api` or the web UI — **never** a PR |
| **Branch state** (stale local/remote refs) | Git itself | `git` commands in a clone |
| **Repo content policy** (line endings) | `.gitattributes`, committed | A normal PR |

The most common mistake here is trying to change layer one with a commit. There is no file in a normal repo that controls `delete_branch_on_merge`; a PR claiming to set it does nothing. Say so plainly rather than opening one.

## 0. How agents do this work

Three standing rules. They apply to every task in this skill — and to agent work in the repo generally, not just hygiene tasks.

### Work in a siloed worktree, not the user's checkout

The user's working copy is theirs. It routinely holds uncommitted edits, stashes, a half-finished branch, or a dev server pinned to a path. An agent that checks out a branch or writes files there can entangle or destroy work it never saw.

```bash
git worktree add ../<repo>-<task> -b <branch>
```

A worktree is a second working directory sharing one object store, so the user's checkout keeps its branch, its dirty files, and its running processes untouched. See [worktree-feature-pr](../worktree-feature-pr/SKILL.md) for the full flow, including how to clean up afterwards.

The exception is a task the user explicitly scoped to the current checkout, or one that cannot work anywhere else. Say which you are doing.

### Open PRs as drafts, then hand off

An agent is not the approver. Raise the PR in draft and stop:

```bash
gh pr create --draft --title "<title>" --body "..."
```

- **Do not mark it ready for review.** `gh pr ready` is the human's call — it is the signal that a person has looked.
- **Do not merge your own PR**, and do not enable auto-merge, unless the user asks for that specific PR.
- **Say what needs a human eye.** Point at the judgment calls and anything you could not verify, rather than reporting a clean bill of health by default.

A draft says the work is ready to be *looked at*, not that it is ready to land. That distinction is the entire handoff.

### Amend the existing commit, do not stack fixups

Once a branch has a PR, further changes the user asks for on that same branch fold into the existing commit by default. A PR whose history is `feat: add thing` → `fix typo` → `address review` → `fix typo again` is noise: it makes the diff harder to read and leaves that mess in the base branch's history after merge.

```bash
git add -A
git commit --amend --no-edit        # keep the existing message
git push --force-with-lease
```

To revise the message too, drop `--no-edit` and pass `-m`. If the branch already has several commits, squash them first — see section 5.

Amend **only** when all of these hold:

- The branch is a feature branch with an open PR, not a base branch and not one someone else is building on.
- The push uses `--force-with-lease`, never bare `--force`. If the lease is refused, someone else pushed: fetch, look, and ask. Do not override it.
- The user has not asked for separate commits. Honour that request when they do — a reviewer mid-review may want the delta visible.

Force-pushing marks existing PR review comments as outdated. That is normal and non-destructive, but it does hide the diff a reviewer was reading. On a PR under active human review, prefer a follow-up commit and offer to squash before merge instead.

### Match the repo's conventions, do not import your own

```bash
git log --oneline -20
git branch -a --sort=-committerdate | head -20
```

Take commit-message style and branch naming from what is already there — Conventional Commits or not, `feat/<slug>` or `initials/<ticket>`. A consistent repo that disagrees with your preference is still consistent, and consistency is the property that matters.

Propose a convention only when the repo genuinely has none, and say it is a proposal.

## 1. Audit

```bash
gh api repos/{owner}/{repo} --jq '{
  deleteBranchOnMerge: .delete_branch_on_merge,
  allowSquash: .allow_squash_merge,
  allowRebase: .allow_rebase_merge,
  allowMerge: .allow_merge_commit,
  defaultBranch: .default_branch
}'
```

And the default branch's protection, which 404s when there is none:

```bash
DEFAULT=$(gh api repos/{owner}/{repo} --jq .default_branch)
gh api "repos/{owner}/{repo}/branches/$DEFAULT/protection" \
  --jq '{forcePush: .allow_force_pushes.enabled, deletion: .allow_deletions.enabled, checks: .required_status_checks.contexts}' \
  2>/dev/null || echo "no branch protection"
```

Report what is off before changing anything. These are the settings worth a look:

| Setting | Recommended | Why |
|---|---|---|
| `delete_branch_on_merge` | `true` | Merged head branches vanish automatically; without it, every merge leaves a remote branch behind forever |
| `allow_squash_merge` | `true` | One commit per PR — linear, readable history that matches the squash flow in section 5 |
| `allow_rebase_merge` | `false` | |
| `allow_merge_commit` | `false` | Leaving several strategies enabled makes history depend on which button someone clicked |
| `allow_auto_merge` | optional | Useful once required checks exist |

## 2. Apply repo settings

```bash
gh api --method PATCH repos/{owner}/{repo} -F delete_branch_on_merge=true
```

`-F` sends a real boolean; `-f` would send the string `"true"`.

Two constraints:

- **Confirm before changing a setting the user did not name.** Enabling auto-delete when asked is fine. Disabling merge commits because you think it is tidier is not — that changes how everyone merges.
- **This needs a token with repo admin scope.** If the call is refused or blocked, do not route around it. Hand the user the exact command to run themselves and say what it changes.

Verify by re-reading the field, not by trusting the response body.

### Protecting the default branch

Protect against the irreversible things — force-push and deletion — and require CI to pass. Do **not** add required approvals by default: on a solo repo that blocks every merge behind an admin override or a second account.

```bash
gh api --method PUT "repos/{owner}/{repo}/branches/$DEFAULT/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Every top-level key is required by this endpoint; `null` means "not enforced". So `required_pull_request_reviews: null` is what leaves approvals off. Put real check names in `contexts` once you know them — `[]` requires no specific check.

Suggest required approvals only when the repo has more than one contributor, and say why you are suggesting it.

**On private repos, branch protection needs a paid plan** (Pro/Team/Enterprise); it is free on public repos. A 403 or 404 here usually means that, not a bad token — check the plan before debugging credentials. Newer repos may use rulesets (`repos/{owner}/{repo}/rulesets`) instead, which can coexist with classic protection.

### Settings as code

If the user wants these tracked in version control rather than clicked, that requires the [Probot Settings app](https://github.com/apps/settings) installed on the repo, plus `.github/settings.yml`:

```yaml
repository:
  delete_branch_on_merge: true
  allow_squash_merge: true
```

**Without the app installed the file is inert** — it is YAML nothing reads. Only worth proposing when several settings across several repos need to stay in sync; for a single toggle the API call is the whole job.

## 3. Branch cleanup

Two rules govern all of it:

1. **PR state is the authority — never `git branch --merged`.** Squash and rebase merges rewrite commits, so a merged branch is *not* an ancestor of the default branch. `git branch --merged` silently omits genuinely merged branches, and `git branch -d` refuses to delete them.
2. **Never delete a branch with an open PR.** Deleting the head branch closes the PR.

```bash
git fetch --prune
```

`--prune` drops tracking refs for branches already deleted on the remote, and once `delete_branch_on_merge` is on, this alone handles most cleanup. Worth making automatic, if the user wants it:

```bash
git config --global fetch.prune true
```

Build the two sets every decision depends on:

```bash
gh pr list --state merged --limit 200 --json headRefName --jq '.[].headRefName' | sort > /tmp/merged.txt
gh pr list --state open   --limit 200 --json headRefName --jq '.[].headRefName' | sort > /tmp/open.txt
```

### Local branches

For each local branch, skipping the current branch and the default branch:

- In the open set → leave it.
- PR state is `MERGED` → `git branch -D <branch>`. `-D` is deliberate: `-d` refuses squash-merged branches. Verifying `MERGED` through `gh` is what makes `-D` safe — never reach for it without that check.
- **No PR at all** → not a cleanup candidate. Leave it and report it; it may be unpushed local work.

### Remote branches

Only when the PR is `MERGED` and the branch is absent from the open set:

```bash
git push origin --delete <branch>
```

With auto-delete enabled this should be a no-op. If merged branches *do* linger, say so rather than quietly deleting — it usually means they were merged by a route GitHub did not track, which the user will want to know.

### Worktrees

Stale worktrees hold refs and block branch deletion:

```bash
git worktree list
git worktree prune          # drops entries whose directory is already gone
```

Do not `git worktree remove --force` a tree with uncommitted work. See [worktree-feature-pr](../worktree-feature-pr/SKILL.md).

## 4. Line endings across platforms

A repo touched from both Windows and macOS/Linux will churn on line endings unless it says otherwise. The symptom is files showing as wholly modified with no visible change, review diffs where every line is rewritten, and merge conflicts on untouched code.

### Diagnose first

```bash
git ls-files --eol | grep -v '^i/lf' | head -20
```

The `i/` field is what is stored in the repo, `w/` is the working tree. **`i/crlf` is the problem** — CRLF committed into history, which every non-Windows clone then fights. `i/lf w/crlf` is healthy on Windows: LF in the repo, native endings on disk.

```bash
cat .gitattributes 2>/dev/null || echo "no .gitattributes — this is the usual root cause"
```

### The fix is `.gitattributes`, not `core.autocrlf`

`core.autocrlf` is per-machine config. It cannot be enforced, it is not committed, and one contributor who has not set it puts CRLF into history for everyone. `.gitattributes` ships with the repo and applies to every clone automatically.

One line covers most repos:

```gitattributes
# Auto detect text files and perform LF normalization
* text=auto eol=lf
```

- `text=auto` — let Git detect text files and normalize them to LF **in the object store** on commit.
- `eol=lf` — check them out as LF in the working tree on every platform, Windows included.

With this committed, a developer's `core.autocrlf` no longer matters: `.gitattributes` wins. Do not ask people to change their global git config — that is the failure mode this replaces.

Add narrower rules only for files whose endings genuinely matter:

```gitattributes
*.sh   text eol=lf      # CRLF here yields: bad interpreter: /bin/bash^M
*.bat  text eol=crlf    # legacy Windows tooling
*.png  binary           # only if Git's heuristic guesses wrong
```

Resist expanding beyond that. Per-extension lines like `*.md text eol=lf` are already implied by `* text=auto eol=lf` and only invite drift.

### Renormalizing an existing repo

Adding `.gitattributes` does **not** fix files already committed with CRLF. They stay wrong until rewritten:

```bash
git add --renormalize .
git status                    # inspect the blast radius before committing
git commit -m "chore: normalize line endings to LF"
```

This is a large, mechanical diff, so treat it as its own operation:

- **Land it alone**, in its own PR, touching nothing else. Mixing it with real changes makes both unreviewable.
- **Merge or rebase open branches first**, or coordinate with whoever has them. Every in-flight branch will conflict against it.
- **Hide it from blame**, so it does not become the last-touched commit on every line:

  ```bash
  echo "<sha>  # normalize line endings" >> .git-blame-ignore-revs
  git config blame.ignoreRevsFile .git-blame-ignore-revs
  ```

  GitHub honours `.git-blame-ignore-revs` automatically once committed.

Confirm afterwards that `git ls-files --eol` reports no `i/crlf`.

## 5. Rebase and squash before merge

Land one clean commit on top of the current base. Never use interactive git (`rebase -i`, `add -i`) — it cannot be driven non-interactively. `git reset --soft` does the same job as a scripted operation.

For the full flow including conflict resolution, see [premerge-cleanup](../premerge-cleanup/SKILL.md). The essentials:

### Establish the base and the fork point

```bash
BASE=$(gh pr view --json baseRefName --jq .baseRefName 2>/dev/null || echo main)
git fetch origin "$BASE"
FORK=$(git merge-base HEAD "origin/$BASE")

git log --oneline "$FORK"..HEAD     # exactly what will be collapsed
git diff --stat "$FORK"..HEAD       # exactly what should survive
```

Run both before touching anything. The commit list is what you are destroying; the diffstat is what must be identical afterwards.

### Rebase onto the latest base

```bash
git rebase "origin/$BASE"
```

On conflict: resolve, `git add <file>`, then `GIT_EDITOR=true git rebase --continue`. If it cannot be resolved cleanly, `git rebase --abort` and report the blocker — never leave a half-rebased branch without saying so.

### Squash with `reset --soft`

```bash
FORK=$(git merge-base HEAD "origin/$BASE")   # recompute: the rebase moved it
git reset --soft "$FORK"
git status                                   # staged diff must equal the diffstat above
git commit -m "<type>: <concise why>"
```

`--soft` moves the branch pointer while leaving the index and working tree exactly as they are, so every change stays staged and one commit replaces the range.

**Reset to the merge-base, not to `origin/$BASE`.** They are the same only when the branch is freshly rebased. If the branch has diverged, resetting to `origin/$BASE` stages the inverse of every base commit you lack — committing that quietly reverts other people's work. Recomputing the merge-base is correct in both cases.

Verify before pushing. The tree must be untouched by the squash:

```bash
git diff "$FORK"..HEAD --stat        # must match the pre-squash diffstat
```

### Push

```bash
git push --force-with-lease
gh pr view --json mergeable,mergeStateStatus,url
```

If the lease is refused, the remote moved: fetch, inspect, and ask. Never escalate to bare `--force`, and never force-push a base branch.

Want several logical commits instead of one? Stage in stages — `git reset --soft` to the fork point, then `git add -p` selected hunks and commit in batches. Still no `-i`.

## 6. What must never enter history

Git history is append-only in practice. Both problems below are far cheaper to prevent than to fix, which is why the emphasis is on the guard rather than the cleanup.

### Secrets

**A committed secret is a leaked secret. Rotate it first.** Removing it from history does not un-leak it: the value has been on GitHub's servers, and may sit in forks, in other people's clones, in CI logs, and in caches that still resolve the old commit SHA. History surgery is cleanup after rotation, never a substitute for it.

The order is: rotate the credential → confirm the new one works → then decide whether rewriting history is worth it. Usually it is not, once the value is dead.

Check what the repo already knows about:

```bash
gh api repos/{owner}/{repo}/secret-scanning/alerts \
  --jq '.[] | {state, secret_type, html_url}' 2>/dev/null || echo "secret scanning unavailable"
```

Free on public repos; on private repos it needs GitHub Advanced Security, so treat "unavailable" as unknown rather than clean.

Prevention is a `.gitignore` entry plus a committed `.env.example` carrying the *keys* and no values. Ignoring a file does **not** untrack one already committed:

```bash
git check-ignore -v .env      # confirm the rule matches
git rm --cached .env          # stop tracking; keeps the local file
```

That leaves the value in history — so if it was ever pushed, rotate.

### Repo bloat

Build output, dependency directories, and large binaries make every clone slower forever, because history keeps them even after deletion.

```bash
git count-objects -vH         # size-pack is the number that matters

git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '$1 == "blob"' | sort -k3 -nr | head -10
```

Removing a large blob from history rewrites every commit that follows it, which invalidates every open PR and every existing clone. Reserve that for genuine emergencies (`git-filter-repo`, never the deprecated `filter-branch`), and coordinate it with the user. For assets that must live in the repo, Git LFS is the intended answer.

## 7. Recovering from a bad rewrite

This skill hands out `reset --soft`, `commit --amend`, `branch -D`, and `push --force-with-lease`. Every one of them is recoverable locally, and knowing that is what makes them safe to use.

```bash
git reflog                       # every position HEAD has held, newest first
git reset --hard HEAD@{1}        # undo the last move
git branch rescue <sha>          # recover a deleted branch from its tip
```

For commits no ref points at any more:

```bash
git fsck --lost-found
```

Three limits worth stating plainly:

- **The reflog is local and per-clone.** It cannot recover work that only ever existed in someone else's checkout.
- **It expires** — roughly 90 days for reachable entries, 30 for unreachable. It is an undo buffer, not an archive.
- **Force-pushing over someone else's commits is not recoverable from your reflog.** Their work is in *their* reflog. This is the whole reason `--force-with-lease` exists, and the reason a refused lease means stop and ask.

Before any history rewrite on work that is not trivially reproducible, leave yourself a marker:

```bash
git branch backup/<name>-$(date +%Y%m%d)
```

## 8. Report

State separately, because the user acts on them differently:

1. **Settings changed** — field, old value, new value.
2. **Settings needing the user** — exact command, and what it changes.
3. **Branches deleted** — local and remote, with the PR that merged each.
4. **Branches left alone** — and why (open PR, no PR, uncommitted worktree). This list matters more than the deletions.
5. **Line endings** — whether any `i/crlf` remains, and whether a renormalization is owed. Never fold a renormalization into another change; propose it as its own PR.
6. **Anything found that must not be in history** — suspected secrets first, with rotation as the immediate action, then bloat. Do not bury these under the branch list.
7. **History rewritten** — which refs, and the backup branch left behind.

Never report a branch as deleted without having confirmed its PR was merged. Never report a repo as clean on the strength of a check that was unavailable — say it was unavailable.

## Related

- [triage-dependabot](../triage-dependabot/SKILL.md) — same branch-cleanup rules, applied to Dependabot's own branches after an alert sweep.

## Claude Code notes

- Prefer GitHub MCP tools for repo settings and PR state when available; otherwise `gh`.
- Repo settings are account-wide state, not repo content — treat a settings change as an action to confirm, not an edit to make silently.

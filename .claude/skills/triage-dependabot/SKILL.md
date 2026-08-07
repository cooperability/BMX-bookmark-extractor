---
name: triage-dependabot
description: >-
  Triage all open Dependabot alerts on a GitHub repository and resolve them with
  one clean package-bump PR. Use when the user mentions Dependabot, dependency
  alerts, security advisories for deps, or asks to bump packages to clear alerts.
---

# Triage Dependabot

Resolve every open Dependabot alert for the current repo in a single, reviewable PR. Prefer GitHub MCP tools if available; otherwise use `gh`.

## Preconditions

- Working tree should be clean (or stash first). Ask before discarding local work.
- Confirm remote repo: `gh repo view --json nameWithOwner -q .nameWithOwner`
- Prefer a fresh branch from the default base: `dependabot/triage-<YYYYMMDD>`

## 1. Inventory alerts

Via GitHub MCP (preferred) or:

```bash
gh api "repos/{owner}/{repo}/dependabot/alerts?state=open&per_page=100" --paginate
```

Collect per alert: `number`, `severity`, `package.name`, `ecosystem`, `vulnerable_version_range`, `first_patched_version` (if any), `dependency.manifest_path`, `security_advisory.ghsa_id` / CVE.

If paginated or truncated, keep fetching until complete. Also list open Dependabot PRs (`gh pr list --label dependencies`) so you do not duplicate work—close or supersede them in the final PR description.

## 2. Plan one bump set

Group alerts by ecosystem + manifest (`package.json`, `Cargo.toml`, `go.mod`, `requirements*.txt`, `Gemfile`, etc.).

For each group:

1. Choose the **minimum version that clears all alerts** for that package (usually `first_patched_version`, or the lowest safe range that satisfies every advisory).
2. Prefer one coordinated bump pass over many micro-PRs.
3. Note breaking majors separately; still include them if required to clear alerts, and call them out in the PR.
4. Skip alerts that are false positives only if the advisory clearly does not apply (unused optional peer, wrong platform)—document the skip with evidence.

Output a short plan before editing:

| Package | Manifest | From → To | Alerts closed | Risk |
|---------|----------|-----------|---------------|------|

Wait for user approval only if a major bump or lockfile-wide upgrade is required and the user has not already asked to “fix them all.”

## 3. Apply bumps cleanly

- Edit manifests with the package manager’s native commands when possible (`npm/pnpm/yarn`, `cargo update -p`, `go get`, `pip`/`uv`, `bundle update`, etc.) so lockfiles stay consistent.
- Do not hand-edit lockfiles unless the ecosystem has no alternative.
- One commit theme: dependency security bumps only—no drive-by refactors.
- Run the repo’s install + lint/test/typecheck scripts that already exist. Fix breakages caused by the bumps; do not weaken tests or CI to pass.

## 4. Verify alerts will clear

- Re-check that every targeted package version is outside each vulnerable range.
- Optionally: `npm audit` / `pnpm audit` / equivalent after the bump.
- Do not claim GitHub alerts are closed until the PR is merged (alerts close on default-branch presence).

## 5. Open one PR

```bash
gh pr create --title "chore(deps): resolve Dependabot alerts" --body "$(cat <<'EOF'
## Summary
- Resolves open Dependabot alerts in one bump pass
- <N> alerts across <M> packages / ecosystems

## Alerts addressed
| GHSA/CVE | Package | Severity | Bump |

## Test plan
- [ ] Install/lockfile refresh succeeds
- [ ] Existing CI / test script passes
- [ ] No unrelated dependency churn beyond what advisories require

EOF
)"
```

## 6. Clean up merged Dependabot branches

Run after a merge, or standalone when the user asks to tidy up branches.

Two rules govern this whole section:

1. **PR state is the authority — never `git branch --merged`.** Dependabot PRs are squash- or rebase-merged, which rewrites the commits. The branch is therefore *not* an ancestor of the default branch, so `git branch --merged` silently omits genuinely merged branches and `git branch -d` refuses to delete them. Ask GitHub what was merged.
2. **Never delete a branch that has an open PR.** Deleting the head branch closes the PR.

### 6a. Refresh and classify

```bash
git fetch --prune
```

`--prune` drops tracking refs for branches already deleted on the remote. This is usually the bulk of local cleanup: Dependabot deletes its own branches when its PRs are merged or closed, independent of the repo's `deleteBranchOnMerge` setting.

Build the two sets that drive every decision below:

```bash
# merged — safe to delete
gh pr list --state merged --limit 200 --json headRefName --jq '.[].headRefName' | sort > /tmp/merged.txt

# open — never touch
gh pr list --state open --limit 200 --json headRefName --jq '.[].headRefName' | sort > /tmp/open.txt
```

### 6b. Local branches

For each local branch matching `dependabot/*`, plus any local branch you created off a Dependabot PR:

- Skip the current branch and the default branch.
- Skip anything in the open set.
- Delete only when the PR state is `MERGED`:

  ```bash
  git branch -D <branch>
  ```

  `-D` is deliberate here: `-d` refuses squash-merged branches. Verifying `MERGED` through `gh` is what makes `-D` safe — do not reach for `-D` without that check.
- A branch with **no** PR at all is not a cleanup candidate. Leave it and report it; it may be unpushed local work.

### 6c. Remote branches

Only when the branch has a `MERGED` PR and is absent from the open set:

```bash
git push origin --delete <branch>
```

Expect this to be a no-op on most repos, since Dependabot removes its own branches. If merged Dependabot branches *do* linger on the remote, say so rather than quietly deleting — it usually means a PR was merged by a route Dependabot did not track, which is worth the user knowing.

### 6d. Report

Show the plan before deleting anything, then report what happened:

| Branch | Local | Remote | PR | Action |
|--------|-------|--------|----|--------|

List kept branches and the reason (open PR, no PR, unpushed commits) alongside deleted ones. "Nothing to clean" is a valid, useful result — report it plainly instead of manufacturing work.

## Rules

- Never force-push to `main`/`master`. Never commit secrets.
- Never delete a branch with an open PR, the default branch, or the current branch.
- Branch cleanup never closes an alert. Alerts close when the fix reaches the default branch; deleting branches is hygiene, not remediation.
- Do not disable Dependabot or ignore advisories to “clear” the queue.
- If an alert cannot be fixed yet (no patch, blocked peer dep), leave it open, document blocker in the PR, and still ship fixes for everything else.

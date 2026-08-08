---
name: verified-change-loop
description: >-
  Orchestrate patch and review subagents so no change is committed until an
  independent reviewer grades it above 90/100, and no PR opens until the whole
  branch passes in aggregate. Supplies the hard gates and rubric used by
  pr-reviewing and premerge-cleanup. Use when the user asks for verified,
  graded, or gated changes, or for a high-risk change that must be right.
---

# Verified Change Loop

Two gates, in this order:

1. **Nothing is committed** until a fresh, independent reviewer grades the change ≥ 90/100.
2. **No PR is opened** until every commit on the branch passes *and* the branch passes in aggregate.

This skill owns the gates and the rubric. [pr-reviewing](../pr-reviewing/SKILL.md) supplies the review passes; [premerge-cleanup](../premerge-cleanup/SKILL.md) calls the aggregate gate before integration; [shepherd-to-pr](../shepherd-to-pr/SKILL.md) drives the whole sequence. Keep the definitions here — a rubric duplicated across skills drifts, and then two agents disagree about what "passing" means.

## When not to use it

Three agent passes on a README typo is waste, and waste that makes the loop look ceremonial. Use it for logic changes, anything touching a trust boundary, migrations, deletions, and anything the user calls high-risk. For a docs fix or a version bump, run the hard gates alone and say that is what you did.

## Roles

| Role | Does | Must not |
|---|---|---|
| **Parent** | Orchestrates, runs hard gates, decides when to stop, commits | Grade its own or a subagent's work |
| **Patcher** subagent | Applies fixes for validated findings | Grade anything |
| **Reviewer** subagent | Finds problems, then grades against the rubric | Have written any of the code it grades |

**Independence is the whole mechanism.** A reviewer that shares context with the patcher produces a rising score and no information. Dispatch each reviewer fresh.

One asymmetry matters: a later reviewer **may** be told what previous rounds *found*, so it can confirm those were addressed. It must **never** be told what previous rounds *scored*. Findings are evidence; scores are an anchor.

## Order of operations

Thorough first, cheap second — and these agree more often than they conflict. Deterministic checks are both mandatory and nearly free, so they run first; a reviewer dispatched at a diff that already fails the test suite spends tokens to rediscover it and buries the real signal.

```
1. Hard gates          (cheap, deterministic, blocking)
2. Reviewer dispatch   (expensive — only once the gates pass)
3. Patch               (only validated findings)
4. Re-gate, re-review  (bounded)
5. Commit              (only at ≥90)
```

Keeping it cheap without thinning it out:

- Send the reviewer the **staged diff, the stated intent, and the rubric** — not the repository. Let it open what it needs.
- On round 2+, send the **delta since the last round plus the prior findings and their status**. A cold re-read of unchanged files buys nothing.
- **Group trivially small units.** Grading a three-line commit on its own costs a full pass to learn nothing; grade a coherent unit of work.
- Re-run only the gates a change could have affected. Recompute all of them before the commit itself.

## Hard gates

Binary, evidence-bearing, blocking. Checked **before** any score is discussed — a high score never buys off a failed gate.

| Gate | Evidence required |
|---|---|
| Test suite passes | The command and its exit status |
| Every behaviour change has a test that fails without it | The failing run, or the name of an existing test that covers it |
| No new type escapes or suppressions without rationale | A grep over the added lines |
| No secrets, tokens, or private endpoints added | A scan of the added lines |
| Nothing in the diff falls outside the stated intent | Changed-file list checked against the intent |
| Lint and type checks pass | Command and exit status, where the repo has them |

Take the commands from the repo's own agent docs or CI workflow. Never weaken a gate to pass it.

## Rubric

| Category | Weight | Full marks looks like |
|---|---:|---|
| **Correctness** | 25 | Holds on the unhappy paths too: empty, concurrent, failed, partial |
| **Coverage** | 20 | Tests would fail if the logic broke — not tests that assert the implementation back to itself |
| **Maintainability** | 20 | A stranger, or an agent with no context, can tell *why* from the code and its names. Follows what the repo already does |
| **Scoping** | 15 | Exactly what the intent requires. No drive-by refactors, no abstraction for a second caller that does not exist |
| **Impact** | 10 | Achieves what was asked — no less, no unrequested extra |
| **Security & blast radius** | 10 | Trust boundaries validated; failure contained and reversible |

Threshold **90/100**: at most ten points may be given up in total.

Every category score must cite a `file:line` or command output. **A score offered without evidence caps at half that category's weight.** Without that rule the rubric becomes a vibe with arithmetic attached.

## Gate 1 — before each commit

```
until graded ≥90, max 3 rounds:
  run hard gates            → any failure: patch, restart the round
  dispatch fresh reviewer   → findings + scored rubric
  validate each finding     → file:line, concrete failure, still true of current code
  dispatch patcher          → validated findings only
commit
```

Discard findings that fail validation. Acting on a hallucinated finding is worse than missing a real one: it produces a change nobody wanted and a diff nobody can explain.

If a commit already exists and a later round changes it, fold the change in with `--amend` rather than stacking — see [git-hygiene](../git-hygiene/SKILL.md).

## Gate 2 — before the PR

Every commit having passed does **not** mean the branch has. Grade the full diff against the merge-base, once, looking for what only shows up in the whole:

- Scope creep that is invisible per commit and obvious in aggregate
- Code orphaned by a later commit — added in one, unreferenced by the end
- The same problem solved two different ways in two commits
- Decisions in a late commit that contradict an early one
- A total change that no longer matches the PR description

Open the PR only when the aggregate also clears 90, and open it as a draft — the grade is evidence for a human reviewer, never a replacement for one.

## Stopping honestly

- **Three rounds per gate.** Then stop and report the real score with what remains unfixed.
- **Stop early on non-convergence.** Two rounds without material gain means the loop is not working; more rounds spend budget without changing the code.
- **Scores may fall.** A fix that introduces a problem lowers the score. Never floor a round at the previous value.
- **A failed gate blocks the commit.** That is the point. If the user wants it committed anyway, that is their call to make explicitly — do not lower the bar to reach it, and say plainly what is being waived.
- **Empty findings with a high score means the review was shallow**, not that the code is perfect. Re-dispatch once with a narrower brief before believing it.
- **Never report a threshold that was not reached.**

## Report

```
Unit: <commit subject or branch>

Round  Gates   Score  Changed
1      1 fail  —      added test for the empty-input path
2      pass    84     narrowed two casts; split the god function
3      pass    93     —

Committed at 93/100.
Weakest: Scoping 12/15 — the logging change at src/api.ts:40-88 is
         unrelated to the intent; recommend a separate PR.
```

Name the weakest category and what would fix it, even when passing. That is the part a human acts on. Report waived gates in the same breath as the score, never in a footnote.

## Claude Code notes

- Dispatch reviewer and patcher with the Task tool, as separate agents. The isolation is what the loop is buying; running both in this context reproduces the shape without the value.
- Commit only when the user has asked for commits, and open PRs as drafts — see [git-hygiene](../git-hygiene/SKILL.md).

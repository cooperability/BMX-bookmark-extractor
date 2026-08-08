---
name: shepherd-to-pr
description: >-
  One-shot pipeline from a scoped idea to a graded, reviewed draft PR: plan,
  isolate in a worktree, implement under graded review, security-check, clean up,
  and hand off. Dispatches cost-appropriate subagents per stage and stops at
  draft — never merges. Use when the user gives a scoped idea and wants it taken
  all the way to a PR, one-shot, end to end, or "just build it and open a PR".
---

# Shepherd To PR

One invocation, a scoped idea in, a draft PR out. Every stage is an existing skill; this one owns sequencing, budget, and the handoff.

**The pipeline never merges, and never marks a PR ready.** It ends with a draft on the user's doorstep. Integration is theirs, from the GitHub UI.

## The chain

| # | Stage | Skill | Produces |
|---|---|---|---|
| 1 | Plan | [plan-feature](../plan-feature/SKILL.md) | Intent, out-of-scope list, files, order, test plan |
| 2 | Isolate | [worktree-feature-pr](../worktree-feature-pr/SKILL.md) | A worktree and branch; the user's checkout untouched |
| 3 | Build | [verified-change-loop](../verified-change-loop/SKILL.md) | Commits, each graded ≥90 before it lands |
| 4 | Review | [pr-reviewing](../pr-reviewing/SKILL.md) | Findings, fed back into stage 3 |
| 5 | Security | [security-testing](../security-testing/SKILL.md) | Trust-boundary findings, fed back into stage 3 |
| 6 | Describe | [compose-pr-description](../compose-pr-description/SKILL.md) | PR title and body from the real diff |
| 7 | Clean up | [premerge-cleanup](../premerge-cleanup/SKILL.md) | Squashed, current, gates passing, aggregate graded |
| 8 | Hand off | — | Draft PR URL, grades, and what needs a human eye |

Stages 4 and 5 are review passes *inside* the loop, not separate rounds after it — their findings are validated and patched the same way. Stage 6 runs after the code settles: a description written from a plan describes what was intended, not what was built.

## Stop before you start

Two checks, both cheap, both worth more than anything downstream:

- **Is the idea actually scoped?** If `plan-feature` cannot pin intent and an out-of-scope list without guessing, stop and ask. The whole pipeline grades against that intent; a vague one produces confident work in the wrong direction.
- **Is a pipeline warranted?** A one-line fix does not need eight stages. Say so and do the small thing.

Hand the plan back before implementing when the idea is large, ambiguous, or irreversible. A wrong plan is cheap; an implementation of a wrong plan is not.

## Pricing the subagents

Match the model to the work. Judgment gets the strong model; mechanical passes get the cheap one; deterministic checks get **no agent at all** — running the test suite does not need a language model, and the biggest saving here is not dispatching for things a command answers.

| Stage | Tier | Why |
|---|---|---|
| Plan | Strongest | Every later stage is graded against this. Cheapest place to spend, most expensive to get wrong |
| Worktree setup | None — run the commands | Fully deterministic |
| Hard gates | None — run the commands | Tests, lint, grep. A model adds latency and doubt |
| Implementation | Strong | Judgment, and it is what gets graded |
| Deterministic review pass | Cheap | Pattern matching over a diff |
| Judgment review pass | Strong | The findings that matter are the non-obvious ones |
| Grading | Strong | A weak grader passes everything, which removes the gate |
| Security pass | Strong | Missed findings here are the expensive kind |
| PR description | Mid | Summarising a settled diff |
| Cleanup | Mid | Mostly scripted git, with conflict judgment |

Concretely with current Claude Code models: strongest → Opus, strong → Opus or Sonnet, mid → Sonnet, cheap → Haiku. Re-map as models change; the tiers are the durable part.

**Do not economise on the grader.** A cheap grader that passes everything does not make the pipeline cheaper — it makes it decorative, and the cost lands on the human reviewing it.

## Budget

Thoroughness first, cost second. In practice the ordering serves both: deterministic gates run before any dispatch, so a diff failing the test suite never costs a review pass.

- **Round caps** are `verified-change-loop`'s: three per gate, and stop early on non-convergence.
- **Scope each dispatch** to the diff, the intent, and the rubric — not the repository. Subagents can open what they need.
- **Never re-dispatch a stage whose inputs have not changed.** If stage 5 found nothing and nothing changed since, it does not run again.
- **Report the cost** — stages run, rounds used, roughly what was spent. The user is paying for this pipeline and should be able to see where.

## Failure handling

A stage that cannot pass does not get skipped, and does not get its bar lowered.

| Situation | Do |
|---|---|
| Blocking question surfaces mid-pipeline | Stop, ask, keep completed work. Do not guess to preserve momentum |
| A gate cannot be passed after the round cap | Stop. Report the real score and what remains. Open the draft PR anyway if the work is coherent, clearly labelled as not passing |
| Security finding at a trust boundary | Stop and surface it immediately. Do not fold a security fix in quietly |
| Rebase conflict beyond clean resolution | Abort, report the blocker, leave the branch recoverable |

Never report a stage as passed that did not pass. A pipeline that always succeeds is a pipeline that is not checking anything.

## Handoff

```
<feature> — draft PR #N

Plan       intent + out-of-scope as agreed
Build      3 commits, graded 93 / 91 / 95
Review     6 findings, 5 fixed, 1 dismissed (<why>)
Security   no findings at trust boundaries
Aggregate  92/100
Gates      all pass

Weakest    Maintainability 17/20 — <file:line>, <what would fix it>
Needs you  <judgment calls made, anything unverified>

Draft: <url>   Mark ready and merge when you are satisfied.
```

Always state the weakest category and what needs a human eye, even at a passing grade. The grade is evidence for the reviewer, never a substitute for one.

## Cursor notes

- Dispatch each stage as a separate agent, at the tier in the pricing table. Separate agents for implementation, review, and grading — the isolation is what makes the grade mean anything.
- The user invoking this skill *is* the request to launch subagents; the usual "do not launch subagents unprompted" rule does not apply to the stages listed here.
- Where separate agents are unavailable, run each stage in its own conversation, carrying only the plan, the diff, and the rubric. Never carry prior scores. Say in the handoff that stages were not isolated, rather than presenting the grade as independent.
- Run deterministic checks directly. Do not wrap a test command in an agent.
- Commit only within the loop's gates, and open the PR as a draft — see [git-hygiene](../git-hygiene/SKILL.md).

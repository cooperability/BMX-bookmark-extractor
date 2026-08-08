---
name: pr-reviewing
description: >-
  Review pull requests and local diffs for deterministic code smells (type-system
  escapes, unexplained suppressions, swallowed errors) plus security, DevEx,
  footguns, and antipatterns; optionally run a verified review loop that scores
  the PR against a rubric and iterates until it passes. Use when the user asks to
  review a PR, review changes, code review, clean up unsafe casts, or wants a
  deep/verified review with quality scoring.
---

# PR Reviewing

Review the requested PR or local diff. Default scope: current branch vs the repo default base (merge-base). If given a PR URL/number, check out or fetch that head first.

Read-only unless the user asks you to apply fixes.

## 1. Gather the diff

```bash
gh pr view <n> --json title,body,files,baseRefName,headRefName
gh pr diff <n>
# or local:
git diff $(git merge-base HEAD origin/main)...HEAD
```

Infer the real base branch if not `main`. Skim linked issues for intent.

## 2. Deterministic pass (must run)

Search the changed lines (and adjacent context) for mechanical debt. Flag or fix-propose each hit with location:

Use the rows that apply to the languages actually in the diff; ignore the rest.

| Pattern | Looks like | Why it matters |
|---------|-----------|----------------|
| Type-system escape | TS `as any` / `as unknown` / `as never`; Python `cast(Any, x)`; Go `interface{}` + unchecked assertion; Java raw types | Hides real type errors; prefer correct types, generics, or narrow guards |
| Double cast through the top type | TS `as unknown as X`; C-style reinterpret casts | Same, but deliberate — treat as high-priority smell |
| Type-checker suppression without rationale | `@ts-ignore`, `@ts-expect-error`, `# type: ignore`, `#[allow(...)]` | Require a reason comment or proper typing |
| Linter suppression without scoped rule + reason | `eslint-disable`, `# noqa`, `//nolint`, `# rubocop:disable` | Prefer fixing the violation over blanket silencing |
| Unchecked non-null / unwrap | TS `!`, Kotlin `!!`, Rust `.unwrap()` / `.expect()`, Go discarded `err` | Prefer narrowing or explicit handling |
| Empty catch / swallowed error | `catch {}`, `except: pass`, `_ = err`, `rescue nil` | At least log, or rethrow with context |
| Debug output on production paths | `console.log`, `print()`, `fmt.Println`, `dbg!` | Remove or route through the project's logger |
| Hardcoded secrets, private URLs, prod tokens | any language | Block merge |
| `TODO`/`FIXME` introduced without owner/issue | any language | Note if it ships incomplete behavior |

When removing a type escape, propose the smallest sound fix: type the boundary, add a guard or runtime validation, or correct the upstream return type. Do not trade one escape hatch for a looser runtime hack.

## 3. Abstract pass (judgment)

Prioritize issues that will hurt production or future contributors:

**Correctness & security**

- Unsanitized / unvalidated inputs at trust boundaries (HTTP, webhooks, forms, URL params)
- Authz gaps, IDOR, SSRF, XSS, injection sinks introduced or left open by the change
- Race conditions, incorrect null handling, off-by-one, broken error paths

**Footguns & antipatterns**

- Hidden global state; surprising mutation; god objects
- Leaky abstractions; copy-paste drift; premature generality
- Async hazards (missing await, floating promises, incorrect abort/cleanup)
- API shapes that invite misuse (stringly types, boolean trap params)

**DevEx**

- Unclear names; missing docs on non-obvious public APIs
- Tests absent for non-trivial logic; brittle tests that snapshot noise
- CI/config changes that weaken gates without justification
- DX papercuts: poor errors, missing `--help`, inconsistent flags

Match feedback to the project’s existing patterns—do not impose a foreign style guide.

## 4. Output format

1. **Verdict**: Approve / Approve with nits / Request changes (one line why).
2. **Blocking** — must fix before merge.
3. **Should fix** — real issues, non-blocking if user accepts risk.
4. **Nits** — style/clarity; keep short.
5. **Deterministic cleanup list** — cast/lint suppressions table (`file:line`, pattern, suggested fix).

Per finding: severity, `file:line`, what’s wrong, concrete fix. No filler praise. No repeating the PR description.

## 5. Deep mode

An escalation, not the default. Use it when the user asks for a deep, verified, or graded review, or when the change is high-risk: migrations, auth, money, data deletion, anything hard to reverse.

Deep mode is this skill's review passes driven by [verified-change-loop](../verified-change-loop/SKILL.md), which owns the hard gates, the rubric, and the stopping rules. Do not restate the rubric here — one definition, so two agents cannot disagree about what passing means.

The division:

| This skill supplies | The loop supplies |
|---|---|
| What to look for — sections 2 and 3 | When to dispatch, and to whom |
| How to phrase a finding | The gates that block before any score counts |
| The output format in section 4 | The rubric, the 90 threshold, and when to stop |

Two rules belong here, because they are about reviewing rather than orchestration:

- **Validate every finding before it is acted on.** It needs a `file:line`, a concrete failure scenario, and confirmation that it still applies to current code. Discard the rest: acting on a hallucinated finding produces a change nobody wanted and a diff nobody can explain — worse than missing a real issue.
- **A reviewer that returns nothing has not proven the code is clean.** Empty findings on a non-trivial diff mean the brief was too broad or the pass was shallow. Narrow the scope and re-dispatch once before believing it.

## Claude Code notes

- Use `gh` and the local diff; when GitHub MCP is available, use it for PR metadata and review comments.
- Post review comments to GitHub only if the user asks.
- Deep mode uses the Task tool for the reviewer and evaluator passes. Dispatch them as separate agents so neither inherits the other's context — that isolation is what the mode is buying.

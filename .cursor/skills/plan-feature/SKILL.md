---
name: plan-feature
description: >-
  Turn a scoped idea into an implementation plan before any code is written:
  intent, out-of-scope list, files to touch, order of work, test strategy, risks,
  and blocking questions. Use when the user describes a feature or change and
  wants it planned, scoped, or broken down before implementation starts.
---

# Plan Feature

Produce the plan a competent implementer would need — including the parts that are easy to skip and expensive to discover later.

The output of this skill becomes the **stated intent** that everything downstream is checked against: the hard gates in [verified-change-loop](../verified-change-loop/SKILL.md) test whether the diff stays inside it, and the Scoping and Impact categories grade against it. A vague plan cannot be graded, so vagueness here is not neutral — it disables the checks later.

## 1. Read before planning

The most common failure is a plan that invents conventions the repo already has.

```bash
git log --oneline -20
```

Find the nearest existing thing — a sibling feature, a parallel route, an analogous module — and read it. Check `CLAUDE.md`, `AGENTS.md`, and the README for commands and constraints. Note the test framework and how tests are actually written here, not how they are usually written.

Prefer extending an existing pattern over introducing a better one. A second way of doing something costs more than the first way's imperfection.

## 2. Pin the intent

Write, in one or two sentences, what **done** looks like — observable behaviour, not implementation. "Users can export a report as CSV from the reports page" rather than "add a CSV export function".

Then the part that does the work:

**The out-of-scope list.** Name what this change deliberately does *not* do, especially the adjacent things a reasonable person might assume are included. This is the highest-value line in the plan: it is what stops scope creep during implementation and what the Scoping grade is measured against.

If intent cannot be pinned without an answer from the user, that is a blocking question — see section 6.

## 3. Choose the smallest change that gets there

Identify the minimum change achieving the intent. Then check it against three failure modes:

| Failure | Looks like | Test |
|---|---|---|
| Premature abstraction | A generic layer for a second caller that does not exist | Is there a second caller *today*? |
| Scope creep | Refactors bundled with the feature | Would this be worth doing on its own? |
| Under-building | A path that will need rewriting on the next obvious requirement | Does the next known requirement fit without a rewrite? |

Under-building is real and less discussed than over-building. The test is the *next known* requirement, not every imaginable one.

## 4. Plan the work

- **Files to touch**, with a phrase each on what changes. Flag anything shared, generated, or user-facing.
- **Order**, chosen so the tree is coherent at each step — types and interfaces before consumers, migration before the code that depends on it.
- **Commit boundaries**, since each one will be graded independently. A boundary should be a unit that stands on its own.

## 5. Plan the tests first

Decide, before implementing, what would fail if this broke. Vague test plans produce tests that assert the implementation back to itself and catch nothing.

For each behaviour: the case, and the assertion that fails without the change. Cover the unhappy paths the Correctness grade will ask about — empty, concurrent, failed, partial. Name anything genuinely not worth testing, and why.

## 6. Risks and blocking questions

**Risks**: what could go wrong, how it would show, and what makes it reversible. Call out anything touching a trust boundary, a migration, deletion, or shared state.

**Unknowns**: what you could not determine from the repo, and how you would find out.

**Blocking questions**: only those where proceeding on a wrong assumption would waste the work or be unsafe. Ask them now — mid-implementation is the expensive time to discover an ambiguity. Everything else gets an assumption, stated explicitly, and the work continues.

## 7. Output

```
Intent
  <one or two sentences: observable done>

Out of scope
  - <the adjacent thing this deliberately does not do>

Approach
  <the smallest change, and why not smaller or larger>

Files
  path/to/file      <what changes>

Order
  1. <step>

Tests
  <behaviour> → <assertion that fails without the change>

Risks
  <risk> → <how it shows> → <how to reverse>

Assumptions
  <stated assumption, proceeding on it>

Blocking questions
  <only if proceeding would be unsafe or wasteful>
```

Hand the plan over before implementing, unless the user asked for the whole thing in one pass. A plan that is wrong is cheap to fix; an implementation of a wrong plan is not.

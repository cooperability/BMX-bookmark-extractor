---
name: integration-hunting
description: >-
  Search the user's GitHub stars for open-source repos, frameworks, and libraries
  that could improve the local repository, then recommend concrete integrations.
  Use when the user asks to hunt integrations, mine stars, find libraries from
  starred repos, or suggest OSS that fits this codebase.
---

# Integration Hunting

Mine the authenticated user’s GitHub stars for OSS that would materially improve **this** local repo. Prefer GitHub MCP; fall back to `gh`/`curl` against the Stars API.

## 1. Profile the local project

Skim only what you need:

- Stack & language (manifests, lockfiles, framework markers)
- App type (library, API, CLI, web app, monolith, monorepo)
- Pain points from README, issues, TODOs, rough edges in code
- Existing dependencies—do not recommend duplicates or near-duplicates without a clear upgrade path

Write a 3–6 bullet “needs” list (e.g. better auth, queue, schema validation, DX tooling, UI primitives, observability). If the user named a theme, bias the hunt to that.

## 2. Fetch stars

```bash
# Authenticated user stars (paginate)
gh api user/starred --paginate \
  --jq '.[] | {full_name, description, language, stargazers_count, topics, html_url, pushed_at}'
```

If MCP exposes starred-repos listing, use that. Cap deep reads: fetch metadata for all pages you can, then inspect READMEs only for shortlisted candidates.

Heuristics while filtering:

- Language/ecosystem overlap with the local project (or polyglot tools that still fit, e.g. CLIs)
- Recent maintenance (`pushed_at` within ~18 months unless it’s a stable staple)
- Clear license compatible with the project (flag unknown/copyleft for the user)
- Not already in `package.json` / equivalent (unless a major version jump is the point)

## 3. Score & shortlist

Rank 5–12 candidates:

| Score | Criteria |
|-------|----------|
| Fit | Solves a stated or observed local need |
| Quality | Docs, tests, adoption, maintenance |
| Cost | Integration effort vs benefit |
| Risk | Bundle size, ops burden, security surface |

Drop cute-but-irrelevant stars. Prefer libraries/frameworks you can actually wire in over inspirational apps—unless the user asked for architecture inspiration.

## 4. Deep-dive the top picks

For the top 3–5:

1. Read README + quickstart (and LICENSE).
2. Sketch **how** it would land in this repo (files/modules touched, dep add, config).
3. Call out alternatives already starred or commonly used.
4. Note “do not adopt” if the star is abandoned, overlaps poorly, or fights existing architecture.

## 5. Deliverable

Lead with the best 1–2 recommendations and why.

Then a table:

| Repo | Why it fits | Integration sketch | Effort | Priority |

Optional: a minimal spike plan for the top pick (half-day shape). Do **not** add dependencies or rewrite the app unless the user asks to proceed.

## Rules

- Stars are a search corpus, not an authority—reject popular mismatches.
- Do not recommend spyware, ToS-violating scrapers, or unmaintained crypto-miner-adjacent tools.
- If star fetch fails (auth), ask the user to `gh auth login` or provide a username whose public stars are readable: `gh api users/<user>/starred --paginate`.

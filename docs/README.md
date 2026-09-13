# Documentation

Product and architecture docs live in this folder.

| Doc | What it is |
|---|---|
| [PRD.md](./PRD.md) | Product: Remediate, BMX harvest, Cards, Quest |
| [TDD.md](./TDD.md) | Stack decisions and why |
| [PIPELINE.md](./PIPELINE.md) | Build order |
| [OVERHAUL.md](./OVERHAUL.md) | What this cut actually deleted, measured, and left open |

Setup and environment: [root README](../README.md), [TROUBLESHOOTING.md](../TROUBLESHOOTING.md), [.devcontainer/README.md](../.devcontainer/README.md).

Older FastAPI, Neo4j, Gemini, and 1-day-MVP write-ups were deleted with the services they described. If a leftover README still links to `documentation/` or to `hybrid-database-architecture.md`, that link is stale.

## Current stack (do not re-platform)

The app at the repo root is **SvelteKit 2 + Svelte 5**. There is no Next.js or React in the tree. Remaining work is Cards, Quest, and BMX triage on that scaffold, not another framework swap.

SvelteKit `+server.ts` routes are the API. `@sveltejs/adapter-vercel` is the deploy target. See [TDD.md §2](./TDD.md#2-stack-decisions).

Python survives only as the planned `api/extract.py` (Phase 4). Do not grow a FastAPI service, and do not add Next.js to "fix" a Dependabot alert.

## Dependabot

`.github/dependabot.yml` watches npm at `/` and GitHub Actions. The pip and Docker ecosystems on `/backend` and `/frontend` are gone with those trees.

Do not introduce or restore Next.js or React packages to clear an alert.

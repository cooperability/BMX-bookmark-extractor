# Documentation

Product and architecture live in four files. Setup is the root README.

| Doc                          | What it is                                                                  |
| ---------------------------- | --------------------------------------------------------------------------- |
| [ROADMAP.md](./ROADMAP.md)   | Ranked backlog: open bugs and remaining epics as task cards. Start here     |
| [PRD.md](./PRD.md)           | Product: Remediate, BMX harvest, Cards, Quest                               |
| [TDD.md](./TDD.md)           | Stack decisions and why                                                     |
| [PIPELINE.md](./PIPELINE.md) | The original July build plan. History only: ROADMAP.md replaced its backlog |

The root README carries the systems diagram with built versus planned status, setup, and the Vercel deploy step. `./scripts/container` is the optional Docker entry point.

The app at the repo root is SvelteKit 2 plus Svelte 5. There is no Next.js, React, FastAPI, or Neo4j in the tree. Cards, Quest's core loop, and BMX harvest are built. ROADMAP.md ranks what remains.

`.github/dependabot.yml` watches npm at `/` and GitHub Actions.

# Documentation

Product and architecture live in three files. Setup is the root README.

| Doc                          | What it is                                    |
| ---------------------------- | --------------------------------------------- |
| [PRD.md](./PRD.md)           | Product: Remediate, BMX harvest, Cards, Quest |
| [TDD.md](./TDD.md)           | Stack decisions and why                       |
| [PIPELINE.md](./PIPELINE.md) | Build order                                   |

The root README carries the systems diagram with built versus planned status. [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) covers Docker engine-down failures. `./scripts/container` is the optional Docker entry point.

The app at the repo root is SvelteKit 2 plus Svelte 5. There is no Next.js, React, FastAPI, or Neo4j in the tree. Remaining work is Cards, Quest, and BMX triage on that scaffold.

`.github/dependabot.yml` watches npm at `/` and GitHub Actions.

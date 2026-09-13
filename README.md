# Remediate

Remediate turns a personal knowledge corpus into one connected graph and exposes it through surfaces that share a single backend.

- **BMX** (BookMark eXtractor) harvests URLs. Paste links, and their content is fetched, extracted, triaged by Claude, and slotted into the graph with a deck and tags. This is the project's original vision and the reason the repo is named what it is.
- **Cards** is an Anki-compatible spaced-repetition surface fed by your existing decks.
- **Quest** is an exploratory game played over the same graph, where rooms are concepts and doors are relationships.

What makes it one product rather than three: the scheduler's memory model and the game's progression gate are the same column in the same table.

## State

Early. The scaffold and the design docs are real. Most product surfaces are not built yet.

| Area | State |
|---|---|
| SvelteKit 2 + Svelte 5 app at the repo root | Built |
| Anki TSV parser and HTML sanitizer | Built. Ground truth 457 records. Vitest runner still red. See docs/OVERHAUL.md |
| Drizzle schema for the graph | Built, not yet migrated |
| Auth (oslo + Argon2id) | Scaffold |
| Cards, Quest, BMX harvest | Not started |

Read [docs/PRD.md](docs/PRD.md) for what and why, [docs/TDD.md](docs/TDD.md) for how, and [docs/PIPELINE.md](docs/PIPELINE.md) for build order.

## Run it locally

Requires Node 20 and Corepack. No Docker, no database, and no API keys are needed to run the app.

```bash
git clone https://github.com/cooperability/BMX-bookmark-extractor.git
cd BMX-bookmark-extractor
corepack enable
yarn install --frozen-lockfile
yarn dev          # http://localhost:3000
```

Verify the parser against the real Anki exports in `source_data/`:

```bash
yarn test:server  # asserts 320 + 137 = 457 records
```

Other commands:

| Command | Does |
|---|---|
| `yarn lint` | Prettier check plus ESLint |
| `yarn check` | `svelte-check` against `tsconfig.json` |
| `yarn test:e2e` | Playwright |
| `yarn db:push` | Push the Drizzle schema (needs `DATABASE_URL`) |

A devcontainer is available for editor-integrated development. Run `./scripts/open_devcontainer`, or open the folder and choose "Reopen in Container". It is a plain Node container, not a compose stack.

## Configuration

Copy `.env.example` to `.env`. Every variable is optional until its phase lands.

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Neon Postgres with pgvector. Everything that persists. |
| `ANTHROPIC_API_KEY` | AI enrichment and BMX triage. |
| `INTERNAL_TOKEN` | Authenticates the cron worker to `api/extract.py`. |

## Architecture

One Vercel project. One TypeScript app. SvelteKit `+server.ts` routes are the API, so there is no second deployable and no internal network hop. Data lives in Neon Postgres, with embeddings in pgvector beside the rows they describe.

Python survives as exactly one cold-path function, `api/extract.py`, which runs `trafilatura` behind an SSRF guard. It has one caller (the cron worker), one job, and no database credentials. That isolation is the point: BMX fetches arbitrary user-supplied URLs, which is the highest-severity surface in the product.

The deliberate absences are argued in [TDD §3](docs/TDD.md#3-the-roads-not-taken): no Neo4j, no dedicated vector database, no second HTTP service, and no Docker in production.

## Source data

`source_data/` holds the real Anki exports and bookmark metadata, and doubles as the test fixture directory. Treat it as read-only. A find-and-replace across the repo will match URLs and identifiers inside `articles.csv` and `ArticleMetadata.db` and corrupt them.

## License

[LICENSE](LICENSE)

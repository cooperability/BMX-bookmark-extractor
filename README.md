# Remediate

Remediate turns a personal knowledge corpus into one connected graph and exposes it through surfaces that share a single backend.

- **BMX** (BookMark eXtractor) harvests URLs. Paste links, and their content is fetched, extracted, triaged by Claude, and slotted into the graph with a deck and tags. This is the project's original vision and the reason the repo is named what it is.
- **Cards** is an Anki-compatible spaced-repetition surface fed by your existing decks.
- **Quest** is an exploratory game played over the same graph, where rooms are concepts and doors are relationships.

The scheduler's memory model and the game's progression gate are the same column in the same table.

Read [docs/PRD.md](docs/PRD.md) for what and why, [docs/TDD.md](docs/TDD.md) for how, and [docs/PIPELINE.md](docs/PIPELINE.md) for build order.

## Systems

Status is a separate channel from kind. Green and a solid border means it exists in the tree today. Amber means a scaffold or schema exists, with no live data and no user flow. Grey, a dashed border, and a `planned` edge label means it is not started.

```mermaid
flowchart TD
  classDef built fill:#dff5e1,stroke:#2e7d32,color:#1b3d20
  classDef partial fill:#fff4d6,stroke:#c98a00,color:#4a3400
  classDef planned fill:#f2f2f2,stroke:#9e9e9e,color:#3d3d3d,stroke-dasharray:4 3

  owner((Owner)):::built
  anki[(Anki TSV)]:::built
  paste(["Paste URLs"]):::planned

  subgraph vercel ["Vercel one project"]
    ssr[SvelteKit SSR]:::built
    ingest[Anki ingest]:::partial
    cards[Cards]:::planned
    quest[Quest]:::planned
    bmx[BMX harvest]:::planned
    cron(["cron tick"]):::planned
    extract["api extract.py"]:::planned
  end

  pg[("Neon plus pgvector")]:::partial
  claude{{"Claude API"}}:::planned
  web{{"Untrusted URLs"}}:::planned

  owner --> ssr
  owner --> ingest
  anki --> ingest
  owner -.->|planned| paste
  ssr -.->|planned| cards
  ssr -.->|planned| quest
  ingest -.->|planned persist| pg
  cards -.->|planned| pg
  quest -.->|planned| pg
  paste -.->|planned| bmx
  bmx -.->|planned| cron
  cron -.->|planned| extract
  extract -.->|planned| web
  cron -.->|planned| claude
  cron -.->|planned| pg
```

VS Code built-in preview shows the fence as a code block. The Markdown Preview Mermaid Support extension renders it. GitHub renders it natively.

| Status  | Meaning                                                 |
| ------- | ------------------------------------------------------- |
| Built   | In the tree and exercised                               |
| Partial | Scaffold or schema only                                 |
| Planned | Not started. Drawn so absence is not read as accidental |

What exists today: the SvelteKit app at the repo root, the Anki TSV parser and HTML sanitizer, a Drizzle schema that has not been migrated, and an oslo auth scaffold. Cards, Quest, BMX harvest, `api/extract.py`, cron, and a live Neon database are not built.

### Boundary: browser to Vercel

The user hits one origin. SvelteKit `+server.ts` routes are the API. A second HTTP service would add a second auth boundary and a hop inside our own app. That is why `backend/` is gone.

### Boundary: cron to extract.py

BMX fetches arbitrary user-supplied URLs. That is SSRF by construction. The extractor is a separate runtime with a shared internal token and no database credentials. A compromise there reaches the internet, not Neon. The file is not in the tree yet. The isolation is why the FastAPI service was deleted instead of trimmed.

### Boundary: app to Neon

Every table carries `user_id` on the row so Phase 1 can attach RLS without a join. The schema is code only. No migration has been applied. `DATABASE_URL` is unset.

## Run it locally

Requires Node 22 and Corepack. No Docker, no database, and no API keys are needed to run the app. `isomorphic-dompurify` 4.2.0 refuses to install on Node 20.

```bash
git clone https://github.com/cooperability/BMX-bookmark-extractor.git
cd BMX-bookmark-extractor
corepack enable
yarn install --frozen-lockfile
yarn dev          # http://localhost:3000
```

Same loop inside Node 22, when you want isolation or the host has no Node:

```bash
./scripts/container yarn dev
```

`scripts/container` is the one Docker entry point. There is no Dev Container and none is coming back. If `docker info` fails, start Docker Desktop and retry. A client-only `docker version` is not enough.

Keep the clone off OneDrive. A OneDrive-backed checkout makes file watchers and bind mounts unreliable, and an editor pointed at a second clone will report failures the real tree does not have.

Parser ground truth, Confirmed against `source_data/` by `yarn test:server` on Node 22.23.1, 46 of 46 green.

| File    | Raw lines | Records | Unique GUIDs | Multiline backs |
| ------- | --------: | ------: | -----------: | --------------: |
| Anthro  |      4053 |     320 |          320 |             123 |
| CompSci |       576 |     137 |          137 |              23 |
| Total   |      4629 | **457** |      **457** |                 |

| Command                     | Does                                           |
| --------------------------- | ---------------------------------------------- |
| `yarn lint`                 | Prettier check plus ESLint                     |
| `yarn check`                | `svelte-check` against `tsconfig.json`         |
| `yarn test:server`          | Parser and sanitizer unit tests, 46 of 46      |
| `yarn test:e2e`             | Playwright                                     |
| `yarn test`                 | Both of the above                              |
| `yarn db:push`              | Push the Drizzle schema (needs `DATABASE_URL`) |
| `./scripts/container <cmd>` | Same commands in a Node 22 image               |

## Local development

1. `yarn db:up` starts Postgres 17 with pgvector on port 5433 (`docker-compose.yml`).
2. `cp .env.example .env`, then set `DATABASE_URL="postgres://postgres:dev@localhost:5433/remediate"` and add your address to `ALLOWED_EMAILS`.
3. `yarn db:migrate` applies `drizzle/`. After a schema change, `yarn db:generate` writes the next migration.
4. `yarn db:seed you@example.com` creates that user and imports both `source_data/` decks, 457 cards. Rerunning it updates in place.
5. `yarn dev`, then request a login code. With `GMAIL_USER` unset, the dev server terminal prints `[auth] login code for <email>: <code>`.
6. `yarn db:down` stops the container and keeps the data volume.

Keep one database on one path. `db:migrate` records what it applied, and `db:push` does not, so a later `db:migrate` against a pushed database fails on tables that already exist. Use `db:push` only on a throwaway database.

With `DATABASE_URL` set, `yarn test:server` also runs the database tests (`*.db.test.ts` and `repo.test.ts`). They create and delete their own rows, and they need the schema from `db:migrate`. CI has no database and skips them.

Days, streaks, and the daily new-card cap follow the browser's time zone, which the app stores in a `tz` cookie on first load. Until then they use UTC.

## Deploy

The Vercel Git integration owns every deploy. It builds production on `main` and a preview on each pull request. There is no second deploy path. GitHub Actions runs lint, typecheck, and `yarn test:server` on Node 22, and deploys nothing.

Root Directory must be `.`. Confirmed 2026-09-16 against project `prj_RnBD1bE2cYV61qnpATWrMV0qUnJI`: Root Directory reads `frontend`, so the build aborts 0.6 seconds after clone with "The specified Root Directory frontend does not exist," before install. Nothing in this repository can fix that. Root Directory is a dashboard setting and `vercel.json` cannot override it.

Every other setting is already right: Node.js 22.x, framework preset SvelteKit, `yarn install`, `yarn build`. Changing Root Directory to `.` is the single remaining step.

## Configuration

Copy `.env.example` to `.env`. Every variable is optional until its phase lands.

| Variable            | Needed for                                             |
| ------------------- | ------------------------------------------------------ |
| `DATABASE_URL`      | Neon Postgres with pgvector. Everything that persists. |
| `ANTHROPIC_API_KEY` | AI enrichment and BMX triage.                          |
| `INTERNAL_TOKEN`    | Authenticates the cron worker to `api/extract.py`.     |

## Source data

`source_data/` holds the real Anki exports and bookmark metadata, and doubles as the test fixture directory. Treat it as read-only. A find-and-replace across the repo will match URLs and identifiers inside `articles.csv` and `ArticleMetadata.db` and corrupt them.

## License

[LICENSE](LICENSE)

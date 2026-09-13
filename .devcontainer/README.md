# Dev container

Optional. A single Node 20 image so the editor, extensions, and toolchain match. No compose stack, no FastAPI service, no Neo4j.

The product does not need this. On the host: `corepack enable && yarn install --frozen-lockfile && yarn dev`. An agent that can start its own cloud VM does not need it either.

## Open it

1. Docker Desktop running (client **and** engine). See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) if "Reopen in Container" dies in WSL before this config is even read.
2. `./scripts/open_devcontainer`, or open the folder and choose "Reopen in Container".

`postCreateCommand` runs `corepack enable && yarn install --frozen-lockfile`. Port 3000 is forwarded for `yarn dev`.

Python returns in Phase 4 as `api/extract.py`. Until then the container is TypeScript only.

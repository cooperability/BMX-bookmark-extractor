# Dev container

A single Node 20 image. No compose stack, no FastAPI service, no Neo4j.

## Open it

1. Docker Desktop running.
2. `./scripts/open_devcontainer`, or open the folder and choose "Reopen in Container".

`postCreateCommand` runs `corepack enable && yarn install --frozen-lockfile`. Port 3000 is forwarded for `yarn dev`.

Python returns in Phase 4 as `api/extract.py`. Until then the container is TypeScript only.

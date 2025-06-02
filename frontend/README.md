# BMX Frontend (SvelteKit)

This directory contains the SvelteKit frontend for BMX (BookMark eXtractor).

## Structure

```
frontend/
├── src/                    # Application source code
├── static/                 # Static assets
├── e2e/                   # End-to-end tests
├── .storybook/            # Storybook configuration
├── Dockerfile             # Container image definition
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── svelte.config.js       # SvelteKit configuration
└── tailwind.config.js     # Tailwind CSS configuration
```

## Development

**Key Commands (from project root):**
- `./scripts/dc_exec frontend yarn <command>` - Execute Yarn commands in container
- `./scripts/dc_exec frontend yarn dev` - Start development server
- `./scripts/dc_exec frontend yarn build` - Build for production

**Adding Dependencies:**
```bash
./scripts/dc_exec frontend yarn add <package>        # Runtime dependency
./scripts/dc_exec frontend yarn add -D <package>     # Dev dependency
```

## Configuration Notes

**Package Management:**
- Uses Yarn (managed via Corepack) instead of npm
- Node.js container with Corepack enables Yarn without separate installation
- Anonymous volume for `node_modules` prevents host mount conflicts

**Docker & Vite Configuration:**
- Vite dev server configured with `host: '0.0.0.0'` for Docker accessibility
- Port 3000 exposed and accessible from host
- Frontend container uses service names (e.g., `http://backend:8000`) for internal communication

**SvelteKit Adapter:**
- Uses `@sveltejs/adapter-vercel` instead of `@sveltejs/adapter-auto`
- Auto-adapter can cause cryptic "module not found" errors during builds

## Migration from Next.js: Key Learnings

This frontend was migrated from Next.js to SvelteKit. Key insights from the process:

**Dependency Cleanup Challenges:**
- Removing framework packages requires thorough cleanup of associated tooling
- Configuration files (e.g., `project.inlang/`, `messages/`) may persist
- Plugin registrations in bundler configs need manual removal
- HTML templates and script files may contain stray references

**Caching Layer Management:**
- Docker, Vite, and SvelteKit all have aggressive caching mechanisms
- Required frequent cache clearing during migration: `docker builder prune -af`, `docker system prune -af`
- Delete `node_modules` and `.svelte-kit` when debugging persistent errors
- Use `docker compose up --build --force-recreate` for clean rebuilds

**Essential SvelteKit Commands:**
- `svelte-kit sync` generates crucial type definitions and `.svelte-kit/tsconfig.json`
- Ensure `tsconfig.json` correctly extends SvelteKit-generated configuration
- Use `grep` or project-wide text search to locate hidden references to removed libraries

**Debugging Dockerized Setups:**
- Temporarily change Dockerfile `CMD` to `tail -f /dev/null` for manual investigation
- Execute commands interactively in running containers to debug installation issues
- Examine Docker build and runtime logs carefully for subtle errors

## Build Optimization

**Performance Considerations:**
- Ensure comprehensive `.dockerignore` to reduce build context size
- Check asset sizes being copied into Docker images
- Leverage Docker layer caching for faster builds
- Monitor SvelteKit `.svelte-kit` directory size during development

**Production Build:**
```bash
./scripts/dc_exec frontend yarn build
./scripts/dc_exec frontend yarn preview  # Preview production build
```

## Current Status

- **Health Check**: Implemented `/health` page that successfully fetches from FastAPI backend
- **Migration Complete**: Next.js fully removed, clean SvelteKit foundation established
- **Package Manager**: Standardized on Yarn throughout frontend toolchain
- **Docker Integration**: Properly configured for containerized development workflow

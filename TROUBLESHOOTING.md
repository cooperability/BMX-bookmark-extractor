# Troubleshooting

Host-level failures when Docker is involved. The app itself does not need Docker.

```bash
corepack enable && yarn install --frozen-lockfile && yarn dev
```

Use `./scripts/container <cmd>` when you want Node 22 in Docker instead of the host toolchain. An agent should use that same script. Node 20 will not install `isomorphic-dompurify` 4.2.0.

If the editor or a log points at a second clone (for example under OneDrive), stop. Work in `...\Documents\GitHub\BMX-bookmark-extractor`. OneDrive-backed git trees make file watchers and bind mounts unreliable.

## `./scripts/container` cannot talk to Docker

1. `spawn …\docker.exe ENOENT`. The Windows Docker CLI is missing at the path the tools expect. Install or repair Docker Desktop. This is not a project config bug.
2. `docker version` prints a client and then `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. The engine is down. Start Docker Desktop and wait until it is healthy. A client-only result is not enough.
3. `wsl -l -v` shows `docker-desktop` **Stopped**. Same failure. Start Docker Desktop. The extension-era WSL probe (`wsl -d docker-desktop`) is gone with the Dev Container. You only need a running engine.

Confirm, then retry the script:

```bash
docker version
wsl -l -v
./scripts/container yarn --version
```

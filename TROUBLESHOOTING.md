# Troubleshooting

Host-level failures. Windows, WSL, or Docker Desktop is unhealthy, so the Dev Containers extension never reaches the project config.

The app itself does not need Docker. From the clone: `corepack enable && yarn install --frozen-lockfile && yarn dev`. Use this page when you chose "Reopen in Container" and the editor never got that far.

If the log's first workspace line is not this clone, stop and open the right folder. Dev Containers bind to whatever path Cursor had open. A second copy (for example under OneDrive) looks like "the project is broken" while you are not even in this tree.

## Read the log in order

A typical Windows failure looks like a Dev Container bug and is not:

1. `Setting up container for folder or workspace: …` This is the clone actually being opened. It must match the repo you mean to work in (`…\Documents\GitHub\BMX-bookmark-extractor` for this machine's canonical copy).
2. `Start: Run: wsl -d docker-desktop` as user `root`. The extension is talking to Docker Desktop's **internal** WSL distro, not your Ubuntu distro. If Docker Desktop is stopped, that distro is stopped.
3. `…/node: not found` and host server exit **127**. The remote-server Node binary was never installed in that distro (paths tried include `.cursor-server`, `.cursor/cli/servers`, `.vscode-remote-containers`). Cleaning `~/.vscode-server` does not fix a distro that is not running.
4. `Could not connect to WSL` / `stream ended with:0 but wanted:9`. The WSL probe died after step 3. Symptom, not root cause.
5. `spawn C:\Program Files\Docker\Docker\resources\bin\docker.exe ENOENT`. The Windows Docker CLI is missing at the path the extension hardcodes. Different from "daemon not running": ENOENT is "no binary". A missing named pipe (`dockerDesktopLinuxEngine`) is "binary exists, engine is down."

**2026-08-21 re-check (still holds):** the CLI is present (`docker version` prints a client). Both `Ubuntu` and `docker-desktop` WSL distros were **Stopped**, and the engine pipe `dockerDesktopLinuxEngine` was missing, so the live failure is "Desktop not running," not ENOENT. The log's workspace was `...\OneDrive\Documents\GitHub\BMX-bookmark-extractor`. That path is gone. Work in `...\Documents\GitHub\BMX-bookmark-extractor`.

## Fix the host, then retry Dev Containers

1. Start **Docker Desktop** and wait until it is healthy (system-tray icon not stuck on "starting").
2. Confirm the CLI and the engine, from Git Bash or PowerShell:

   ```bash
   docker version
   wsl -l -v
   ```

   You want a client **and** a server, and `docker-desktop` **Running**. `docker version` with only a client plus `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` means the engine is down. Start Docker Desktop. Do not rebuild the Dev Container yet.

3. Confirm you opened the canonical clone, not a synced duplicate. OneDrive-backed git working trees make Dev Containers and file watchers unreliable. Keep this repo off OneDrive.

4. Only after the engine is up, if the remote server is still stale, clean caches **inside the WSL distro the log used** (often `docker-desktop`, as root), then "Rebuild Container":

   ```bash
   wsl -d docker-desktop -e sh -c 'rm -rf /root/.vscode-server /root/.vscode-remote-containers /root/.cursor-server /root/.cursor'
   ```

   Cursor may identify as VS Code in the log (for example VS Code 1.99.x + Dev Containers 0.394.x). The extension still looks for `vscode-remote-containers` Node paths. Those 127s are the same class of failure as a missing `cursor-server`.

## Skip the container

The Dev Container is editor sugar: Node 20 plus the Svelte and ESLint extensions, with `yarn install` in `postCreateCommand`. It is not the runtime for Remediate. Production is `git push` to Vercel.

If the IDE remote stack keeps failing, stay on the host:

```bash
corepack enable
yarn install --frozen-lockfile
yarn dev
```

An agent that can start its own cloud VM does not need this file either. The committed `.devcontainer/` is for a human who wants the editor inside a matching Node image on this machine.

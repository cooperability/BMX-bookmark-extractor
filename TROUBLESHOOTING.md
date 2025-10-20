# BMX Troubleshooting Guide

## Critical System Issues

### 🔴 Docker Desktop Not Running (Current Issue)

**Symptoms:**
```
spawn C:\Program Files\Docker\Docker\resources\bin\docker.exe ENOENT
Error: Docker returned an error code ENOENT
```

**Root Cause**: Docker Desktop is not running or not properly installed on Windows.

**Solutions:**

#### Option 1: Start Docker Desktop (Quickest)
1. Open Docker Desktop from Start Menu
2. Wait for Docker engine to start (green icon in system tray)
3. Verify with: `docker ps` in PowerShell/Git Bash
4. If successful, restart VS Code and reopen in container

#### Option 2: Reinstall Docker Desktop (If Corrupted)
1. Download latest: https://www.docker.com/products/docker-desktop
2. Run installer as Administrator
3. Ensure "Use WSL 2 instead of Hyper-V" is checked
4. Restart computer after installation
5. Start Docker Desktop and complete setup

#### Option 3: Configure WSL2 Integration
```powershell
# From PowerShell (Admin)
wsl --install
wsl --set-default-version 2
wsl --update
```

Then in Docker Desktop:
- Settings → Resources → WSL Integration
- Enable integration with your WSL2 distros
- Apply & Restart

---

### 🔴 WSL2 VS Code Server Corruption

**Symptoms:**
```
Host server: /bin/sh: /root/.vscode-remote-containers/bin/.../node: not found
Error reading shell environment
Could not connect to WSL
```

**Root Cause**: Corrupted VS Code Remote Server files in WSL2.

**Solution: Clean WSL2 VS Code Cache**
```bash
# From WSL2 terminal (or Git Bash connecting to WSL)
rm -rf ~/.vscode-server
rm -rf ~/.vscode-server-insiders
rm -rf ~/.vscode-remote-containers
rm -rf ~/.cursor-server
rm -rf ~/.cursor

# If using Cursor IDE
rm -rf ~/.cursor*
```

**Alternative: Reset WSL2 Distribution**
```powershell
# From PowerShell (CAUTION: Deletes all data in distro)
wsl --list
wsl --unregister docker-desktop
wsl --unregister docker-desktop-data

# Restart Docker Desktop to recreate
```

---

## Development Environment Setup

### Initial Setup Checklist

- [ ] Docker Desktop installed and running
- [ ] WSL2 configured and updated
- [ ] VS Code installed with "Dev Containers" extension
- [ ] Git for Windows installed (if using Windows host)
- [ ] At least 8GB RAM available for Docker
- [ ] At least 20GB disk space for images/volumes

### Choosing Your Development Workflow

#### Method 1: DevContainer (Recommended for Full IDE Experience)
```bash
# Prerequisites check
docker --version         # Should show Docker version
docker ps               # Should list running containers (or empty list)

# Then in VS Code
1. Open project folder
2. F1 → "Dev Containers: Reopen in Container"
3. Wait for build (5-10 minutes first time)
```

**When to use:**
- ✅ You want full IntelliSense with container dependencies
- ✅ You prefer integrated terminal inside container
- ✅ You're comfortable with VS Code
- ✅ You want debugging to work seamlessly

#### Method 2: Docker Compose (Recommended for Simplicity)
```bash
# From host terminal (Git Bash)
cd /c/Users/coope/Documents/GitHub/BMX-bookmark-extractor

# Start services
./scripts/dc_up

# Run backend
./scripts/dc_exec backend poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Run frontend (separate terminal)
./scripts/dc_exec frontend yarn dev

# View logs
docker compose logs -f backend
```

**When to use:**
- ✅ You want simpler setup
- ✅ You're managing multiple services
- ✅ You prefer your native editor
- ✅ You're familiar with Docker Compose

---

## Common Issues & Solutions

### "Port 8000 already in use"
```bash
# Find what's using the port
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # macOS/Linux

# Stop BMX containers
docker compose down

# Or kill specific process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # macOS/Linux
```

### "Cannot install Poetry dependencies"
```bash
# From inside container or via dc_exec
poetry install --no-root --sync

# If still failing, clear cache
poetry cache clear --all pypi
poetry install --no-root --sync
```

### "Frontend node_modules issues"
```bash
# From host terminal
./scripts/dc_exec frontend rm -rf node_modules
./scripts/dc_exec frontend corepack enable
./scripts/dc_exec frontend yarn install

# Or rebuild container
docker compose up --build --force-recreate frontend
```

### "Neo4j authentication failed"
Default credentials (from `docker-compose.yml`):
- **URI**: `bolt://localhost:7687`
- **Browser**: `http://localhost:7474`
- **Username**: `neo4j`
- **Password**: `bmxpassword`

If forgotten, recreate Neo4j:
```bash
docker compose down neo4j
docker volume rm bmx-bookmark-extractor_neo4j_data
docker compose up neo4j
```

### "Build context too large"
Ensure `.dockerignore` exists and contains:
```
node_modules/
.git/
.venv/
__pycache__/
*.pyc
.pytest_cache/
.svelte-kit/
dist/
build/
.DS_Store
*.log
```

### "Docker build is extremely slow"
**Windows/macOS:**
- Docker Desktop uses filesystem sharing which is slow
- Consider WSL2 native development (clone repo inside WSL)
- Reduce volume mounts in `docker-compose.yml`

**All platforms:**
```bash
# Clear build cache
docker builder prune -af

# Use BuildKit (faster)
export DOCKER_BUILDKIT=1
docker compose build
```

---

## Performance Optimization

### Docker Desktop Resources (Windows/macOS)

Recommended settings for BMX development:
- **CPUs**: 4 (adjust based on your system)
- **Memory**: 6GB minimum, 8GB recommended
- **Swap**: 2GB
- **Disk Image**: 40GB minimum

**To configure**: Docker Desktop → Settings → Resources

### WSL2 Memory Limit (Windows)

Create/edit `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

Then restart WSL:
```powershell
wsl --shutdown
```

---

## Dependency Management

### Python (Backend)
```bash
# Add package
poetry add <package>

# Add dev-only package
poetry add --group dev <package>

# Update all
poetry update

# Show outdated
poetry show --outdated
```

### JavaScript (Frontend)
```bash
# From container or via dc_exec frontend
yarn add <package>           # Runtime dependency
yarn add -D <package>        # Dev dependency
yarn upgrade                 # Update all
yarn outdated               # Show outdated
```

---

## Security Vulnerabilities (Dependabot)

### Resolved Issues
✅ **Root Next.js dependencies removed** - The legacy `package.json` and `tsconfig.json` in project root have been deleted. All Next.js-related Dependabot alerts should resolve automatically.

### Remaining Vulnerabilities

If Dependabot still shows issues:

1. **Frontend dependencies** (check `frontend/package.json`):
   ```bash
   cd frontend
   yarn audit
   yarn audit --fix          # Auto-fix if possible
   yarn upgrade <package>    # Manual upgrade
   ```

2. **Backend dependencies** (check `backend/pyproject.toml`):
   ```bash
   poetry show --outdated
   poetry update <package>
   ```

3. **Check for transitive dependencies**:
   ```bash
   # Frontend
   yarn why <vulnerable-package>
   
   # Backend
   poetry show --tree | grep <vulnerable-package>
   ```

### Security Best Practices
- Regularly run `yarn audit` and `poetry check`
- Update dependencies before major releases
- Review CVE severity (not all require immediate action)
- Test after security updates (use `./scripts-devcontainer/test`)

---

## Database Operations

### Neo4j Maintenance
```bash
# Access Neo4j Browser
# Open: http://localhost:7474
# Connect with: neo4j / bmxpassword

# Run Cypher query from terminal
docker compose exec neo4j cypher-shell -u neo4j -p bmxpassword "MATCH (n) RETURN count(n);"

# Clear all data
docker compose exec neo4j cypher-shell -u neo4j -p bmxpassword "MATCH (n) DETACH DELETE n;"

# Backup database
docker compose exec neo4j neo4j-admin database dump neo4j --to-path=/data/backups
```

### PostgreSQL (When Implemented)
```bash
# Connect via SQLTools extension (in DevContainer)
# Or via command line:
docker compose exec postgres psql -U bmx_user -d bmx_db

# Backup
docker compose exec postgres pg_dump -U bmx_user bmx_db > backup.sql

# Restore
docker compose exec -T postgres psql -U bmx_user bmx_db < backup.sql
```

---

## Testing

### Backend Tests
```bash
# From inside DevContainer
./scripts-devcontainer/test

# Or via Docker Compose
./scripts/dc_exec backend poetry run pytest

# With coverage
./scripts/dc_exec backend poetry run pytest --cov=src --cov-report=html
```

### Frontend Tests
```bash
# Unit tests
./scripts/dc_exec frontend yarn test

# E2E tests
./scripts/dc_exec frontend yarn test:e2e

# Watch mode
./scripts/dc_exec frontend yarn test:unit
```

---

## Logging and Debugging

### View Service Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f neo4j

# Last 100 lines
docker compose logs --tail=100 backend
```

### Debug Python in Container
Add to your code:
```python
import debugpy
debugpy.listen(("0.0.0.0", 5678))
debugpy.wait_for_client()  # Pause until debugger attaches
```

Then attach VS Code debugger to port 5678.

### Debug Frontend in Browser
1. Open DevTools (F12)
2. Vite provides source maps automatically
3. Set breakpoints in original TypeScript/Svelte files

---

## Clean Slate (Nuclear Option)

If everything is broken and you want to start fresh:

```bash
# Stop and remove everything
docker compose down -v
docker system prune -af
docker volume prune -af

# Remove all BMX volumes specifically
docker volume ls | grep bmx | awk '{print $2}' | xargs docker volume rm

# Clear frontend builds
rm -rf frontend/node_modules frontend/.svelte-kit frontend/dist

# Clear backend caches
rm -rf backend/.venv backend/.pytest_cache

# Clear WSL VS Code caches (from WSL/Git Bash)
rm -rf ~/.vscode-server ~/.cursor-server

# Rebuild from scratch
docker compose build --no-cache
docker compose up
```

---

## Getting Help

### Before asking for help, gather this info:

1. **System info**:
   ```bash
   docker --version
   docker compose version
   wsl --list --verbose  # Windows only
   ```

2. **Docker status**:
   ```bash
   docker ps -a
   docker compose ps
   ```

3. **Logs**:
   ```bash
   docker compose logs --tail=50 backend > backend-logs.txt
   docker compose logs --tail=50 frontend > frontend-logs.txt
   ```

4. **Environment**:
   - Operating system & version
   - VS Code version
   - Dev Containers extension version
   - Available RAM & disk space

### Resources
- **Project Documentation**: `documentation/`
- **Backend Docs**: `backend/README.md`
- **Frontend Docs**: `frontend/README.md`
- **DevContainer Docs**: `.devcontainer/README.md`
- **Docker Compose Reference**: https://docs.docker.com/compose/
- **SvelteKit Docs**: https://kit.svelte.dev/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com/

---

## Quick Reference Commands

### Essential Commands
```bash
# Start development environment
docker compose up -d

# Stop development environment
docker compose down

# Restart a service
docker compose restart backend

# Rebuild after code changes
docker compose up --build

# Access container shell
docker compose exec backend bash
docker compose exec frontend sh

# Check service health
curl http://localhost:8000/health  # Backend
curl http://localhost:3000/health  # Frontend
```

### Useful Aliases (Add to ~/.bashrc or ~/.bash_profile)
```bash
alias dcu='docker compose up -d'
alias dcd='docker compose down'
alias dcl='docker compose logs -f'
alias dcr='docker compose restart'
alias dcb='docker compose up --build'
alias dce='docker compose exec'
```

Then use:
```bash
dcu              # Start services
dcl backend      # View backend logs
dce backend bash # Access backend shell
```


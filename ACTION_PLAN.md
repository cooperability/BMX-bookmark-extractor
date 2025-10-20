# BMX Recovery & Setup Action Plan

## Executive Summary

**What Happened:**
1. ❌ Docker Desktop is not running → DevContainer can't connect
2. ❌ WSL2 VS Code server files corrupted → Node.js not found
3. ❌ Legacy Next.js dependencies → Dependabot security alerts
4. ✅ **Good news**: Your Svelte migration was CORRECT - the project is designed for SvelteKit!

**What's Fixed:**
1. ✅ Removed legacy `package.json` and `tsconfig.json` (Dependabot alerts will clear)
2. ✅ Created proper `.devcontainer/` configuration
3. ✅ Created comprehensive troubleshooting documentation
4. ✅ Updated README with clear setup instructions

**What You Need to Do:**
Follow the steps below to get your development environment working.

---

## 🚀 Immediate Action Steps (15-20 minutes)

### Step 1: Fix Docker Desktop (5 minutes)

**Option A: If Docker Desktop is Installed**
```powershell
# Open PowerShell or Git Bash and check Docker status
docker --version
docker ps
```

If either command fails with "ENOENT" or "command not found":
1. Open **Docker Desktop** from Start Menu
2. Wait for it to fully start (green whale icon in system tray)
3. Re-run `docker ps` - should show empty list or running containers

**Option B: If Docker Desktop is Not Installed**
1. Download: https://www.docker.com/products/docker-desktop
2. Run installer as Administrator
3. ✅ Check "Use WSL 2 instead of Hyper-V"
4. Complete installation and restart computer
5. Start Docker Desktop
6. Wait for "Docker Desktop is running" message

**Verify Success:**
```bash
docker ps
# Should NOT show ENOENT error
```

---

### Step 2: Clean WSL2 VS Code Server Cache (2 minutes)

The "node: not found" error is from corrupted cache. Clean it:

```bash
# From Git Bash or WSL terminal
rm -rf ~/.vscode-server
rm -rf ~/.vscode-server-insiders
rm -rf ~/.vscode-remote-containers
rm -rf ~/.cursor-server
rm -rf ~/.cursor

# Verify cleanup
ls -la ~ | grep -E 'vscode|cursor'
# Should show minimal or no results
```

---

### Step 3: Choose Your Development Workflow (1 minute)

You have two options:

#### Option A: DevContainer (Recommended - Best IDE Integration)
- ✅ IntelliSense works with all container dependencies
- ✅ Integrated terminal runs inside container
- ✅ Debugging works seamlessly
- ✅ Extensions (Python, Svelte) use container environment
- ⚠️ Requires VS Code/Cursor and Dev Containers extension

#### Option B: Docker Compose (Recommended - Simpler)
- ✅ Simpler setup, fewer moving parts
- ✅ Works with any editor
- ✅ Better for managing multiple services
- ⚠️ Need to prefix commands with `./scripts/dc_exec`

**Choose now and proceed to Step 4A or 4B.**

---

### Step 4A: Start with DevContainer (8-12 minutes)

```bash
# 1. Ensure Docker Desktop is running (green icon)
docker ps

# 2. Navigate to project
cd c:/Users/coope/Documents/GitHub/BMX-bookmark-extractor

# 3. Open in VS Code/Cursor
code .

# 4. Install Dev Containers extension (if not installed)
# Press F1 → "Extensions: Install Extensions"
# Search: "Dev Containers" by Microsoft
# Install it

# 5. Reopen in Container
# Press F1 → "Dev Containers: Reopen in Container"
# OR: Click "Reopen in Container" popup

# 6. Wait for build (5-10 minutes first time)
# Progress shown in bottom-right notification
```

**After Container Starts:**
```bash
# From integrated terminal (already inside container!)

# Verify Python environment
poetry --version

# Verify Node/Yarn environment
cd /project/frontend
yarn --version

# Start backend (terminal 1)
cd /project
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Start frontend (terminal 2)
cd /project/frontend
yarn dev
```

**Access Services:**
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Neo4j Browser: http://localhost:7474 (neo4j/bmxpassword)

---

### Step 4B: Start with Docker Compose (3-5 minutes)

```bash
# 1. Ensure Docker Desktop is running
docker ps

# 2. Navigate to project
cd c:/Users/coope/Documents/GitHub/BMX-bookmark-extractor

# 3. Start all services
./scripts/dc_up

# Wait 2-3 minutes for services to start

# 4. Start backend (new terminal)
./scripts/dc_exec backend poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# 5. Start frontend (another new terminal)
./scripts/dc_exec frontend yarn dev
```

**Access Services:**
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Neo4j Browser: http://localhost:7474 (neo4j/bmxpassword)

**View Logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

**Stop Services:**
```bash
./scripts/dc_d
# OR: docker compose down
```

---

## 🎯 Verification Steps (2 minutes)

After completing Step 4A or 4B, verify everything works:

### 1. Check Backend Health
```bash
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```

OR open in browser: http://localhost:8000/docs

### 2. Check Frontend Health
Open browser: http://localhost:3000/health

Should display health check page with backend status.

### 3. Check Neo4j
Open browser: http://localhost:7474
- Username: `neo4j`
- Password: `bmxpassword`
- Click "Connect"

Should show Neo4j Browser interface.

### 4. Run Tests
```bash
# DevContainer method (from integrated terminal)
./scripts-devcontainer/test

# Docker Compose method (from host terminal)
./scripts/dc_exec backend poetry run pytest
```

---

## ✅ Success Criteria

You're fully set up when:
- [ ] `docker ps` shows running containers (backend, frontend, neo4j)
- [ ] http://localhost:8000/docs shows FastAPI Swagger UI
- [ ] http://localhost:3000 shows SvelteKit frontend
- [ ] http://localhost:7474 shows Neo4j Browser
- [ ] Backend tests pass: `poetry run pytest`
- [ ] No Dependabot alerts in GitHub (may take 24 hours to clear)

---

## 🆘 If Something Goes Wrong

### "Container fails to build"
```bash
# Clear Docker cache
docker builder prune -af
docker system prune -af

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up
```

### "Port already in use"
```bash
# Find what's using port 8000 or 3000
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Stop BMX containers
docker compose down

# Or kill specific process (replace <PID>)
taskkill /PID <PID> /F
```

### "Cannot connect to Neo4j"
```bash
# Recreate Neo4j with fresh data
docker compose down neo4j
docker volume rm bmx-bookmark-extractor_neo4j_data
docker compose up neo4j -d

# Wait 30 seconds, then access browser
# http://localhost:7474 with neo4j/bmxpassword
```

### "Still getting errors"
See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for comprehensive solutions.

---

## 📚 What's Next: Learning Svelte

You asked if this is a good way to learn Svelte - **absolutely YES!** This project is ideal because:

### 1. Real-World Application
You're building something useful (bookmark knowledge graph) not a toy example.

### 2. Modern Stack
- **SvelteKit** - Latest version with best practices
- **TypeScript** - Type safety while learning
- **Tailwind CSS** - Modern styling
- **Vite** - Fast development experience

### 3. Progressive Complexity
**Week 1-2: Basics**
- Start with simple components: `frontend/src/routes/+page.svelte`
- Understand Svelte reactivity: `let count = 0` → auto-updates UI
- Learn component props and events

**Week 3-4: Intermediate**
- SvelteKit routing: `+page.svelte`, `+page.server.ts`, `+layout.svelte`
- Forms and data loading
- Server-side rendering (SSR) concepts

**Week 5-6: Advanced**
- Stores for state management (perfect for your WebSocket updates)
- Actions and transitions
- Integration with D3.js/Cytoscape for graph visualization

### 4. Excellent Documentation
- **Official Tutorial**: https://learn.svelte.dev/ (do this first!)
- **SvelteKit Docs**: https://kit.svelte.dev/docs
- **Already in your project**: `frontend/src/stories/` has Storybook examples

### 5. Learning Path for BMX

**Phase 1: Build Basic UI (Week 1)**
```svelte
<!-- frontend/src/routes/+page.svelte -->
<script lang="ts">
  let bookmarkUrl = '';
  
  async function processBookmark() {
    const response = await fetch('http://localhost:8000/process-bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [bookmarkUrl] })
    });
    const data = await response.json();
    console.log('Processed:', data);
  }
</script>

<div class="container">
  <h1>BMX Bookmark Processor</h1>
  <input bind:value={bookmarkUrl} placeholder="Enter URL" />
  <button on:click={processBookmark}>Process</button>
</div>
```

**Phase 2: Add Graph Visualization (Week 2-3)**
Use D3.js or Cytoscape with Svelte:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  
  let graphContainer: HTMLDivElement;
  
  onMount(async () => {
    // Fetch graph data from backend
    const response = await fetch('http://localhost:8000/graph-data');
    const graphData = await response.json();
    
    // Render with D3
    renderGraph(graphContainer, graphData);
  });
</script>

<div bind:this={graphContainer} class="graph-container"></div>
```

**Phase 3: Add Real-Time Updates (Week 4)**
WebSocket integration:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  let ws: WebSocket;
  let processingStatus = 'Idle';
  
  onMount(() => {
    ws = new WebSocket('ws://localhost:8000/processing-status');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      processingStatus = data.status;
    };
  });
  
  onDestroy(() => {
    ws?.close();
  });
</script>

<div class="status">Status: {processingStatus}</div>
```

### 6. Recommended Learning Resources

**Official Tutorial (Do This First!)**
- https://learn.svelte.dev/
- Interactive, in-browser
- Takes 2-3 hours
- Covers 90% of what you'll use

**Documentation**
- Svelte: https://svelte.dev/docs
- SvelteKit: https://kit.svelte.dev/docs

**Video Courses (Optional)**
- Svelte 5 Runes Course (YouTube, free)
- Svelte Summit talks (conference recordings)

**Practice Projects**
Your BMX project IS your practice project! 🎉

---

## 🎯 Next Development Steps

Once your environment is working, start building:

### Immediate (This Week)
1. **Create bookmark input component** (`frontend/src/lib/BookmarkInput.svelte`)
2. **Add CSV upload functionality** (drag-and-drop)
3. **Connect to backend `/process-bookmarks` endpoint**

### Short-Term (Next 2 Weeks)
1. **Implement graph visualization** with D3.js or Cytoscape
2. **Add WebSocket for real-time processing updates**
3. **Create detail panel** for clicked nodes

### Medium-Term (Next Month)
1. **Anki card import** and visualization
2. **Search functionality** across knowledge graph
3. **Export features** (PNG, SVG, JSON)

See [documentation/mvp-plan.md](documentation/mvp-plan.md) for complete roadmap.

---

## 📞 Summary

**You're in great shape!** Your architectural decisions are solid:
- ✅ Svelte is perfect for this project
- ✅ Frontend migration is complete and correct
- ✅ Backend architecture is well-designed
- ✅ Documentation is comprehensive

**What broke:**
- ❌ Docker not running (easy fix: start Docker Desktop)
- ❌ WSL2 cache corrupted (easy fix: delete cache folders)
- ❌ Legacy Next.js files (fixed: deleted)

**What you need to do:**
1. Start Docker Desktop
2. Clean WSL2 cache
3. Choose DevContainer OR Docker Compose workflow
4. Follow Step 4A or 4B above
5. Start building your MVP!

**Learning Svelte:**
- ✅ This project is an EXCELLENT way to learn
- ✅ Do the official tutorial first (2-3 hours)
- ✅ Then start building bookmark input component
- ✅ Progress incrementally from simple to complex

You've got this! 🚀

---

## 🔗 Quick Links

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Comprehensive troubleshooting guide
- [README.md](README.md) - Project overview and quick start
- [.devcontainer/README.md](.devcontainer/README.md) - DevContainer setup details
- [documentation/mvp-plan.md](documentation/mvp-plan.md) - MVP implementation plan
- [frontend/README.md](frontend/README.md) - Frontend-specific documentation

**Bookmark These:**
- Backend API Docs: http://localhost:8000/docs
- Svelte Tutorial: https://learn.svelte.dev/
- SvelteKit Docs: https://kit.svelte.dev/docs
- Neo4j Browser: http://localhost:7474


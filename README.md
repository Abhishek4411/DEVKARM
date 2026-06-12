# DEVKARM — Divine Engineering Visual Karma

> **Code is Karma. Build is Dharma.**

A browser-based visual IDE where code and canvas stay synchronized in real time.  
Write code and watch nodes appear. Move nodes and watch the code update. Both directions. Always.

---

## What is DEVKARM?

DEVKARM is an enterprise-grade visual programming environment built around **Trinity Sync** — a bidirectional bridge between a Monaco code editor and a React Flow canvas. Every function, variable, loop, try/catch, and API call you write becomes a draggable node. Every node you edit, delete, or connect writes back to the code. The two views are always in sync.

---

## Getting Started

### Prerequisites

Install these before running DEVKARM:

| Tool | Purpose | Install |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | PostgreSQL, Redis, Keycloak, MeiliSearch | Must be **running** before you start |
| [Bun](https://bun.sh) v1.0+ | Frontend dev server + JS dependencies | `curl -fsSL https://bun.sh/install \| bash` |
| [Node.js](https://nodejs.org/) v18+ | Sync + Sandbox services | Included with most setups |
| [Rust](https://rustup.rs) (optional) | Rust API for project save/load | Only needed for full backend persistence |

---

### Option A — One-command startup (Windows, recommended)

From the **project root** in PowerShell:

```powershell
.\scripts\dev-start.ps1
```

This script will:

1. Start Docker services (`postgres`, `redis`, `keycloak`, `meilisearch`)
2. Run database migrations
3. Provision the Keycloak realm and test user
4. Install JS dependencies (if needed)
5. Start the Rust API, Sync server, Sandbox, and Web frontend
6. Print the URLs and ports to open

If a port is already in use, the script automatically picks the next free port:

| Service | Default port | Fallback range |
|---------|-------------|----------------|
| Web (Vite) | 5173 | 5173–5199 |
| Rust API | 3000 | 3000–3010 |
| Sandbox | 4000 | 4000–4010 |
| Sync (WebSocket) | 1234 | 1234–1244 |

**Stop everything:**

```powershell
.\scripts\dev-stop.ps1
```

Logs are written to `.dev-logs/` in the project root.

---

### Option B — Manual startup (all platforms)

#### Step 1 — Start Docker infrastructure

Make sure Docker Desktop is running, then from the project root:

```bash
docker compose up -d
```

Wait until all containers are healthy (~30–60 seconds on first run).

#### Step 2 — Provision Keycloak (first time only)

**Windows (PowerShell):**

```powershell
.\scripts\setup-keycloak.ps1
```

**macOS / Linux / Git Bash:**

```bash
bash scripts/setup-keycloak.sh
```

> On Windows Git Bash, run with: `MSYS_NO_PATHCONV=1 bash scripts/setup-keycloak.sh`

#### Step 3 — Create the API environment file (first time only)

Create `apps/api/.env`:

```
DATABASE_URL=postgres://devkarm:devkarm_dev_password@localhost:5433/devkarm
```

#### Step 4 — Install dependencies

```bash
cd apps/web && bun install && cd ../..
cd services/sync && bun install && cd ../..
cd services/sandbox && bun install && cd ../..
```

#### Step 5 — Start each service (separate terminals)

**Terminal 1 — Rust API:**

```bash
cd apps/api
cargo run
```

**Terminal 2 — Sync server:**

```bash
cd services/sync
node server.js
```

**Terminal 3 — Sandbox:**

```bash
cd services/sandbox
node server.js
```

**Terminal 4 — Web frontend:**

```bash
cd apps/web
bun run dev
```

---

### Login credentials

When you open the app in your browser, you will be redirected to the Keycloak login page automatically.

#### App login (use this to sign in to DEVKARM)

| Field | Value |
|-------|-------|
| **Username** | `testuser` |
| **Password** | `test123` |

After signing in, you are redirected back to the DEVKARM IDE.

#### Keycloak admin console (optional — for managing users/realm)

| Field | Value |
|-------|-------|
| **URL** | [http://localhost:8080](http://localhost:8080) |
| **Username** | `admin` |
| **Password** | `admin` |
| **Realm** | `devkarm` (select from the top-left dropdown after logging in) |

> The admin account manages Keycloak itself. Use `testuser` / `test123` to use the IDE.

---

### Service URLs (default ports)

After startup, open these in your browser:

| Service | URL |
|---------|-----|
| **DEVKARM app** | [http://localhost:5173](http://localhost:5173) |
| **Keycloak admin** | [http://localhost:8080](http://localhost:8080) |
| **Rust API health check** | [http://localhost:3000/api/health](http://localhost:3000/api/health) |
| **Sandbox** | [http://localhost:4000](http://localhost:4000) |
| **MeiliSearch** | [http://localhost:7700](http://localhost:7700) |

If the startup script picked a different port (because the default was busy), check the terminal output or `.dev-logs/pids.json` for the actual ports.

---

### Troubleshooting

| Problem | Fix |
|---------|-----|
| **"Authentication failed. Ensure Keycloak is running at localhost:8080"** | Start Docker Desktop, then run `docker compose up -d` and wait ~60 s for Keycloak to boot |
| **Port already in use** | Run `.\scripts\dev-start.ps1` (Windows) — it picks the next free port automatically |
| **Blank page / connection refused** | Check `.dev-logs/web.log` for the actual Vite port (may be 5174, 5175, etc.) |
| **Sandbox unreachable** | Ensure Docker is running and `node server.js` is active in `services/sandbox` |
| **Project save/load fails** | The Rust API must be running — run `cd apps/api && cargo run` |
| **Rust build errors** | Reinstall the toolchain: visit [rustup.rs](https://rustup.rs), then `rustup default stable` |

---

## Features

### Trinity Sync
Real-time bidirectional sync between the Monaco editor and the React Flow canvas (via Web-Tree-Sitter). Type code → nodes appear. Edit a node → code updates!

### Advanced Node Types
| Node | Theme | Represents |
|---|---|---|
| Function | Blue | `function` declarations |
| Variable | Green | `const` / `let` / `var` declarations |
| API | Orange | `fetch()` calls |
| Loop | Purple | `for` / `while` / `forEach` statements |
| Condition | Amber | `if/else` statements |
| Try/Catch | Red | `try / catch` blocks |
| Database Table | Cyan | Visual SQL Schema Builder |
| Secret Vault | Cyber | Environment Variable injection |
| Bug Tracker | Crimson | Embedded Kanban QA issues |

### Live Preview Sandbox (Web View)
Execute your canvas logic securely in ephemeral Docker containers (`node:22-alpine`) isolated from your host system. Spin up embedded Web Servers (`Bun.serve()`) and stream their interfaces dynamically right into the DEVKARM GUI.

### Replay Debugger
Travel back in time. Explore timeline scrubbing of execution events, visually mapping exactly what each node processed, the data passed, and execution durations.

### Multiplayer Collaboration
Enabled through **HocusPocus** and **Y.js**. See cursors, active file indicators, and live multi-user editing with seamless Presence tracking. Follow along with your teammates dynamically!

### Right-Click Context Menu & Palettes
- Command Palette (`Ctrl+K`): Instantly access Layout Auto-Alignment, Schema Generation, and Canvas shortcuts.
- Asset Palettes: Drag N' Drop ready-made structures or NPM packages via integrated MeiliSearch packaging.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript |
| Canvas Engine | React Flow 12 |
| Code Editor | Monaco Editor |
| AST Parser | web-tree-sitter 0.26 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 |
| Collaboration | Y.js + HocusPocus |
| Sandbox Execution | Dockerode + Node.js (Alpine) |
| Core API Backend | Rust + Axum 0.8 |
| Database | PostgreSQL (SQLx) |

---

## How Trinity Sync Works

```
User types in Monaco
  └─▶ setCode (debounced 500ms)
        └─▶ runSync → tree-sitter parse → codeToGraph
              └─▶ syncFromCode → React Flow canvas updates

User edits a node / connects edges / deletes
  └─▶ triggerGraphToCode → graphToCode
        └─▶ setCodeSilent → Monaco editor updates (via imperative editor.setValue)
```

## License

MIT

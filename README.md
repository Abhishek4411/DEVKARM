# DEVKARM — Divine Engineering Visual Karma

> **Code is Karma. Build is Dharma.**

A browser-based visual IDE where code and canvas stay synchronized in real time.  
Write code and watch nodes appear. Move nodes and watch the code update. Both directions. Always.

---

## What is DEVKARM?

DEVKARM is an enterprise-grade visual programming environment built around **Trinity Sync** — a bidirectional bridge between a Monaco code editor and a React Flow canvas. Every function, variable, loop, try/catch, and API call you write becomes a draggable node. Every node you edit, delete, or connect writes back to the code. The two views are always in sync.

---

## Quick Start (Frontend Only)

```bash
cd apps/web
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

> **Requirements:** [Bun](https://bun.sh) v1.0+.

## Starting Backend Ecosystem
DEVKARM now includes a powerful Rust API, real-time collaboration Sync server, Sandbox execution environment, and Keycloak Auth. Run them via:
```bash
docker-compose up -d
cd apps/api && cargo run
cd services/sync && bun run server.js
cd services/sandbox && node server.js
```

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

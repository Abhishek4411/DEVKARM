# DEVKARM — Divine Engineering Visual Karma

> **Code is Karma. Build is Dharma.**

A browser-based visual IDE where code and canvas stay synchronized in real time.  
Write code and watch nodes appear. Move nodes and watch the code update. Both directions. Always.

---

<!-- Screenshot placeholder — replace with actual screenshot -->
<!--
![DEVKARM Screenshot](docs/screenshot.png)
-->

---

## What is DEVKARM?

DEVKARM is a visual programming environment built around **Trinity Sync** — a bidirectional bridge between a Monaco code editor and a React Flow canvas. Every function, variable, and API call you write becomes a draggable node. Every node you edit, delete, or connect writes back to the code. The two views are always in sync.

---

## Quick Start

```bash
cd apps/web
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

> **Requirements:** [Bun](https://bun.sh) v1.0+. If you don't have Bun, install it first:
> ```bash
> npm install -g bun
> ```

---

## Features

### Trinity Sync
Real-time bidirectional sync between the Monaco editor and the React Flow canvas.  
Type code → nodes appear. Edit a node → code updates. No manual refresh needed.

### Node Types
| Node | Color | Represents |
|---|---|---|
| Function | Blue | `function` declarations |
| Variable | Green | `const` / `let` / `var` declarations |
| API | Orange | `fetch()` / `axios` calls |

### Animated Edges
SVG SMIL `<animateMotion>` dots travel along bezier edges to visualize data flow direction. Zero JavaScript, zero layout dependency.

### Inline Node Editing
Double-click any node to edit its properties directly on the canvas. Changes sync to code immediately.

### Right-Click Context Menu
Right-click any node for: Edit, Duplicate, Delete, View Code (jumps Monaco to the relevant line), Add Test (coming soon).

### Command Palette
Press **Ctrl+K** to open the command palette. Add nodes, clear the canvas, zoom to fit, toggle the editor, reset code — all from the keyboard.

### Draggable Component Palette
Expand the left sidebar and drag Function / Variable / API nodes directly onto the canvas. Drops at the exact cursor position in flow coordinates.

### AI-Powered Generation (Describe to Build)
Type a plain-English description at the bottom of the canvas and generate nodes using Claude Haiku. Requires `VITE_ANTHROPIC_API_KEY` in `apps/web/.env`.

```env
VITE_ANTHROPIC_API_KEY=your-key-here
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Canvas Engine | React Flow 12 (`@xyflow/react`) |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| AST Parser | web-tree-sitter 0.26 + tree-sitter-javascript grammar |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| Build | Vite 8 |
| Package Manager | Bun |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5`) |

---

## Project Structure

```
DEVKARM/
└── apps/
    └── web/
        └── src/
            ├── canvas/
            │   ├── edges/        AnimatedEdge (SMIL dot animation)
            │   ├── nodes/        FunctionNode, VariableNode, ApiNode
            │   ├── sync/         code-to-graph.ts, graph-to-code.ts
            │   └── ui/           CommandPalette, ComponentPalette, DescribeBar, NodeContextMenu
            ├── lib/
            │   ├── ai.ts         Anthropic API client
            │   └── parser.ts     web-tree-sitter singleton
            └── stores/
                ├── canvas-store.ts
                ├── editor-store.ts
                ├── sync-store.ts   sync-lock flags (prevents feedback loops)
                └── ui-store.ts
```

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

Two boolean flags (`isSyncingFromCode`, `isSyncingFromGraph`) in `sync-store` prevent the two pipelines from triggering each other.

---

## License

MIT

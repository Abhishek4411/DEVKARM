import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { animate } from 'framer-motion'
import MonacoEditor, { type OnMount, useMonaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, type Edge, type Connection } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import AnimatedEdge from './canvas/edges/AnimatedEdge'
import '@xyflow/react/dist/style.css'
import FunctionNode from './canvas/nodes/FunctionNode'
import VariableNode from './canvas/nodes/VariableNode'
import ApiNode from './canvas/nodes/ApiNode'
import ConditionNode from './canvas/nodes/ConditionNode'
import LoopNode from './canvas/nodes/LoopNode'
import TryCatchNode from './canvas/nodes/TryCatchNode'
import CommentNode from './canvas/nodes/CommentNode'
import PackageNode from './canvas/nodes/PackageNode'
import DatabaseTableNode from './canvas/nodes/DatabaseTableNode'
import BugNodeComponent from './canvas/nodes/BugNode'
import MigrationModal from './canvas/ui/MigrationModal'
import KanbanOverlay from './canvas/ui/KanbanOverlay'
import Timeline from './debugger/Timeline'
import IssuesTab from './navigator/IssuesTab'
import { Settings, ChevronLeft, RefreshCw, Trash2, LogOut, Bug, Kanban } from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import { useEditorStore, runSync } from './stores/editor-store'
import { useCanvasStore, type AppNode } from './stores/canvas-store'
import { useSyncStore } from './stores/sync-store'
import { useUiStore } from './stores/ui-store'
import DescribeBar from './canvas/ui/DescribeBar'
import CommandPalette from './canvas/ui/CommandPalette'
import ComponentPalette, { type PaletteNodeType } from './canvas/ui/ComponentPalette'
import PackageSearch from './navigator/PackageSearch'
import NodeContextMenu from './canvas/ui/NodeContextMenu'
import FileTabs from './components/FileTabs'
import ProjectSelector from './components/ProjectSelector'
import Cursors from './collaboration/Cursors'
import PresenceBar from './collaboration/PresenceBar'
import { attachCollabBridge, detachCollabBridge } from './collaboration/collab-bridge'
import { fetchNodes, fetchEdges, type Project, type IGCNode, type ApiEdge } from './lib/api'
import { initCollab, destroyCollab, startTokenRefresh } from './lib/collab'
import keycloak from './auth/keycloak'
import { initAwareness, updateCursor, updateViewport, updateActiveFile, onAwarenessChange, destroyAwareness } from './lib/awareness'
import { useFileStore } from './stores/file-store'
import { checkConnection } from './canvas/sync/semantic-snap'
import { computeAutoLayout } from './canvas/sync/auto-layout'
import { schemaToSql } from './canvas/sync/schema-to-sql'
import './App.css'

// ── IGC → AppNode conversion ─────────────────────────────────────────────────
function igcToAppNode(n: IGCNode): AppNode {
  const position = {
    x: typeof n.graph.x === 'number' ? n.graph.x : 120,
    y: typeof n.graph.y === 'number' ? n.graph.y : 120,
  }
  if (n.node_type === 'variable') {
    return {
      id: n.id, type: 'variableNode', position,
      data: {
        name:    (n.code.name    as string)  ?? 'variable',
        varType: (n.code.varType as 'const' | 'let' | 'var') ?? 'const',
        value:   (n.code.value   as string)  ?? '',
      },
    }
  }
  if (n.node_type === 'api') {
    return {
      id: n.id, type: 'apiNode', position,
      data: {
        method: (n.code.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') ?? 'GET',
        path:   (n.code.path   as string) ?? '/api/endpoint',
        status: 'idle' as const,
      },
    }
  }
  if (n.node_type === 'condition') {
    return {
      id: n.id, type: 'conditionNode', position,
      data: { condition: (n.code.condition as string) ?? '' },
    }
  }
  if (n.node_type === 'loop') {
    return {
      id: n.id, type: 'loopNode', position,
      data: {
        loopKind:   (n.code.loopKind   as 'for' | 'while' | 'forEach') ?? 'for',
        expression: (n.code.expression as string) ?? '',
      },
    }
  }
  if (n.node_type === 'tryCatch') {
    return {
      id: n.id, type: 'tryCatchNode', position,
      data: { errorVar: (n.code.errorVar as string) ?? 'error' },
    }
  }
  if (n.node_type === 'comment') {
    return {
      id: n.id, type: 'commentNode', position,
      data: {
        text:  (n.code.text  as string) ?? '',
        width: (n.code.width as number) ?? 200,
      },
    }
  }
  // default → function
  return {
    id: n.id, type: 'functionNode', position,
    data: {
      name:       (n.code.name       as string)   ?? 'myFunction',
      params:     (n.code.params     as string[]) ?? [],
      returnType: (n.code.returnType as string)   ?? '',
      code:       (n.code.body       as string)   ?? '',
    },
  }
}

function apiEdgeToFlowEdge(e: ApiEdge): Edge {
  return {
    id:     e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    style:  { stroke: e.edge_type === 'api' ? '#F97316' : '#3B82F6' },
  }
}

// ── Monaco language from filename extension ───────────────────────────────────
function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs') return 'javascript'
  if (ext === 'py') return 'python'
  if (ext === 'css') return 'css'
  if (ext === 'html') return 'html'
  if (ext === 'json') return 'json'
  if (ext === 'md') return 'markdown'
  return 'javascript'
}

type Mode = 'flow' | 'blocks' | 'code' | 'design' | 'ai'

const MODES: { id: Mode; label: string }[] = [
  { id: 'flow',   label: 'Flow'   },
  { id: 'blocks', label: 'Blocks' },
  { id: 'code',   label: 'Code'   },
  { id: 'design', label: 'Design' },
  { id: 'ai',     label: 'AI'     },
]

// Default data per node type when dropped from palette
function makeNode(type: PaletteNodeType, position: { x: number; y: number }): AppNode {
  const id = `${type.replace('Node', '')}-${Date.now()}`
  if (type === 'functionNode') {
    return { id, type, position, data: { name: 'newFunction', params: [], returnType: 'void', code: '// body' } }
  }
  if (type === 'variableNode') {
    return { id, type, position, data: { name: 'newVar', varType: 'const', value: '""' } }
  }
  if (type === 'conditionNode') {
    return { id, type, position, data: { condition: 'x > 0' } }
  }
  if (type === 'loopNode') {
    return { id, type, position, data: { loopKind: 'for' as const, expression: 'let i = 0; i < 10; i++' } }
  }
  if (type === 'tryCatchNode') {
    return { id, type, position, data: { errorVar: 'error' } }
  }
  if (type === 'commentNode') {
    return { id, type, position, data: { text: '', width: 200 } }
  }
  if (type === 'packageNode') {
    return { id, type, position, data: { name: 'package', version: '1.0.0', description: '' } }
  }
  if (type === 'databaseTableNode') {
    return { id, type, position, data: { tableName: 'new_table', columns: [] } }
  }
  if (type === 'bugNode') {
    const bugId = `BUG-${Date.now() % 10000}`
    return { id, type, position, data: { bugId, title: 'New bug', priority: 'medium' as const, assignee: '', status: 'open' as const, description: '' } }
  }
  // apiNode
  return { id, type: 'apiNode' as const, position, data: { method: 'GET' as const, path: '/api/endpoint', status: 'idle' as const } }
}

export default function App() {
  const { userId: authUserId, name: authName, email: authEmail, logout } = useAuth()
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [mode, setMode] = useState<Mode>('flow')
  const [editorVisible, setEditorVisible] = useState(true)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'components' | 'packages' | 'issues'>('components')
  const [isDragOver, setIsDragOver] = useState(false)
  const [kanbanOpen, setKanbanOpen] = useState(false)
  const [followingUserId, setFollowingUserId] = useState<string | null>(null)
  const [migrationSql, setMigrationSql] = useState<string | null>(null)
  const [debuggerOpen, setDebuggerOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfInstance = useRef<ReactFlowInstance<any, any> | null>(null)

  const { code: storeCode, setCode } = useEditorStore()
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, deleteNode, loadCanvas, setCurrentProject: storeSetProjectId, saveToBackend, dirty } = useCanvasStore()
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)

  // ── File tabs ────────────────────────────────────────────────────────────
  const activeFileName = useFileStore((s) => s.files.find((f) => f.id === s.activeFileId)?.name ?? 'main.js')
  const monaco = useMonaco()
  const monacoRef = useRef<typeof monaco>(null)
  useEffect(() => { if (monaco) monacoRef.current = monaco }, [monaco])

  /** Snapshot the live canvas+editor state back into the file-store for the given file id. */
  function saveFileState(id: string) {
    useFileStore.getState().updateFile(id, {
      code: useEditorStore.getState().code,
      nodes: useCanvasStore.getState().nodes,
      edges: useCanvasStore.getState().edges,
    })
  }

  /** Load a file's stored state into canvas-store and editor-store. */
  function loadFileState(id: string) {
    const file = useFileStore.getState().getFile(id)
    if (!file) return
    useCanvasStore.getState().loadCanvas(file.nodes, file.edges)
    useEditorStore.getState().setCodeSilent(file.code)
    // Update Monaco language
    const m = monacoRef.current
    const ed = editorRef.current
    if (m && ed) {
      const model = ed.getModel()
      if (model) m.editor.setModelLanguage(model, getLang(file.name))
    }
  }

  function handleFileSwitch(newId: string) {
    const currentId = useFileStore.getState().activeFileId
    if (newId === currentId) return
    saveFileState(currentId)
    useFileStore.getState().switchFile(newId)
    loadFileState(newId)
    // Rebind Y.js bridge and awareness to the new file
    useCanvasStore.getState().setCurrentFile(newId)
    attachCollabBridge(newId)
    updateActiveFile(newId)
  }

  function handleFileCreate() {
    const id = `file-${Date.now()}`
    const count = useFileStore.getState().files.length
    const name = `untitled-${count + 1}.js`
    saveFileState(useFileStore.getState().activeFileId)
    useFileStore.getState().createFile(id, name)
    useFileStore.getState().switchFile(id)
    useCanvasStore.getState().loadCanvas([], [])
    useEditorStore.getState().setCodeSilent('')
  }

  function handleFileClose(id: string) {
    const { activeFileId: currentId } = useFileStore.getState()
    if (id === currentId) saveFileState(currentId)
    const nextId = useFileStore.getState().deleteFile(id)
    if (nextId !== currentId) loadFileState(nextId)
  }

  function handleFileRename(id: string, name: string) {
    useFileStore.getState().renameFile(id, name)
    // If this is the active file, update Monaco language for new extension
    if (id === useFileStore.getState().activeFileId) {
      const m = monacoRef.current
      const ed = editorRef.current
      if (m && ed) {
        const model = ed.getModel()
        if (model) m.editor.setModelLanguage(model, getLang(name))
      }
    }
  }

  // ── Auto-layout (animated) ───────────────────────────────────────────────
  const layoutAnimRef = useRef<{ stop: () => void } | null>(null)

  const runAnimatedLayout = useCallback(() => {
    const state = useCanvasStore.getState()
    if (state.nodes.length === 0) return

    // Stop any in-flight animation
    layoutAnimRef.current?.stop()

    const { positions: targetPositions } = computeAutoLayout(state.nodes, state.edges)

    // Snapshot start positions
    const startPositions = new Map(state.nodes.map((n) => [n.id, { ...n.position }]))

    // Use framer-motion's imperative `animate` to drive a spring from 0→1
    const ctrl = animate(0, 1, {
      type: 'spring',
      stiffness: 260,
      damping: 28,
      mass: 0.8,
      onUpdate(progress) {
        const interpolated = new Map<string, { x: number; y: number }>()
        for (const [id, target] of targetPositions) {
          const start = startPositions.get(id) ?? target
          interpolated.set(id, {
            x: start.x + (target.x - start.x) * progress,
            y: start.y + (target.y - start.y) * progress,
          })
        }
        useCanvasStore.getState().applyLayout(interpolated)
      },
      onComplete() {
        // Snap to exact final positions and fit view
        useCanvasStore.getState().applyLayout(targetPositions)
        rfInstance.current?.fitView({ duration: 300 })
      },
    })
    layoutAnimRef.current = ctrl
  }, [])

  // ── Semantic connection validation ──────────────────────────────────────
  /** Tooltip shown near cursor when hovering an invalid target during drag. */
  const [connTooltip, setConnTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  /** Source info captured when a connection drag starts. */
  const connectingFrom = useRef<{ nodeId: string; handleId: string | null; nodeType: string | undefined } | null>(null)

  const isValidConnectionCallback = useCallback((conn: Edge | Connection): boolean => {
    const nodes = useCanvasStore.getState().nodes
    const src = nodes.find((n) => n.id === conn.source)
    const tgt = nodes.find((n) => n.id === conn.target)
    const sourceHandle = conn.sourceHandle ?? null
    const targetHandle = conn.targetHandle ?? null
    return checkConnection(src?.type, tgt?.type, conn.source, conn.target, sourceHandle, targetHandle).valid
  }, [])

  function handleConnectStart(_: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null }) {
    if (!params.nodeId) return
    const nodes = useCanvasStore.getState().nodes
    const node = nodes.find((n) => n.id === params.nodeId)
    connectingFrom.current = { nodeId: params.nodeId, handleId: params.handleId, nodeType: node?.type }
  }

  function handleConnectEnd() {
    connectingFrom.current = null
    setConnTooltip(null)
  }

  /** During a connection drag, detect if cursor is over a handle and show/update tooltip.
   *  Also broadcasts the current canvas cursor position to all collaborators. */
  function handleCanvasMouseMove(e: React.MouseEvent) {
    // Broadcast cursor position to collaborators (convert screen → flow coords)
    if (rfInstance.current) {
      const flowPos = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      updateCursor(flowPos)
    }

    if (!connectingFrom.current) return

    // Find the topmost element under cursor — React Flow puts data attributes on handles
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const handleEl = el?.closest('[data-nodeid]') as HTMLElement | null

    if (!handleEl) { setConnTooltip(null); return }

    const targetNodeId = handleEl.getAttribute('data-nodeid') ?? ''
    const targetHandleId = handleEl.getAttribute('data-handleid')
    if (!targetNodeId || targetNodeId === connectingFrom.current.nodeId) { setConnTooltip(null); return }

    const nodes = useCanvasStore.getState().nodes
    const targetNode = nodes.find((n) => n.id === targetNodeId)
    const result = checkConnection(
      connectingFrom.current.nodeType,
      targetNode?.type,
      connectingFrom.current.nodeId,
      targetNodeId,
      connectingFrom.current.handleId,
      targetHandleId,
    )

    if (!result.valid && result.reason) {
      setConnTooltip({ x: e.clientX + 14, y: e.clientY - 8, text: result.reason })
    } else {
      setConnTooltip(null)
    }
  }

  function handleCanvasMouseLeave() {
    updateCursor(null)
  }

  function handleCanvasClick() {
    // Any intentional canvas interaction stops follow mode
    if (followingUserId) setFollowingUserId(null)
  }

  function handleGenerateMigration() {
    const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState()
    const sql = schemaToSql(currentNodes, currentEdges)
    setMigrationSql(sql)
  }

  /** Pan canvas to the node with the given id. */
  function handlePanToNode(nodeId: string) {
    if (!rfInstance.current) return
    const targetNode = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
    if (!targetNode) return
    rfInstance.current.setCenter(
      targetNode.position.x + 80,
      targetNode.position.y + 60,
      { duration: 500, zoom: 1.2 },
    )
  }

  function handleFileCloseOthers(keepId: string) {
    const { activeFileId: currentId } = useFileStore.getState()
    saveFileState(currentId)
    useFileStore.getState().closeOthers(keepId)
    if (keepId !== currentId) loadFileState(keepId)
  }

  // ── Save status ──────────────────────────────────────────────────────────
  type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // ── Context menu state ───────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Follow mode: mirror another user's viewport ─────────────────────────
  useEffect(() => {
    if (!followingUserId) return
    const unsub = onAwarenessChange((users) => {
      const target = users.find((u) => u.userId === followingUserId)
      if (target?.viewport && rfInstance.current) {
        rfInstance.current.setViewport(target.viewport, { duration: 200 })
      }
    })
    return unsub
  }, [followingUserId])

  // ESC stops follow mode
  useEffect(() => {
    if (!followingUserId) return
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setFollowingUserId(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [followingUserId])

  // ── Ctrl+B → Kanban overlay ──────────────────────────────────────────────
  useEffect(() => {
    function onKanbanKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setKanbanOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKanbanKey)
    return () => window.removeEventListener('keydown', onKanbanKey)
  }, [])

  // ── Debounced auto-save (3s after last change) ───────────────────────────
  useEffect(() => {
    if (!dirty || !currentProject) return
    setSaveStatus('unsaved')
    const timer = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await saveToBackend()
        setSaveStatus('saved')
        // Fade "Saved ✓" after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [dirty, nodes, edges]) // eslint-disable-line react-hooks/exhaustive-deps

  // Imperative Monaco editor ref — needed to push graph→code updates into Monaco
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  // Tracks the last value we set programmatically; value comparison is immune to
  // async Monaco onChange timing (no boolean flag that can be reset too early).
  const lastProgrammaticValue = useRef<string | null>(null)

  // Whenever the store's code changes (e.g. from graph→code), push it into Monaco
  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    if (ed.getValue() === storeCode) return
    lastProgrammaticValue.current = storeCode
    ed.setValue(storeCode)
  }, [storeCode])

  const handleEditorMount: OnMount = (ed) => { editorRef.current = ed }

  // ── Context menu actions ─────────────────────────────────────────────────
  function closeContextMenu() { setContextMenu(null) }

  function ctxEdit() {
    if (!contextMenu) return
    setEditingNodeId(contextMenu.nodeId)
    setContextMenu(null)
  }

  function ctxDuplicate() {
    if (!contextMenu) return
    const node = useCanvasStore.getState().nodes.find((n) => n.id === contextMenu.nodeId)
    if (!node) return
    const newId = `${node.type?.replace('Node', '') ?? 'node'}-${Date.now()}`
    addNode({ ...node, id: newId, position: { x: node.position.x + 50, y: node.position.y + 50 } } as AppNode)
    setContextMenu(null)
  }

  function ctxDelete() {
    if (!contextMenu) return
    deleteNode(contextMenu.nodeId)
    setContextMenu(null)
  }

  function ctxAddTest() {
    setToast('Coming soon')
    setContextMenu(null)
  }

  function ctxViewCode() {
    if (!contextMenu) return
    const node = useCanvasStore.getState().nodes.find((n) => n.id === contextMenu.nodeId)
    if (!node || !editorRef.current) return

    // Build a search term from the node's primary identifier
    let searchTerm = ''
    if (node.type === 'functionNode') {
      const d = node.data as { name: string }
      searchTerm = `function ${d.name}`
    } else if (node.type === 'variableNode') {
      const d = node.data as { varType: string; name: string }
      searchTerm = `${d.varType} ${d.name}`
    } else if (node.type === 'apiNode') {
      const d = node.data as { path: string }
      searchTerm = d.path
    }

    const lines = storeCode.split('\n')
    const lineIndex = lines.findIndex((l) => l.includes(searchTerm))
    if (lineIndex !== -1) {
      const lineNum = lineIndex + 1
      editorRef.current.revealLineInCenter(lineNum)
      editorRef.current.setSelection({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: lines[lineIndex].length + 1,
      })
      // Make sure editor pane is visible
      setEditorVisible(true)
    }
    setContextMenu(null)
  }

  const nodeTypes = useMemo(() => ({
    functionNode: FunctionNode,
    variableNode: VariableNode,
    apiNode: ApiNode,
    conditionNode: ConditionNode,
    loopNode: LoopNode,
    tryCatchNode: TryCatchNode,
    commentNode: CommentNode,
    packageNode: PackageNode,
    databaseTableNode: DatabaseTableNode,
    bugNode: BugNodeComponent,
  }), [])

  const edgeTypes = useMemo(() => ({ default: AnimatedEdge }), [])

  // Load project data from API, then run Trinity Sync to populate the editor
  const handleSelectProject = useCallback(async (project: Project) => {
    storeSetProjectId(project.id)   // register in canvas-store for saveToBackend
    setSaveStatus('idle')
    setCurrentProject(project)

    // ── Initialize real-time collaboration ──────────────────────────────────
    const activeFileId = useFileStore.getState().activeFileId
    useCanvasStore.getState().setCurrentFile(activeFileId)
    try {
      // Pass current Keycloak JWT so the server can authenticate the WebSocket
      const { provider } = initCollab(project.id, keycloak.token ?? undefined)
      initAwareness(provider, authUserId, authName)
      attachCollabBridge(activeFileId)
      updateActiveFile(activeFileId)
      // Silently refresh the token every 4 min so reconnects use a valid token
      startTokenRefresh(async () => {
        await keycloak.updateToken(60)
        return keycloak.token ?? ''
      })
    } catch (err) {
      console.warn('[collab] Failed to initialize collaboration:', err)
    }

    try {
      const [apiNodes, apiEdges] = await Promise.all([
        fetchNodes(project.id),
        fetchEdges(project.id),
      ])
      if (apiNodes.length > 0) {
        const flowNodes = apiNodes.map(igcToAppNode)
        const flowEdges = apiEdges.map(apiEdgeToFlowEdge)
        loadCanvas(flowNodes, flowEdges)
        // Generate code from the loaded graph instead of re-parsing stale editor code
        const { graphToCode } = await import('./canvas/sync/graph-to-code')
        const { useEditorStore: eds } = await import('./stores/editor-store')
        eds.getState().setCodeSilent(graphToCode(flowNodes, flowEdges))
      } else {
        // Empty project — start from default code
        runSync(storeCode)
      }
    } catch {
      // API unreachable — fall back to default in-memory state
      runSync(storeCode)
    }
  }, [loadCanvas, storeCode, authUserId, authName])

  // On first mount (no project), load the active file's canvas state then sync
  useEffect(() => {
    if (!currentProject) {
      const activeFile = useFileStore.getState().getActiveFile()
      if (activeFile) {
        useCanvasStore.getState().loadCanvas(activeFile.nodes, activeFile.edges)
        useEditorStore.getState().setCodeSilent(activeFile.code)
      }
      runSync(useEditorStore.getState().code)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCodeChange(value: string | undefined) {
    const v = value ?? ''
    // If this onChange fired because of our programmatic ed.setValue(), swallow it.
    // Value comparison is reliable whether Monaco fires sync or async.
    if (v === lastProgrammaticValue.current) {
      lastProgrammaticValue.current = null // consume — next user keystroke passes through
      return
    }
    setCode(v)
  }

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  function onDragLeave() { setIsDragOver(false) }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)

    const nodeType = e.dataTransfer.getData('application/devkarm-node-type') as PaletteNodeType
    if (!nodeType || !rfInstance.current) return

    // Convert screen coords → flow coords
    const position = rfInstance.current.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })

    if (nodeType === 'packageNode') {
      const raw = e.dataTransfer.getData('application/devkarm-package')
      if (!raw) return
      try {
        const pkg = JSON.parse(raw) as { name: string; version: string; description: string }
        addNode({
          id: `package-${Date.now()}`,
          type: 'packageNode',
          position,
          data: { name: pkg.name, version: pkg.version, description: pkg.description },
        })
      } catch { /* invalid JSON */ }
      return
    }

    addNode(makeNode(nodeType, position))
  }

  // ── Project selector screen ──────────────────────────────────────────────
  if (!currentProject) {
    return <ProjectSelector onSelect={handleSelectProject} />
  }

  return (
    <div className="devkarm-root">
      <CommandPalette
        rfInstance={rfInstance.current as any} // eslint-disable-line @typescript-eslint/no-explicit-any
        onToggleEditor={() => setEditorVisible((v) => !v)}
        onAutoLayout={runAnimatedLayout}
        onGenerateMigration={handleGenerateMigration}
        onToggleDebugger={() => setDebuggerOpen((v) => !v)}
        onToggleKanban={() => setKanbanOpen((v) => !v)}
      />

      {/* ── SQL Migration Modal ── */}
      {migrationSql !== null && (
        <MigrationModal
          sql={migrationSql}
          onClose={() => setMigrationSql(null)}
        />
      )}

      {/* ── Kanban Overlay ── */}
      {kanbanOpen && (
        <KanbanOverlay
          onClose={() => setKanbanOpen(false)}
          onPanToNode={handlePanToNode}
        />
      )}

      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-back"
            onClick={() => {
              saveFileState(useFileStore.getState().activeFileId)
              detachCollabBridge()
              destroyAwareness()
              destroyCollab()
              useCanvasStore.getState().setCurrentFile(null)
              setCurrentProject(null)
            }}
            title="Back to Projects"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="topbar-logo">DEVKARM</span>
          <span className="topbar-project-name">{currentProject.name}</span>
        </div>

        <nav className="mode-toggle">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-btn${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          {/* Presence bar — who's online */}
          <PresenceBar followingUserId={followingUserId} onFollow={setFollowingUserId} />

          {/* Save status indicator */}
          {saveStatus !== 'idle' && (
            <span className={`save-status save-status--${saveStatus}`}>
              {saveStatus === 'unsaved' && 'Unsaved'}
              {saveStatus === 'saving'  && 'Saving…'}
              {saveStatus === 'saved'   && 'Saved ✓'}
              {saveStatus === 'error'   && 'Error'}
            </span>
          )}

          {/* Canvas controls */}
          <button
            className="topbar-icon-btn"
            onClick={() => runSync(useEditorStore.getState().code)}
            title="Force Sync — re-parse editor code and rebuild canvas"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="topbar-icon-btn topbar-icon-btn--danger"
            onClick={() => useCanvasStore.getState().clearCanvas()}
            title="Clear Canvas — remove all nodes and edges"
          >
            <Trash2 size={14} />
          </button>

          <button
            className="topbar-kbd-hint"
            onClick={() => window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
            )}
            title="Command Palette (Ctrl+K)"
          >
            Ctrl+K
          </button>
          <button
            className={`topbar-icon-btn${debuggerOpen ? ' topbar-icon-btn--active' : ''}`}
            onClick={() => setDebuggerOpen((v) => !v)}
            title="Toggle Replay Debugger"
          >
            <Bug size={14} />
          </button>
          <button
            className={`topbar-icon-btn${kanbanOpen ? ' topbar-icon-btn--active' : ''}`}
            onClick={() => setKanbanOpen((v) => !v)}
            title="Kanban Board (Ctrl+B)"
          >
            <Kanban size={14} />
          </button>

          <Settings size={16} className="topbar-icon" />

          {/* User info + Sign Out */}
          <span className="topbar-user" title={authEmail}>
            {authName}
          </span>
          <button
            className="topbar-icon-btn topbar-signout"
            onClick={logout}
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── File Tabs ── */}
      <FileTabs
        onSwitch={handleFileSwitch}
        onCreate={handleFileCreate}
        onClose={handleFileClose}
        onRename={handleFileRename}
        onCloseOthers={handleFileCloseOthers}
      />

      {/* ── Body ── */}
      <div className="body">
        {/* ── Left Sidebar ── */}
        <div className={`sidebar-wrap${sidebarExpanded ? ' sidebar-wrap--expanded' : ''}`}>
          {/* Tab strip */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab${sidebarTab === 'components' ? ' sidebar-tab--active' : ''}`}
              onClick={() => { setSidebarTab('components'); setSidebarExpanded(true) }}
              title="Components"
            >
              {sidebarExpanded ? 'Components' : '⬡'}
            </button>
            <button
              className={`sidebar-tab${sidebarTab === 'packages' ? ' sidebar-tab--active' : ''}`}
              onClick={() => { setSidebarTab('packages'); setSidebarExpanded(true) }}
              title="Packages"
            >
              {sidebarExpanded ? 'Packages' : '📦'}
            </button>
            <button
              className={`sidebar-tab${sidebarTab === 'issues' ? ' sidebar-tab--active' : ''}`}
              onClick={() => { setSidebarTab('issues'); setSidebarExpanded(true) }}
              title="Issues"
            >
              {sidebarExpanded ? 'Issues' : '🐛'}
            </button>
          </div>

          {sidebarTab === 'components' ? (
            <ComponentPalette
              expanded={sidebarExpanded}
              onToggle={() => setSidebarExpanded((v) => !v)}
            />
          ) : sidebarTab === 'packages' ? (
            <PackageSearch />
          ) : (
            <IssuesTab onPanToNode={handlePanToNode} />
          )}
        </div>

        {/* ── Main Panes ── */}
        <main className="main">
          {/* Canvas Pane */}
          <div
            className={`pane canvas-pane${isDragOver ? ' canvas-pane--drag-over' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            onClick={handleCanvasClick}
          >
            <div className="canvas-flow-area">
              <ReactFlow
                colorMode="dark"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineStyle={{ stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '6 3' }}
                onMoveEnd={(_event, viewport) => updateViewport(viewport)}
                onInit={(instance) => { rfInstance.current = instance }}
                onNodeContextMenu={(e, node) => {
                  e.preventDefault()
                  setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY })
                }}
                isValidConnection={isValidConnectionCallback}
                onConnectStart={handleConnectStart}
                onConnectEnd={handleConnectEnd}
                // Block keyboard deletion while code→graph sync is in progress so
                // React Flow can't remove nodes that are about to be re-created.
                onBeforeDelete={async () => !useSyncStore.getState().isSyncingFromCode}
                // Keyboard Delete/Backspace: React Flow has already applied the
                // removal via onNodesChange; now regenerate the editor code.
                onDelete={({ nodes: dn, edges: de }) => {
                  if (dn.length > 0 || de.length > 0) {
                    // Small delay lets React Flow finish flushing the deletion.
                    setTimeout(() => useCanvasStore.getState().triggerGraphToCode(), 50)
                  }
                }}
                fitView
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  color="#1A1A2E"
                  gap={24}
                  size={1.5}
                />
                <Controls />
                <Cursors />
                <MiniMap
                  style={{ background: '#0D0D14' }}
                  maskColor="rgba(10, 10, 15, 0.8)"
                  pannable
                  zoomable
                  nodeColor={(n) => {
                    if (n.type === 'functionNode')  return '#3B82F6'
                    if (n.type === 'variableNode')  return '#10B981'
                    if (n.type === 'apiNode')       return '#F97316'
                    if (n.type === 'conditionNode') return '#F59E0B'
                    if (n.type === 'loopNode')      return '#8B5CF6'
                    if (n.type === 'tryCatchNode')  return '#EF4444'
                    if (n.type === 'commentNode')   return '#4B5563'
                    if (n.type === 'bugNode')       return '#EF4444'
                    return '#A78BFA'
                  }}
                  nodeStrokeWidth={0}
                />
              </ReactFlow>
            </div>
            <DescribeBar />
            {/* ── Replay Debugger Timeline ── */}
            {debuggerOpen && (
              <Timeline onClose={() => setDebuggerOpen(false)} />
            )}
          </div>

          {editorVisible && <div className="pane-divider" />}

          {editorVisible && (
            <div className="pane editor-pane">
              <MonacoEditor
                height="100%"
                language={getLang(activeFileName)}
                theme="vs-dark"
                defaultValue={storeCode}
                onMount={handleEditorMount}
                onChange={handleCodeChange}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'none',
                  tabSize: 2,
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── Node Context Menu ── */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={ctxEdit}
          onDuplicate={ctxDuplicate}
          onDelete={ctxDelete}
          onAddTest={ctxAddTest}
          onViewCode={ctxViewCode}
          onClose={closeContextMenu}
        />
      )}

      {/* ── Toast ── */}
      {toast && <div className="devkarm-toast">{toast}</div>}

      {/* ── Connection validity tooltip ── */}
      {connTooltip && (
        <div
          className="conn-tooltip"
          style={{ left: connTooltip.x, top: connTooltip.y }}
        >
          {connTooltip.text}
        </div>
      )}
    </div>
  )
}

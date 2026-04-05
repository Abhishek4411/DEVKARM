import { useState, useEffect } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'cmdk'
import {
  FunctionSquare,
  Variable,
  Globe,
  GitBranch,
  Repeat,
  ShieldAlert,
  MessageSquare,
  LayoutGrid,
  Trash2,
  PanelRightClose,
  RotateCcw,
  Maximize2,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RFInstance = { fitView: (opts?: any) => void } | null
import { useCanvasStore, type AppNode } from '../../stores/canvas-store'
import { useEditorStore, DEFAULT_CODE } from '../../stores/editor-store'
import './CommandPalette.css'

interface Props {
  rfInstance: RFInstance
  onToggleEditor: () => void
  onAutoLayout: () => void
}

type Command = {
  id: string
  label: string
  group: string
  icon: React.ReactNode
  action: () => void
}

export default function CommandPalette({ rfInstance, onToggleEditor, onAutoLayout }: Props) {
  const [open, setOpen] = useState(false)

  const addNode = useCanvasStore((s) => s.addNode)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const nodes = useCanvasStore((s) => s.nodes)
  const setCode = useEditorStore((s) => s.setCode)

  // Global keyboard listeners
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      // Ctrl+Shift+L → Auto Layout
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        onAutoLayout()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAutoLayout])

  function run(action: () => void) {
    action()
    setOpen(false)
  }

  function newPos() {
    // Stagger below existing nodes so they don't pile up
    const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y), 0)
    return { x: 240, y: nodes.length === 0 ? 100 : maxY + 180 }
  }

  function mkFn(): AppNode {
    return {
      id: `fn-${Date.now()}`,
      type: 'functionNode',
      position: newPos(),
      data: { name: 'newFunction', params: [], returnType: 'void', code: '// body' },
    }
  }
  function mkVar(): AppNode {
    return {
      id: `var-${Date.now()}`,
      type: 'variableNode',
      position: newPos(),
      data: { name: 'newVar', varType: 'const', value: '""' },
    }
  }
  function mkApi(): AppNode {
    return {
      id: `api-${Date.now()}`,
      type: 'apiNode',
      position: newPos(),
      data: { method: 'GET' as const, path: '/api/endpoint', status: 'idle' as const },
    }
  }
  function mkCond(): AppNode {
    return {
      id: `cond-${Date.now()}`,
      type: 'conditionNode',
      position: newPos(),
      data: { condition: 'x > 0' },
    }
  }
  function mkLoop(): AppNode {
    return {
      id: `loop-${Date.now()}`,
      type: 'loopNode',
      position: newPos(),
      data: { loopKind: 'for' as const, expression: 'let i = 0; i < 10; i++' },
    }
  }
  function mkTryCatch(): AppNode {
    return {
      id: `tc-${Date.now()}`,
      type: 'tryCatchNode',
      position: newPos(),
      data: { errorVar: 'error' },
    }
  }
  function mkComment(): AppNode {
    return {
      id: `note-${Date.now()}`,
      type: 'commentNode',
      position: newPos(),
      data: { text: '', width: 200 },
    }
  }

  const commands: Command[] = [
    {
      id: 'add-fn',
      label: 'Add Function Node',
      group: 'Canvas',
      icon: <FunctionSquare size={14} />,
      action: () => addNode(mkFn()),
    },
    {
      id: 'add-var',
      label: 'Add Variable Node',
      group: 'Canvas',
      icon: <Variable size={14} />,
      action: () => addNode(mkVar()),
    },
    {
      id: 'add-api',
      label: 'Add API Node',
      group: 'Canvas',
      icon: <Globe size={14} />,
      action: () => addNode(mkApi()),
    },
    {
      id: 'add-cond',
      label: 'Add Condition Node',
      group: 'Canvas',
      icon: <GitBranch size={14} />,
      action: () => addNode(mkCond()),
    },
    {
      id: 'add-loop',
      label: 'Add Loop Node',
      group: 'Canvas',
      icon: <Repeat size={14} />,
      action: () => addNode(mkLoop()),
    },
    {
      id: 'add-trycatch',
      label: 'Add Try-Catch Node',
      group: 'Canvas',
      icon: <ShieldAlert size={14} />,
      action: () => addNode(mkTryCatch()),
    },
    {
      id: 'add-note',
      label: 'Add Note',
      group: 'Canvas',
      icon: <MessageSquare size={14} />,
      action: () => addNode(mkComment()),
    },
    {
      id: 'auto-layout',
      label: 'Auto Layout',
      group: 'Canvas',
      icon: <LayoutGrid size={14} />,
      action: onAutoLayout,
    },
    {
      id: 'clear',
      label: 'Clear Canvas',
      group: 'Canvas',
      icon: <Trash2 size={14} />,
      action: clearCanvas,
    },
    {
      id: 'zoom-fit',
      label: 'Zoom to Fit',
      group: 'Canvas',
      icon: <Maximize2 size={14} />,
      action: () => rfInstance?.fitView({ duration: 400 }),
    },
    {
      id: 'toggle-editor',
      label: 'Toggle Code Editor',
      group: 'Editor',
      icon: <PanelRightClose size={14} />,
      action: onToggleEditor,
    },
    {
      id: 'reset-code',
      label: 'Reset Code',
      group: 'Editor',
      icon: <RotateCcw size={14} />,
      action: () => setCode(DEFAULT_CODE),
    },
  ]

  const groups = [...new Set(commands.map((c) => c.group))]

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <CommandInput className="cmdk-input" placeholder="Type a command…" />
      <CommandList className="cmdk-list">
        <CommandEmpty className="cmdk-empty">No commands found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} className="cmdk-group" heading={group}>
            {commands
              .filter((c) => c.group === group)
              .map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  value={cmd.label}
                  className="cmdk-item"
                  onSelect={() => run(cmd.action)}
                >
                  <span className="cmdk-item__icon">{cmd.icon}</span>
                  <span>{cmd.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="cmdk-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>Ctrl+Shift+L</kbd> auto-layout</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </CommandDialog>
  )
}

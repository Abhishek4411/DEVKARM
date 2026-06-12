import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import type { AppNode } from './canvas-store'
import { DEFAULT_CODE } from './editor-store'

export interface FileDependency {
  importedSymbol: string
  fromPath: string
  resolvedFileId?: string
}

export interface FileData {
  id: string
  name: string
  code: string
  nodes: AppNode[]
  edges: Edge[]
  fileDependencies: FileDependency[]
}

const MAIN_ID = 'file-main'

interface FileStoreState {
  files: FileData[]
  activeFileId: string
  /** Create a new file. Caller supplies the id so it can switch to it immediately. */
  createFile: (id: string, name: string) => void
  /** Delete file; always keeps at least one. Returns the id to activate next. */
  deleteFile: (id: string) => string
  /** Close all other files. Returns ids that were removed. */
  closeOthers: (keepId: string) => void
  /** Rename a file. */
  renameFile: (id: string, name: string) => void
  /** Change the active file pointer. Does NOT load canvas/editor — App.tsx does that. */
  switchFile: (id: string) => void
  /** Persist canvas+editor state back into the store for a given file. */
  updateFile: (id: string, data: Pick<FileData, 'code' | 'nodes' | 'edges'>) => void
  /** Store parsed import dependencies for a file. */
  setFileDependencies: (id: string, deps: FileDependency[]) => void
  getFile: (id: string) => FileData | undefined
  getActiveFile: () => FileData | undefined
  /** Atomically move a node and its edges from one file to another. */
  moveNodeToFile: (nodeId: string, sourceFileId: string, targetFileId: string) => void
  /** Erases existing architecture safely and sets entirely new files. */
  bulkLoadFiles: (newFiles: FileData[]) => void
}

export const useFileStore = create<FileStoreState>()((set, get) => ({
  files: [
    { id: MAIN_ID, name: 'main.js', code: DEFAULT_CODE, nodes: [], edges: [], fileDependencies: [] },
  ],
  activeFileId: MAIN_ID,

  createFile: (id, name) =>
    set((s) => ({
      files: [...s.files, { id, name, code: '', nodes: [], edges: [], fileDependencies: [] }],
    })),

  deleteFile: (id) => {
    const { files, activeFileId } = get()
    if (files.length === 1) {
      // Replace with a fresh main file rather than leaving zero files
      const newId = `file-${Date.now()}`
      set({ files: [{ id: newId, name: 'main.js', code: '', nodes: [], edges: [], fileDependencies: [] }], activeFileId: newId })
      return newId
    }
    const remaining = files.filter((f) => f.id !== id)
    const currentIndex = files.findIndex((f) => f.id === id)
    const nextActive =
      activeFileId === id
        ? (remaining[Math.min(currentIndex, remaining.length - 1)]?.id ?? remaining[0].id)
        : activeFileId
    set({ files: remaining, activeFileId: nextActive })
    return nextActive
  },

  closeOthers: (keepId) =>
    set((s) => ({
      files: s.files.filter((f) => f.id === keepId),
      activeFileId: keepId,
    })),

  renameFile: (id, name) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, name } : f)),
    })),

  switchFile: (id) => set({ activeFileId: id }),

  updateFile: (id, data) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, ...data } : f)),
    })),

  setFileDependencies: (id, deps) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, fileDependencies: deps } : f)),
    })),

  getFile: (id) => get().files.find((f) => f.id === id),
  getActiveFile: () => {
    const { files, activeFileId } = get()
    return files.find((f) => f.id === activeFileId)
  },

  moveNodeToFile: (nodeId, sourceFileId, targetFileId) => {
    set((s) => {
      const sourceFile = s.files.find((f) => f.id === sourceFileId)
      const targetFile = s.files.find((f) => f.id === targetFileId)
      if (!sourceFile || !targetFile) return s

      // Find the node
      const nodeIndex = sourceFile.nodes.findIndex((n) => n.id === nodeId)
      if (nodeIndex === -1) return s
      const nodeToMove = sourceFile.nodes[nodeIndex]

      // Find all edges connected to this node
      const edgesToMove = sourceFile.edges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      )

      // Remove from source
      const newSourceNodes = [...sourceFile.nodes]
      newSourceNodes.splice(nodeIndex, 1)
      const newSourceEdges = sourceFile.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      )

      const newTargetNodes = [...targetFile.nodes, nodeToMove]
      const newTargetEdges = [...targetFile.edges, ...edgesToMove]

      return {
        files: s.files.map((f) => {
          if (f.id === sourceFileId) {
            return { ...f, nodes: newSourceNodes, edges: newSourceEdges }
          }
          if (f.id === targetFileId) {
            return { ...f, nodes: newTargetNodes, edges: newTargetEdges }
          }
          return f
        }),
      }
    })
  },

  bulkLoadFiles: (newFiles) => {
    if (newFiles.length === 0) return
    set({
      files: newFiles,
      activeFileId: newFiles[0].id
    })
  },
}))

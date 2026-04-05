import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import type { AppNode } from './canvas-store'
import { DEFAULT_CODE } from './editor-store'

export interface FileData {
  id: string
  name: string
  code: string
  nodes: AppNode[]
  edges: Edge[]
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
  getFile: (id: string) => FileData | undefined
  getActiveFile: () => FileData | undefined
}

export const useFileStore = create<FileStoreState>()((set, get) => ({
  files: [
    { id: MAIN_ID, name: 'main.js', code: DEFAULT_CODE, nodes: [], edges: [] },
  ],
  activeFileId: MAIN_ID,

  createFile: (id, name) =>
    set((s) => ({
      files: [...s.files, { id, name, code: '', nodes: [], edges: [] }],
    })),

  deleteFile: (id) => {
    const { files, activeFileId } = get()
    if (files.length === 1) {
      // Replace with a fresh main file rather than leaving zero files
      const newId = `file-${Date.now()}`
      set({ files: [{ id: newId, name: 'main.js', code: '', nodes: [], edges: [] }], activeFileId: newId })
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

  getFile: (id) => get().files.find((f) => f.id === id),
  getActiveFile: () => {
    const { files, activeFileId } = get()
    return files.find((f) => f.id === activeFileId)
  },
}))

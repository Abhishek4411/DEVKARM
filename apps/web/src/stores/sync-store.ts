import { create } from 'zustand'

/**
 * Sync-lock flags prevent the two Trinity Sync directions from triggering
 * each other in an infinite loop.
 *
 *  isSyncingFromCode  — code-to-graph is running; canvas-store onNodesChange
 *                       must skip the graph-to-code pipeline.
 *  isSyncingFromGraph — graph-to-code is running; editor setCode must skip
 *                       the code-to-graph pipeline.
 */
interface SyncState {
  isSyncingFromCode: boolean
  isSyncingFromGraph: boolean
  setSyncingFromCode: (v: boolean) => void
  setSyncingFromGraph: (v: boolean) => void
}

export const useSyncStore = create<SyncState>()((set) => ({
  isSyncingFromCode: false,
  isSyncingFromGraph: false,
  setSyncingFromCode: (v) => set({ isSyncingFromCode: v }),
  setSyncingFromGraph: (v) => set({ isSyncingFromGraph: v }),
}))

import { create } from 'zustand'

interface UiState {
  /** Set to a node id to programmatically open its inline edit form. Cleared by the node after consuming. */
  editingNodeId: string | null
  setEditingNodeId: (id: string | null) => void
}

export const useUiStore = create<UiState>()((set) => ({
  editingNodeId: null,
  setEditingNodeId: (id) => set({ editingNodeId: id }),
}))

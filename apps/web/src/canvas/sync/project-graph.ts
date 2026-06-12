/**
 * project-graph.ts — Unified Project Graph Orchestrator
 *
 * Builds the multi-file canvas view:
 *   1. Creates a FileRegionNode per file (swim lane container)
 *   2. Positions all files' nodes inside their region with parentId
 *   3. Creates dashed InterFileEdge connections for cross-file imports
 */

import type { Edge } from '@xyflow/react'
import type { AppNode, InterFileEdge } from '../../stores/canvas-store'
import type { FileData } from '../../stores/file-store'

// ── Layout constants ─────────────────────────────────────────────────────────
export const REGION_WIDTH = 560
export const REGION_GAP = 100
export const REGION_HEADER_HEIGHT = 50
export const NODE_PADDING = 20
const COLS = 3  // number of file regions per row

// ── File path resolution ─────────────────────────────────────────────────────

/**
 * Resolve a relative import path (e.g., './utils') to a file in the store.
 * Tries: exact match, with .js, .ts, .jsx, .tsx extensions.
 */
function resolveFilePath(fromPath: string, files: FileData[]): FileData | undefined {
  // Strip leading ./ or ../
  const cleanPath = fromPath.replace(/^\.\//, '').replace(/^\.\.\//, '')

  // Try exact name match first
  const exact = files.find((f) => f.name === cleanPath)
  if (exact) return exact

  // Try adding extensions
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go']
  for (const ext of extensions) {
    const match = files.find((f) => f.name === cleanPath + ext)
    if (match) return match
  }

  // Try matching without extension (e.g. './utils' matches 'utils.js')
  const withoutExt = files.find((f) => {
    const baseName = f.name.replace(/\.[^.]+$/, '')
    return baseName === cleanPath
  })
  return withoutExt
}

/**
 * Returns the layout bounds for all file regions, used for hit-testing
 * during cross-file drag and drop.
 */
export function getRegionBounds(files: FileData[]) {
  return files.map((file, index) => {
    const col = index % COLS
    const row = Math.floor(index / COLS)
    const x = col * (REGION_WIDTH + REGION_GAP) + 50
    const y = row * 500 + 50
    
    const nodeRows = Math.max(file.nodes.length, 1)
    const height = REGION_HEADER_HEIGHT + (nodeRows * 120) + NODE_PADDING * 2
    
    return { fileId: file.id, name: file.name, x, y, width: REGION_WIDTH, height }
  })
}

// ── Main builder ─────────────────────────────────────────────────────────────

export interface ProjectGraphResult {
  nodes: AppNode[]
  edges: Edge[]
  interFileEdges: InterFileEdge[]
}

export function buildProjectGraph(files: FileData[]): ProjectGraphResult {
  const allNodes: AppNode[] = []
  const allEdges: Edge[] = []
  const interFileEdges: InterFileEdge[] = []

  // Track which files have been created as regions (for unresolved ghost nodes)
  const regionIds = new Map<string, string>() // fileId → regionNodeId

  // ── Step 1: Create FileRegionNode per file ──────────────────────────────
  files.forEach((file, index) => {
    const col = index % COLS
    const row = Math.floor(index / COLS)
    const regionId = `region-${file.id}`
    regionIds.set(file.id, regionId)

    const regionX = col * (REGION_WIDTH + REGION_GAP) + 50
    const regionY = row * 500 + 50

    // Compute region height based on number of nodes
    const nodeRows = Math.max(file.nodes.length, 1)
    const regionHeight = REGION_HEADER_HEIGHT + (nodeRows * 120) + NODE_PADDING * 2

    allNodes.push({
      id: regionId,
      type: 'fileRegionNode',
      position: { x: regionX, y: regionY },
      data: {
        fileName: file.name,
        fileId: file.id,
        nodeCount: file.nodes.length,
        dependencies: file.fileDependencies?.map((d) => ({
          importedSymbol: d.importedSymbol,
          fromPath: d.fromPath,
        })),
      },
      style: {
        width: REGION_WIDTH,
        height: regionHeight,
        zIndex: -1,
      },
    } as AppNode)

    // ── Step 2: Position child nodes inside the region ───────────────────
    file.nodes.forEach((node, nodeIndex) => {
      const childX = NODE_PADDING + 40
      const childY = REGION_HEADER_HEIGHT + NODE_PADDING + (nodeIndex * 110)

      allNodes.push({
        ...node,
        id: `${file.id}__${node.id}`,  // namespace to avoid ID collisions
        position: { x: childX, y: childY },
        parentId: regionId,
        extent: 'parent' as const,
      } as AppNode)
    })

    // Local edges (within the file) — adjust IDs to match namespaced nodes
    file.edges.forEach((edge) => {
      allEdges.push({
        ...edge,
        id: `${file.id}__${edge.id}`,
        source: `${file.id}__${edge.source}`,
        target: `${file.id}__${edge.target}`,
      })
    })
  })

  // ── Step 3: Create inter-file edges from dependencies ─────────────────
  for (const file of files) {
    if (!file.fileDependencies) continue

    const sourceRegionId = regionIds.get(file.id)
    if (!sourceRegionId) continue

    // Group dependencies by fromPath to avoid duplicate edges
    const pathGroups = new Map<string, typeof file.fileDependencies>()
    for (const dep of file.fileDependencies) {
      const existing = pathGroups.get(dep.fromPath) ?? []
      existing.push(dep)
      pathGroups.set(dep.fromPath, existing)
    }

    for (const [fromPath, deps] of pathGroups) {
      const targetFile = resolveFilePath(fromPath, files)

      if (targetFile) {
        // Resolved: connect to the target file's region
        const targetRegionId = regionIds.get(targetFile.id)
        if (!targetRegionId || targetRegionId === sourceRegionId) continue

        const edgeId = `interfile-${file.id}-${targetFile.id}-${fromPath}`
        const symbols = deps.map((d) => d.importedSymbol).join(', ')

        interFileEdges.push({
          id: edgeId,
          source: sourceRegionId,
          target: targetRegionId,
          sourceHandle: 'source',
          targetHandle: 'target',
          type: 'default',
          animated: true,
          style: {
            stroke: '#A78BFA',
            strokeWidth: 2,
            strokeDasharray: '8 4',
          },
          label: symbols,
          labelStyle: {
            fontSize: 10,
            fontWeight: 600,
            fill: '#A78BFA',
            fontFamily: 'JetBrains Mono, monospace',
          },
          labelBgStyle: {
            fill: '#0D0D14',
            fillOpacity: 0.9,
          },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          data: {
            sourceFileId: file.id,
            targetFileId: targetFile.id,
            importedSymbol: symbols,
            fromPath,
          },
        })
      } else {
        // Unresolved: create a ghost region node for the missing file
        const ghostId = `ghost-${fromPath}`
        if (!allNodes.find((n) => n.id === ghostId)) {
          // Position ghost nodes to the right
          const ghostIndex = allNodes.filter((n) => n.id.startsWith('ghost-')).length
          const ghostCol = (files.length + ghostIndex) % COLS
          const ghostRow = Math.floor((files.length + ghostIndex) / COLS)

          allNodes.push({
            id: ghostId,
            type: 'fileRegionNode',
            position: {
              x: ghostCol * (REGION_WIDTH + REGION_GAP) + 50,
              y: ghostRow * 500 + 50,
            },
            data: {
              fileName: fromPath,
              fileId: ghostId,
              nodeCount: 0,
              isUnresolved: true,
            },
            style: {
              width: REGION_WIDTH,
              height: 120,
              zIndex: -1,
            },
          } as AppNode)
        }

        const edgeId = `interfile-${file.id}-ghost-${fromPath}`
        const symbols = deps.map((d) => d.importedSymbol).join(', ')

        interFileEdges.push({
          id: edgeId,
          source: sourceRegionId,
          target: ghostId,
          sourceHandle: 'source',
          targetHandle: 'target',
          type: 'default',
          animated: true,
          style: {
            stroke: '#EF4444',
            strokeWidth: 2,
            strokeDasharray: '8 4',
          },
          label: `${symbols} (unresolved)`,
          labelStyle: {
            fontSize: 10,
            fontWeight: 600,
            fill: '#f87171',
            fontFamily: 'JetBrains Mono, monospace',
          },
          labelBgStyle: {
            fill: '#0D0D14',
            fillOpacity: 0.9,
          },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          data: {
            sourceFileId: file.id,
            targetFileId: ghostId,
            importedSymbol: symbols,
            fromPath,
          },
        })
      }
    }
  }

  // Combine all edges
  const combinedEdges = [...allEdges, ...interFileEdges]

  return { nodes: allNodes, edges: combinedEdges, interFileEdges }
}

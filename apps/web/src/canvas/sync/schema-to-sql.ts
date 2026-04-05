import type { Edge } from '@xyflow/react'
import type { AppNode } from '../../stores/canvas-store'
import type { DatabaseTableNodeData, TableColumn } from '../nodes/DatabaseTableNode'

/** One FK relationship extracted from edges between DatabaseTableNodes. */
interface FkRelation {
  fromTable: string
  fromCol: string
  toTable: string
  toCol: string
}

function isDatabaseTableNode(node: AppNode): node is AppNode & { data: DatabaseTableNodeData } {
  return node.type === 'databaseTableNode'
}

function sanitizeName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'unnamed'
}

function columnDDL(col: TableColumn): string {
  const name = sanitizeName(col.name)
  const type = col.type || 'TEXT'
  const parts: string[] = [name, type]

  if (col.constraints.includes('PK')) parts.push('PRIMARY KEY')
  if (col.constraints.includes('NOT NULL') && !col.constraints.includes('PK')) parts.push('NOT NULL')
  if (col.constraints.includes('UNIQUE') && !col.constraints.includes('PK')) parts.push('UNIQUE')

  return `  ${parts.join(' ')}`
}

/**
 * Generate a SQL migration from all DatabaseTableNodes on the canvas.
 * Edges between two DatabaseTableNodes are treated as FK relationships.
 */
export function schemaToSql(nodes: AppNode[], edges: Edge[]): string {
  const tableNodes = nodes.filter(isDatabaseTableNode)

  if (tableNodes.length === 0) {
    return '-- No database table nodes on canvas.\n-- Add DatabaseTableNode(s) and connect them to generate a migration.'
  }

  // Build a map of nodeId → tableName for FK resolution
  const nodeToTable = new Map<string, string>(
    tableNodes.map((n) => [n.id, sanitizeName(n.data.tableName)])
  )

  // Extract FK relationships from edges connecting two table nodes
  const fkRelations: FkRelation[] = []
  for (const edge of edges) {
    const fromTable = nodeToTable.get(edge.source)
    const toTable = nodeToTable.get(edge.target)
    if (!fromTable || !toTable) continue

    // Find a FK-constrained column in the source table, else create a synthetic one
    const sourceNode = tableNodes.find((n) => n.id === edge.source)
    const fkCol = sourceNode?.data.columns.find((c: TableColumn) => c.constraints.includes('FK'))
    const colName = fkCol ? sanitizeName(fkCol.name) : `${toTable}_id`

    // Find PK on target table to reference
    const targetNode = tableNodes.find((n) => n.id === edge.target)
    const pkCol = targetNode?.data.columns.find((c: TableColumn) => c.constraints.includes('PK'))
    const refCol = pkCol ? sanitizeName(pkCol.name) : 'id'

    fkRelations.push({ fromTable, fromCol: colName, toTable, toCol: refCol })
  }

  const lines: string[] = []
  lines.push('-- ============================================================')
  lines.push('-- DEVKARM — Generated SQL Migration')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push('-- ============================================================')
  lines.push('')
  lines.push('BEGIN;')
  lines.push('')
  lines.push('-- Enable UUID extension if not already enabled')
  lines.push('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
  lines.push('')

  // CREATE TABLE statements
  for (const node of tableNodes) {
    const tableName = sanitizeName(node.data.tableName)
    const columns: TableColumn[] = node.data.columns

    lines.push(`-- Table: ${tableName}`)
    lines.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`)

    const colLines: string[] = []
    for (const col of columns) {
      if (!col.name.trim()) continue
      colLines.push(columnDDL(col))
    }

    // If no PK defined, add a default id column
    const hasPk = columns.some((c) => c.constraints.includes('PK'))
    if (!hasPk) {
      colLines.unshift('  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()')
    }

    // FK inline references for columns marked FK
    const inlineFk = columns.filter((c) => c.constraints.includes('FK') && c.name.trim())
    for (const fkCol of inlineFk) {
      const rel = fkRelations.find((r) => r.fromTable === tableName && r.fromCol === sanitizeName(fkCol.name))
      if (rel) {
        const lastIdx = colLines.findIndex((l) => l.trim().startsWith(sanitizeName(fkCol.name)))
        if (lastIdx !== -1) {
          colLines[lastIdx] += ` REFERENCES ${rel.toTable}(${rel.toCol})`
        }
      }
    }

    lines.push(colLines.join(',\n'))
    lines.push(');')
    lines.push('')

    // Indexes for PK and FK columns
    const pkColName = columns.find((c) => c.constraints.includes('PK'))
    if (pkColName) {
      lines.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${sanitizeName(pkColName.name)} ON ${tableName}(${sanitizeName(pkColName.name)});`)
    }
    for (const fkCol of inlineFk) {
      lines.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${sanitizeName(fkCol.name)} ON ${tableName}(${sanitizeName(fkCol.name)});`)
    }
    if (inlineFk.length > 0 || pkColName) lines.push('')
  }

  // ALTER TABLE for FK constraints (deferred so all tables exist)
  if (fkRelations.length > 0) {
    lines.push('-- Foreign key constraints')
    for (const rel of fkRelations) {
      const constraintName = `fk_${rel.fromTable}_${rel.fromCol}_${rel.toTable}`
      lines.push(
        `ALTER TABLE ${rel.fromTable}` +
        `\n  ADD CONSTRAINT ${constraintName}` +
        `\n  FOREIGN KEY (${rel.fromCol}) REFERENCES ${rel.toTable}(${rel.toCol})` +
        `\n  ON DELETE CASCADE;`
      )
    }
    lines.push('')
  }

  lines.push('COMMIT;')

  return lines.join('\n')
}

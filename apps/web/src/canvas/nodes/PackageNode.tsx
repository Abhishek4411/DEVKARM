import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import './PackageNode.css'

export interface PackageNodeData extends Record<string, unknown> {
  name: string
  version: string
  description: string
}

export type PackageNodeType = Node<PackageNodeData, 'packageNode'>

function PackageNode({ data, selected }: NodeProps<PackageNodeType>) {
  const { name, version, description } = data

  return (
    <div className={`package-node${selected ? ' package-node--selected' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="package-node__header">
        <span className="package-node__icon">📦</span>
        <div className="package-node__title">
          <span className="package-node__name">{name}</span>
          <span className="package-node__version">{version}</span>
        </div>
      </div>

      {description && (
        <p className="package-node__desc">{description}</p>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

export default memo(PackageNode)

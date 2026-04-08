import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Lock } from 'lucide-react'
import './SecretNode.css'

export interface SecretNodeData extends Record<string, unknown> {
  keyName: string
}

export type SecretNodeType = Node<SecretNodeData, 'secretNode'>

function SecretNode({ id, data, selected }: NodeProps<SecretNodeType>) {
  return (
    <div className={`secret-node ${selected ? 'selected' : ''}`}>
      <div className="secret-node__header">
        <Lock size={12} className="secret-node__icon" />
        <span className="secret-node__title">Secret</span>
      </div>
      
      <div className="secret-node__content">
        <span className="secret-node__key">{data.keyName || 'API_KEY'}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="secret-node__handle" />
    </div>
  )
}

export default memo(SecretNode)

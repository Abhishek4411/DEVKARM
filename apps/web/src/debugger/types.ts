export type EventType = 'enter' | 'exit' | 'error' | 'data'

export interface ExecutionEvent {
  id: string
  nodeId: string
  eventType: EventType
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  durationMs?: number
  errorMessage?: string
  createdAt: string
}

export type NodeReplayState = 'idle' | 'active' | 'done' | 'error'

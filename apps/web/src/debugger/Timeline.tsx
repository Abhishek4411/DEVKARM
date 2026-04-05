import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, SkipBack, X, Zap } from 'lucide-react'
import { useCanvasStore } from '../stores/canvas-store'
import { generateMockEvents } from './mock-events'
import NodeHighlighter from './NodeHighlighter'
import type { ExecutionEvent, NodeReplayState } from './types'
import './Timeline.css'

const SPEEDS = [0.5, 1, 2, 4] as const
type Speed = typeof SPEEDS[number]

interface Props {
  onClose: () => void
}

export default function Timeline({ onClose }: Props) {
  const nodes = useCanvasStore((s) => s.nodes)

  const [events, setEvents] = useState<ExecutionEvent[]>([])
  const [cursor, setCursor] = useState(0)           // index into events[]
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [nodeStates, setNodeStates] = useState<Map<string, NodeReplayState>>(new Map())
  const [activeTooltip, setActiveTooltip] = useState<{
    nodeId: string
    inputData?: Record<string, unknown>
    outputData?: Record<string, unknown>
    durationMs?: number
    errorMessage?: string
  } | null>(null)

  const playRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Generate mock events whenever nodes change
  useEffect(() => {
    const generated = generateMockEvents(nodes)
    setEvents(generated)
    setCursor(0)
    setPlaying(false)
    setNodeStates(new Map())
    setActiveTooltip(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply event at the current cursor position
  const applyEvent = useCallback((idx: number, evts: ExecutionEvent[]) => {
    if (idx < 0 || idx >= evts.length) return
    const ev = evts[idx]

    setNodeStates((prev) => {
      const next = new Map(prev)
      if (ev.eventType === 'enter') {
        next.set(ev.nodeId, 'active')
      } else if (ev.eventType === 'exit') {
        next.set(ev.nodeId, 'done')
      } else if (ev.eventType === 'error') {
        next.set(ev.nodeId, 'error')
      }
      return next
    })

    if (ev.eventType === 'enter' || ev.eventType === 'exit' || ev.eventType === 'error') {
      setActiveTooltip({
        nodeId:       ev.nodeId,
        inputData:    ev.inputData,
        outputData:   ev.outputData,
        durationMs:   ev.durationMs,
        errorMessage: ev.errorMessage,
      })
    }
  }, [])

  // Playback loop
  useEffect(() => {
    if (!playing) {
      if (playRef.current) clearTimeout(playRef.current)
      return
    }
    if (cursor >= events.length) {
      setPlaying(false)
      return
    }

    applyEvent(cursor, events)

    const baseDelay = 400 / speed
    playRef.current = setTimeout(() => {
      setCursor((c) => c + 1)
    }, baseDelay)

    return () => { if (playRef.current) clearTimeout(playRef.current) }
  }, [playing, cursor, events, speed, applyEvent])

  function handleScrub(value: number) {
    if (playing) setPlaying(false)
    const idx = value

    // Rebuild node states up to this point
    const rebuilt = new Map<string, NodeReplayState>()
    for (let i = 0; i <= idx && i < events.length; i++) {
      const ev = events[i]
      if (ev.eventType === 'enter') rebuilt.set(ev.nodeId, 'active')
      else if (ev.eventType === 'exit') rebuilt.set(ev.nodeId, 'done')
      else if (ev.eventType === 'error') rebuilt.set(ev.nodeId, 'error')
    }
    setNodeStates(rebuilt)
    setCursor(idx)

    const ev = events[idx]
    if (ev) {
      setActiveTooltip({ nodeId: ev.nodeId, inputData: ev.inputData, outputData: ev.outputData, durationMs: ev.durationMs, errorMessage: ev.errorMessage })
    }
  }

  function handleReset() {
    setPlaying(false)
    setCursor(0)
    setNodeStates(new Map())
    setActiveTooltip(null)
  }

  function handleRegenerate() {
    const generated = generateMockEvents(nodes)
    setEvents(generated)
    handleReset()
  }

  const activeNodeId = activeTooltip?.nodeId ?? null
  const progress = events.length > 0 ? (cursor / (events.length - 1)) * 100 : 0
  const currentEvent = events[cursor]

  return (
    <>
      <NodeHighlighter
        nodeStates={nodeStates}
        activeNodeId={activeNodeId}
        activeTooltip={activeTooltip}
      />

      <div className="timeline">
        {/* Left controls */}
        <div className="timeline__controls">
          <button className="timeline__btn" onClick={handleReset} title="Reset">
            <SkipBack size={13} />
          </button>
          <button
            className={`timeline__btn timeline__btn--play${playing ? ' timeline__btn--playing' : ''}`}
            onClick={() => setPlaying((v) => !v)}
            title={playing ? 'Pause' : 'Play'}
            disabled={events.length === 0}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>

        {/* Scrubber */}
        <div className="timeline__scrubber-wrap">
          <div className="timeline__progress-bar">
            <div className="timeline__progress-fill" style={{ width: `${progress}%` }} />
            {/* Event tick marks */}
            {events.map((_, i) => (
              <div
                key={i}
                className="timeline__tick"
                style={{ left: `${(i / Math.max(events.length - 1, 1)) * 100}%` }}
              />
            ))}
          </div>
          <input
            className="timeline__scrubber"
            type="range"
            min={0}
            max={Math.max(events.length - 1, 0)}
            value={cursor}
            onChange={(e) => handleScrub(Number(e.target.value))}
            disabled={events.length === 0}
          />
        </div>

        {/* Event counter + node info */}
        <div className="timeline__info">
          {events.length === 0 ? (
            <span className="timeline__empty">No events — add nodes to canvas</span>
          ) : (
            <>
              <span className="timeline__counter">{cursor + 1} / {events.length}</span>
              {currentEvent && (
                <span className={`timeline__event-type timeline__event-type--${currentEvent.eventType}`}>
                  {currentEvent.eventType}
                </span>
              )}
            </>
          )}
        </div>

        {/* Speed selector */}
        <div className="timeline__speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`timeline__speed-btn${speed === s ? ' timeline__speed-btn--active' : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Regenerate mock events */}
        <button className="timeline__btn" onClick={handleRegenerate} title="Regenerate mock events">
          <Zap size={13} />
        </button>

        {/* Close */}
        <button className="timeline__btn timeline__btn--close" onClick={onClose} title="Close Debugger">
          <X size={13} />
        </button>
      </div>
    </>
  )
}

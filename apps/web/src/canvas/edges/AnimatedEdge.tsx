import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

/**
 * AnimatedEdge — a bezier edge with a travelling dot that shows data-flow direction.
 *
 * Uses SVG SMIL <animateMotion> + <mpath> so the dot follows the exact curve with
 * zero JavaScript and no layout dependency on the parent.
 *
 * The edge stroke colour is inherited from the `style.stroke` prop (set per edge
 * in canvas-store) and falls back to the accent blue.
 */
export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Derive accent colour from whatever the edge style says, default blue
  const accent = (style?.stroke as string | undefined) ?? '#3B82F6'
  const pathId = `animated-edge-${id}`

  return (
    <>
      {/*
        BaseEdge renders:
          1. A wide transparent interaction path (makes clicking easier)
          2. The visible stroke path
        We pass our id so the <mpath> can reference it.
      */}
      <BaseEdge
        id={pathId}
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: selected ? '#EF4444' : `${accent}66`,
          strokeWidth: selected ? 3 : 2,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          ...style,
          ...(selected && { stroke: '#EF4444' }),
          // Override store colour with semi-transparent version when not selected
          // (style.stroke is the full colour — we dim it here)
        }}
      />

      {/* ── Travelling dot — trail (faint, slight delay) ── */}
      <circle r={selected ? 4 : 3} fill={selected ? '#EF4444' : accent} opacity={0.25} style={{ pointerEvents: 'none', transition: 'fill 0.2s ease, r 0.2s ease' }}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          calcMode="linear"
          begin="0.18s"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>

      {/* ── Travelling dot — main ── */}
      <circle r={selected ? 5 : 4} fill={selected ? '#EF4444' : accent} opacity={0.9} style={{ pointerEvents: 'none', transition: 'fill 0.2s ease, r 0.2s ease' }}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          calcMode="linear"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>

      {/* ── Leading highlight (tiny, bright) ── */}
      <circle r={selected ? 3 : 2} fill="#ffffff" opacity={0.6} style={{ pointerEvents: 'none', transition: 'r 0.2s ease' }}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          calcMode="linear"
          begin="-0.06s"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </>
  )
}


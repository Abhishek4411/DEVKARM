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
        style={{
          stroke: selected ? accent : `${accent}66`,
          strokeWidth: selected ? 2.5 : 2,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          ...style,
          // Override store colour with semi-transparent version when not selected
          // (style.stroke is the full colour — we dim it here)
        }}
      />

      {/* ── Travelling dot — trail (faint, slight delay) ── */}
      <circle r={3} fill={accent} opacity={0.25} style={{ pointerEvents: 'none' }}>
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
      <circle r={4} fill={accent} opacity={0.9} style={{ pointerEvents: 'none' }}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          calcMode="linear"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>

      {/* ── Leading highlight (tiny, bright) ── */}
      <circle r={2} fill="#ffffff" opacity={0.6} style={{ pointerEvents: 'none' }}>
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

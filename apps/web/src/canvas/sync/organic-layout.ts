import type { AppNode } from '../../stores/canvas-store';
import type { Edge } from '@xyflow/react';
import * as d3 from 'd3-force';

export function applyOrganicLayout(nodes: AppNode[], edges: Edge[]): AppNode[] {
  // We need to map nodes to d3 nodes, which require an object format mutable by d3
  const d3Nodes = nodes.map(n => ({
    ...n,
    x: n.position.x,
    y: n.position.y,
  }));

  const d3Edges = edges.map(e => ({
    source: e.source,
    target: e.target,
  }));

  const simulation = d3.forceSimulation(d3Nodes as d3.SimulationNodeDatum[])
    .force('charge', d3.forceManyBody().strength(-800))
    .force('link', d3.forceLink(d3Edges as any).id((d: any) => d.id).distance(150))
    .force('x', d3.forceX(400).strength(0.05))
    .force('y', d3.forceY(300).strength(0.05))
    .stop();

  // Run the simulation statically for ~300 ticks to let it settle
  simulation.tick(300);

  // Map the new positions back to the original AppNode interface
  return nodes.map((node, index) => {
    const d3Node = d3Nodes[index];
    return {
      ...node,
      position: {
        x: d3Node.x || 0,
        y: d3Node.y || 0,
      },
    };
  });
}

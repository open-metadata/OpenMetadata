/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  EdgeData as G6EdgeData,
  GraphData as G6GraphData,
  NodeData as G6NodeData,
} from '@antv/g6';
import { GraphData } from '../components/KnowledgeGraph/KnowledgeGraph.interface';

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 36;
export const MAX_NODE_WIDTH = 280;
const MIN_NODE_WIDTH = 120;

// Layout: padding(8) + icon(14) + gap(8) + label + gap(8) + typeChip + padding(8)
// label: 14px bold ≈ 9.5px per char
// typeChip: 12px regular ≈ 7.5px per char + 4px left + 4px right internal padding
export const computeNodeWidth = (label: string, type: string): number => {
  const labelWidth = label.length * 9.5;
  const typeChipWidth = type.length * 7.5 + 8;
  const approxWidth = 8 + 14 + 8 + labelWidth + 8 + typeChipWidth + 8;

  return Math.min(
    MAX_NODE_WIDTH,
    Math.max(MIN_NODE_WIDTH, Math.ceil(approxWidth))
  );
};

export const COLOR_SETS: Array<{ main: string; light: string }> = [
  { main: '#1677ff', light: '#e6f4ff' },
  { main: '#52c41a', light: '#f6ffed' },
  { main: '#fa8c16', light: '#fff7e6' },
  { main: '#722ed1', light: '#f9f0ff' },
  { main: '#13c2c2', light: '#e6fffb' },
  { main: '#eb2f96', light: '#fff0f6' },
  { main: '#fa541c', light: '#fff2e8' },
  { main: '#faad14', light: '#fffbe6' },
  { main: '#2f54eb', light: '#f0f5ff' },
  { main: '#389e0d', light: '#d9f7be' },
  { main: '#c41d7f', light: '#ffd6e7' },
  { main: '#08979c', light: '#b5f5ec' },
];

export const getColorSetForType = (
  type: string
): { main: string; light: string } => {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + (type.codePointAt(i) ?? 0)) >>> 0;
  }

  return COLOR_SETS[hash % COLOR_SETS.length];
};

// Border-to-border gap (px) between every pair of adjacent rings in the radial
// layout. All rings are spaced at the same interval: ring-d radius = d × step,
// where step = VISUAL_GAP + 2 × rectExtent(θ). Increase to spread rings out,
// decrease to pack them tighter.
const VISUAL_GAP = 100;

/**
 * Returns the distance from the center of a NODE_WIDTH×NODE_HEIGHT rectangle
 * to its border in the given direction (angle). This is used to compute the
 * exact radius at which a node must be placed so its border is VISUAL_GAP pixels
 * away from the center node's border.
 */
const rectExtent = (angle: number): number => {
  const cosA = Math.abs(Math.cos(angle));
  const sinA = Math.abs(Math.sin(angle));
  if (cosA < 1e-10) {
    return NODE_HEIGHT / 2;
  }
  if (sinA < 1e-10) {
    return NODE_WIDTH / 2;
  }

  return Math.min(NODE_WIDTH / 2 / cosA, NODE_HEIGHT / 2 / sinA);
};

export const computeRadialPositions = (
  nodes: G6NodeData[],
  edges: G6EdgeData[],
  focusId: string,
  cx: number,
  cy: number
): Map<string, { x: number; y: number }> => {
  const adj = new Map<string, Set<string>>();
  nodes.forEach((n) => adj.set(n.id, new Set()));
  edges.forEach((e) => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const depth = new Map<string, number>();
  depth.set(focusId, 0);
  const queue = [focusId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    const currentDepth = depth.get(current) ?? 0;
    adj.get(current)?.forEach((neighbor) => {
      if (!depth.has(neighbor)) {
        depth.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      }
    });
  }

  const byDepth = new Map<number, string[]>();
  depth.forEach((d, id) => {
    if (!byDepth.has(d)) {
      byDepth.set(d, []);
    }
    byDepth.get(d)?.push(id);
  });

  // Pass 1: compute a single uniform ring step large enough to fit every ring.
  // For ring d with n nodes, the minimum step is minCountRadius(d) / d.
  // Taking the max across all rings ensures equal spacing without overlap.
  let uniformStep = VISUAL_GAP + NODE_WIDTH; // baseline at horizontal angle
  byDepth.forEach((nodeIds, d) => {
    if (d === 0) {
      return;
    }
    const minCountRadius =
      (nodeIds.length * (NODE_WIDTH + VISUAL_GAP)) / (2 * Math.PI);
    uniformStep = Math.max(uniformStep, minCountRadius / d);
  });

  // Pass 2: place every ring at exactly d × step. Per-angle adjustment keeps
  // the border-to-border gap equal regardless of which face of the node faces
  // the centre, but each node's radius is at least d × uniformStep.
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(focusId, { x: cx, y: cy });

  byDepth.forEach((nodeIds, d) => {
    if (d === 0) {
      return;
    }
    nodeIds.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / nodeIds.length - Math.PI / 2;
      const radius =
        d * Math.max(uniformStep, VISUAL_GAP + 2 * rectExtent(angle));
      positions.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  });

  return positions;
};

const traceBackPath = (
  parent: Map<string, { nodeId: string; edgeId: string }>,
  startId: string
): { nodeIds: Set<string>; edgeIds: Set<string> } => {
  const nodeIds = new Set<string>([startId]);
  const edgeIds = new Set<string>();
  let current = startId;
  while (parent.has(current)) {
    const entry = parent.get(current);
    if (!entry) {
      break;
    }
    nodeIds.add(entry.nodeId);
    edgeIds.add(entry.edgeId);
    current = entry.nodeId;
  }

  return { nodeIds, edgeIds };
};

const shortestForwardPath = (
  fromId: string,
  toId: string,
  nodes: G6NodeData[],
  edges: G6EdgeData[]
): { nodeIds: Set<string>; edgeIds: Set<string> } => {
  const fwdAdj = new Map<string, Array<{ target: string; edgeId: string }>>();
  nodes.forEach((n) => fwdAdj.set(n.id, []));
  edges.forEach((e) => {
    if (e.id === undefined) {
      return;
    }
    fwdAdj.get(e.source)?.push({ target: e.target, edgeId: String(e.id) });
  });

  const parent = new Map<string, { nodeId: string; edgeId: string }>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  let found = false;

  while (queue.length > 0 && !found) {
    const cur = queue.shift();
    if (!cur) {
      continue;
    }
    for (const { target, edgeId } of fwdAdj.get(cur) ?? []) {
      if (!visited.has(target)) {
        visited.add(target);
        parent.set(target, { nodeId: cur, edgeId });
        if (target === toId) {
          found = true;

          break;
        }
        queue.push(target);
      }
    }
  }

  const { nodeIds, edgeIds } = traceBackPath(parent, toId);

  // If fromId was never reached, the path is disconnected — return empty
  if (!nodeIds.has(fromId)) {
    return { nodeIds: new Set(), edgeIds: new Set() };
  }

  return { nodeIds, edgeIds };
};

export const findHighlightPath = (
  originId: string,
  clickedId: string,
  nodes: G6NodeData[],
  edges: G6EdgeData[]
): { nodeIds: Set<string>; edgeIds: Set<string> } => {
  if (clickedId === originId) {
    return { nodeIds: new Set([originId]), edgeIds: new Set() };
  }

  // Path from origin down to clicked node
  const forward = shortestForwardPath(originId, clickedId, nodes, edges);
  // Path from clicked node back up to origin (via any reverse/back edges)
  const backward = shortestForwardPath(clickedId, originId, nodes, edges);

  return {
    nodeIds: new Set([...forward.nodeIds, ...backward.nodeIds]),
    edgeIds: new Set([...forward.edgeIds, ...backward.edgeIds]),
  };
};

export const transformToG6Format = (data: GraphData | null): G6GraphData => {
  if (!data) {
    return { nodes: [], edges: [] };
  }

  const nodeColorMap = new Map<string, { main: string; light: string }>();

  const nodes: G6NodeData[] = data.nodes.map((node) => {
    const colorSet = getColorSetForType(node.type);
    nodeColorMap.set(node.id, colorSet);
    const nodeWidth = computeNodeWidth(node.label, node.type);

    return {
      id: node.id,
      style: { size: [nodeWidth, NODE_HEIGHT] as [number, number] },
      data: {
        ...node,
        colorMain: colorSet.main,
        colorLight: colorSet.light,
      } as Record<string, unknown>,
    };
  });

  // Group edges by directed pair and merge parallel same-direction edges into one.
  // This eliminates overlap when multiple relationships exist in the same direction
  // between the same two nodes, reducing clutter to at most one edge per direction.
  const edgeGroups = new Map<string, typeof data.edges>();
  data.edges.forEach((edge) => {
    const key = `${edge.from}→${edge.to}`;
    edgeGroups.set(key, [...(edgeGroups.get(key) ?? []), edge]);
  });

  type MergedEdge = (typeof data.edges)[number] & {
    mergedLabels?: string[];
  };

  const mergedEdges: MergedEdge[] = [...edgeGroups.values()].map((group) => {
    if (group.length === 1) {
      return group[0];
    }

    const labels = group.map((e) => e.label);

    return {
      ...group[0],
      label: labels.join(' · '),
      mergedLabels: labels,
    };
  });

  const directionSet = new Set(mergedEdges.map((e) => `${e.from}→${e.to}`));

  const edges: G6EdgeData[] = mergedEdges.map((edge, index) => {
    const isBidirectional = directionSet.has(`${edge.to}→${edge.from}`);
    // G6 computes curveOffset perpendicular to travel direction, so both
    // edges in a bidirectional pair share the same positive value —
    // the reversed travel direction automatically curves them to opposite
    // visual sides. A larger offset (60) ensures paths are visually distinct.
    const curveOffset: number | undefined = isBidirectional ? 60 : undefined;
    // For bidirectional edges, anchor the label near the source node (0.25)
    // so each label sits at a physically different location (one near node A,
    // the other near node B) instead of both crowding the centre.
    const labelPlacement: number | undefined = isBidirectional
      ? 0.35
      : undefined;

    const sourceColor = nodeColorMap.get(edge.to) ?? {
      main: '#595959',
      light: '#f5f5f5',
    };

    return {
      id: `edge-${index}`,
      source: edge.from,
      target: edge.to,
      data: {
        label: edge.label,
        ...(edge.mergedLabels ? { mergedLabels: edge.mergedLabels } : {}),
      } as Record<string, unknown>,
      style: {
        labelText: edge.label,
        labelFontSize: 11,
        labelFill: sourceColor.main,
        labelBackground: true,
        labelBackgroundFill: '#ffffff',
        labelBackgroundOpacity: 1,
        labelBackgroundStroke: sourceColor.main,
        labelBackgroundLineWidth: 1,
        labelBackgroundRadius: 4,
        labelPadding: [3, 6],
        labelZIndex: 100,
        ...(curveOffset === undefined ? {} : { curveOffset }),
        ...(labelPlacement === undefined ? {} : { labelPlacement }),
      },
    };
  });

  return { nodes, edges };
};

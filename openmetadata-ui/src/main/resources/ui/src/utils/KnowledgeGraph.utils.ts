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
  Graph,
  GraphData as G6GraphData,
  IElementEvent,
  NodeData as G6NodeData,
  NodeData,
  NodePortStyleProps,
} from '@antv/g6';
import { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import { toString } from 'lodash';
import {
  EDGE_STYLE_RESET,
  MAX_NODE_WIDTH,
  MIN_NODE_WIDTH,
  NODE_HEIGHT,
  NODE_WIDTH,
  ZOOM_DURATION_MS,
  ZOOM_EASING,
} from '../components/KnowledgeGraph/KnowledgeGraph.constants';
import {
  GraphData,
  GraphInteractionCtx,
} from '../components/KnowledgeGraph/KnowledgeGraph.interface';
import { PRIMARY_COLOR } from '../constants/Color.constants';
import { EntityType } from '../enums/entity.enum';
import { getEntityLinkFromType } from './EntityUtils';
import ELKLayout from './Lineage/Layout/ELKUtil/ELKUtil';

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
    // codePointAt instead of charCodeAt to handle multi-byte Unicode (emoji, CJK)
    hash = (hash * 31 + (type.codePointAt(i) ?? 0)) >>> 0;
  }

  return COLOR_SETS[hash % COLOR_SETS.length];
};

const ELK_KG_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'LEFT',
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '20',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  'elk.spacing.edgeNode': '10',
  'elk.spacing.edgeEdge': '10',
  'elk.partitioning.activate': 'true',
};

const buildDirectedAdjacency = (
  nodes: G6NodeData[],
  edges: G6EdgeData[]
): { forward: Map<string, string[]>; backward: Map<string, string[]> } => {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  nodes.forEach((n) => {
    forward.set(n.id, []);
    backward.set(n.id, []);
  });
  edges.forEach((e) => {
    forward.get(String(e.source))?.push(String(e.target));
    backward.get(String(e.target))?.push(String(e.source));
  });

  return { forward, backward };
};

const bfsFromNode = (
  adj: Map<string, string[]>,
  startId: string
): Map<string, number> => {
  const depth = new Map<string, number>();
  depth.set(startId, 0);
  const queue = [startId];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const d = depth.get(cur)!;
    for (const nbr of adj.get(cur) ?? []) {
      if (!depth.has(nbr)) {
        depth.set(nbr, d + 1);
        queue.push(nbr);
      }
    }
  }

  return depth;
};

const computeDirectedBFSPartitions = (
  nodes: G6NodeData[],
  edges: G6EdgeData[],
  focusNodeId: string
): Map<string, number> => {
  const { forward, backward } = buildDirectedAdjacency(nodes, edges);
  const backDepth = bfsFromNode(backward, focusNodeId);
  const fwdDepth = bfsFromNode(forward, focusNodeId);

  let maxBack = 0;
  backDepth.forEach((d) => {
    if (d > maxBack) {
      maxBack = d;
    }
  });

  const partitions = new Map<string, number>();
  partitions.set(focusNodeId, maxBack);
  // Pure predecessors only — nodes reachable in both directions participate in
  // cycles or cross-paths; assigning them a partition would create backward edges
  // in ELK's layer graph, causing a negative-index crash.
  backDepth.forEach((d, id) => {
    if (id !== focusNodeId && !fwdDepth.has(id)) {
      partitions.set(id, maxBack - d);
    }
  });
  fwdDepth.forEach((d, id) => {
    if (id !== focusNodeId && !backDepth.has(id)) {
      partitions.set(id, maxBack + d);
    }
  });

  return partitions;
};

export const computeELKPositions = async (
  nodes: G6NodeData[],
  edges: G6EdgeData[],
  focusNodeId?: string
): Promise<Map<string, { x: number; y: number }>> => {
  const partitions = focusNodeId
    ? computeDirectedBFSPartitions(nodes, edges, focusNodeId)
    : new Map<string, number>();

  const elkNodes: ElkNode[] = nodes.map((node) => {
    const size = node.style?.size as [number, number] | undefined;
    const partition = partitions.get(node.id);

    return {
      id: node.id,
      width: size?.[0] ?? NODE_WIDTH,
      height: size?.[1] ?? NODE_HEIGHT,
      ...(partition !== undefined && {
        layoutOptions: { 'elk.partitioning.partition': String(partition) },
      }),
    };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge, i) => {
    const rawLabel = edge.data?.['label'];
    const labelText = typeof rawLabel === 'string' ? rawLabel : '';
    // Estimate label bounding box so ELK auto-expands the corridor to fit it.
    // 6.5px/char; labelPadding(6×2) + bgPadding(6×2) + border(1×2) = 26px h.
    const labelWidth = Math.ceil(labelText.length * 6.5 + 26);
    const labelHeight = 26;

    return {
      id: String(edge.id ?? `elk-edge-${i}`),
      sources: [String(edge.source)],
      targets: [String(edge.target)],
      labels: [{ text: labelText, width: labelWidth, height: labelHeight }],
    };
  });

  const toPositionMap = (children: ElkNode[]) =>
    new Map(children.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));

  try {
    const result = await ELKLayout.getElk().layout({
      id: 'root',
      layoutOptions: ELK_KG_LAYOUT_OPTIONS,
      children: elkNodes,
      edges: elkEdges,
    });

    return toPositionMap(result.children ?? []);
  } catch {
    // Partition constraints on cyclic/cross-path graphs cause ELK to crash with a
    // negative-index exception. Retry without partition hints so ELK assigns layers
    // automatically — this always succeeds regardless of graph topology.
    const elkNodesNoPartitions = elkNodes.map(({ id, width, height }) => ({
      id,
      width,
      height,
    }));
    const result = await ELKLayout.getElk().layout({
      id: 'root',
      layoutOptions: {
        ...ELK_KG_LAYOUT_OPTIONS,
        'elk.partitioning.activate': 'false',
      },
      children: elkNodesNoPartitions,
      edges: elkEdges,
    });

    return toPositionMap(result.children ?? []);
  }
};

// Border-to-border gap (px) between every pair of adjacent rings in the radial
// layout. All rings are spaced at the same interval: ring-d radius = d × step,
// where step = VISUAL_GAP + 2 × rectExtent(θ). Increase to spread rings out,
// decrease to pack them tighter.
const VISUAL_GAP = 60;

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
  let qi = 0;
  while (qi < queue.length) {
    const current = queue[qi++];
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

// Border-to-border gap between adjacent nodes within the same ring (px).
const INTRA_RING_GAP = 20;
// Center node is always MAX_NODE_WIDTH=280 (half=140). Ring-1 nodes extend up to
// 140 px toward center. 360 px leaves ≥80 px of visible edge for the widest nodes.
const MIN_FIRST_RING_RADIUS = 360;
// Minimum center-to-center gap added for every additional ring.
// Prevents over-expansion caused by a single large ring forcing all others wide.
const MIN_INTER_RING_GAP = 120;

const ELK_KG_RADIAL_LAYOUT_OPTIONS = {
  'elk.algorithm': 'radial',
  'elk.spacing.nodeNode': '50',
};

export const computeELKRadialPositions = async (
  nodes: G6NodeData[],
  edges: G6EdgeData[],
  focusId: string,
  cx: number,
  cy: number
): Promise<Map<string, { x: number; y: number }>> => {
  // BFS depth from focusId — needed for adaptive ring radii.
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  });

  const bfsDepth = new Map<string, number>();
  bfsDepth.set(focusId, 0);
  const bfsQueue = [focusId];
  let bfsQi = 0;
  while (bfsQi < bfsQueue.length) {
    const curr = bfsQueue[bfsQi++];
    const d = bfsDepth.get(curr) ?? 0;
    for (const neighbor of adj.get(curr) ?? []) {
      if (!bfsDepth.has(neighbor)) {
        bfsDepth.set(neighbor, d + 1);
        bfsQueue.push(neighbor);
      }
    }
  }

  const byDepth = new Map<number, string[]>();
  bfsDepth.forEach((d, id) => {
    if (!byDepth.has(d)) {
      byDepth.set(d, []);
    }
    byDepth.get(d)?.push(id);
  });

  // Compute target radius per ring: only expand as much as each ring's own
  // nodes require, never by the global maximum across all rings.
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const sortedDepths = [...byDepth.keys()]
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  const ringRadii = new Map<number, number>();
  let prevRadius = 0;

  for (const d of sortedDepths) {
    const nodeIds = byDepth.get(d) ?? [];
    const totalWidth = nodeIds.reduce((sum, id) => {
      const size = nodeMap.get(id)?.style?.size as [number, number] | undefined;

      return sum + (size?.[0] ?? NODE_WIDTH);
    }, 0);
    const minCircRadius =
      (totalWidth + nodeIds.length * INTRA_RING_GAP) / (2 * Math.PI);
    const minComfort = d === 1 ? MIN_FIRST_RING_RADIUS : 0;
    const minFromPrev = prevRadius + MIN_INTER_RING_GAP;
    const radius = Math.max(minCircRadius, minComfort, minFromPrev);
    ringRadii.set(d, radius);
    prevRadius = radius;
  }

  // Use ELK radial for angular placement (smarter than uniform: distributes
  // nodes proportionally by subtree size). Override the radii with ours.
  try {
    const elkNodes = nodes.map((node) => {
      const size = node.style?.size as [number, number] | undefined;

      return {
        id: node.id,
        width: size?.[0] ?? NODE_WIDTH,
        height: size?.[1] ?? NODE_HEIGHT,
      };
    });

    const elkEdges: ElkExtendedEdge[] = edges.map((edge, i) => ({
      id: String(edge.id ?? `elk-radial-edge-${i}`),
      sources: [String(edge.source)],
      targets: [String(edge.target)],
    }));

    const result = await ELKLayout.getElk().layout({
      id: 'root',
      layoutOptions: ELK_KG_RADIAL_LAYOUT_OPTIONS,
      children: elkNodes,
      edges: elkEdges,
    });

    const elkRawPos = new Map(
      (result.children ?? []).map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])
    );
    const elkFocusPos = elkRawPos.get(focusId) ?? { x: 0, y: 0 };

    const finalPositions = new Map<string, { x: number; y: number }>();
    finalPositions.set(focusId, { x: cx, y: cy });

    for (const [id, elkPos] of elkRawPos) {
      if (id === focusId) {
        continue;
      }
      const dx = elkPos.x - elkFocusPos.x;
      const dy = elkPos.y - elkFocusPos.y;
      const angle = Math.atan2(dy, dx);
      const depth = bfsDepth.get(id) ?? 1;
      const radius = ringRadii.get(depth) ?? MIN_FIRST_RING_RADIUS;
      finalPositions.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }

    return finalPositions;
  } catch {
    // Fallback: uniform angular distribution with our adaptive radii.
    const fallback = new Map<string, { x: number; y: number }>();
    fallback.set(focusId, { x: cx, y: cy });

    byDepth.forEach((nodeIds, d) => {
      if (d === 0) {
        return;
      }
      const radius = ringRadii.get(d) ?? MIN_FIRST_RING_RADIUS;
      nodeIds.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / nodeIds.length - Math.PI / 2;
        fallback.set(id, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      });
    });

    return fallback;
  }
};

export const assignRadialPorts = (
  nodes: G6NodeData[],
  edges: G6EdgeData[],
  focusNodeId: string,
  centerX: number,
  leftPort: NodePortStyleProps,
  rightPort: NodePortStyleProps
): G6NodeData[] => {
  const posMap = new Map<string, number>();
  nodes.forEach((n) => posMap.set(n.id, (n.style?.x as number) ?? centerX));

  const needsLeft = new Map<string, boolean>();
  const needsRight = new Map<string, boolean>();
  nodes.forEach((n) => {
    needsLeft.set(n.id, false);
    needsRight.set(n.id, false);
  });
  edges.forEach((edge) => {
    const srcX = posMap.get(String(edge.source)) ?? centerX;
    const tgtX = posMap.get(String(edge.target)) ?? centerX;
    if (srcX > tgtX) {
      needsLeft.set(String(edge.source), true);
      needsRight.set(String(edge.target), true);
    } else {
      needsRight.set(String(edge.source), true);
      needsLeft.set(String(edge.target), true);
    }
  });

  return nodes.map((node) => {
    if (node.id === focusNodeId) {
      return node;
    }
    const ports: NodePortStyleProps[] = [
      ...(needsLeft.get(node.id) ? [leftPort] : []),
      ...(needsRight.get(node.id) ? [rightPort] : []),
    ];

    return { ...node, style: { ...node.style, ports } };
  });
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
  fwdAdj: Map<string, Array<{ target: string; edgeId: string }>>
): { nodeIds: Set<string>; edgeIds: Set<string> } => {
  const parent = new Map<string, { nodeId: string; edgeId: string }>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  let qi = 0;
  let found = false;

  while (qi < queue.length && !found) {
    const cur = queue[qi++];
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
  fwdAdj: Map<string, Array<{ target: string; edgeId: string }>>
): { nodeIds: Set<string>; edgeIds: Set<string> } => {
  if (clickedId === originId) {
    return { nodeIds: new Set([originId]), edgeIds: new Set() };
  }

  const forward = shortestForwardPath(originId, clickedId, fwdAdj);
  const backward = shortestForwardPath(clickedId, originId, fwdAdj);

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
    const existing = edgeGroups.get(key);
    if (existing) {
      existing.push(edge);
    } else {
      edgeGroups.set(key, [edge]);
    }
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
    // Bidirectional edges anchor near source (0.35) so each direction's label
    // sits at a distinct position rather than both crowding the centre.
    // Unidirectional edges shift to 0.4 to avoid the geometrically crowded
    // midpoint of the layer-to-layer corridor.
    const labelPlacement: number = isBidirectional ? 0.35 : 0.4;

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
        stroke: '#d9d9d9',
        lineWidth: 1.5,
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
        labelPlacement,
        ...(curveOffset === undefined ? {} : { curveOffset }),
      },
    };
  });

  return { nodes, edges };
};

export const buildEdgeHighlightStyle = (primaryColor: string) => ({
  stroke: primaryColor,
  lineWidth: 2,
  opacity: 1,
  zIndex: 100,
  labelFontWeight: 500,
  labelBackgroundLineWidth: 2,
});

export const buildNodeUpdateData = (
  id: string,
  nodeMap: Map<string, G6NodeData>,
  highlighted: boolean
) => {
  const n = nodeMap.get(id);

  return {
    id,
    // Intentionally omit positional style (x, y) so drag-moved nodes stay
    // at their new position when highlight updates fire.
    style: { zIndex: highlighted ? 100 : 0 },
    data: { ...n?.data, highlighted },
  };
};

export const applyInitialFocus = async (
  graph: Graph,
  focusNodeId: string
): Promise<void> => {
  if (!focusNodeId) {
    return;
  }
  await graph.focusElement(focusNodeId);
  graph.updateNodeData([{ id: focusNodeId, data: { highlighted: true } }]);
  await graph.draw();
};

export const setupGraphEventHandlers = (ctx: GraphInteractionCtx): void => {
  const {
    graph,
    graphDataNodes,
    selectedNodeIdRef,
    setSelectedNode,
    setEdgeTooltip,
    canvasRef,
  } = ctx;
  const activeHighlightEdges = new Set<string>();
  const activeHighlightNodes = new Set<string>();
  const nodeMap = new Map(ctx.g6Nodes.map((n) => [n.id, n]));
  let hoveredEdgeId: string | null = null;
  let hoveredEndpoints: [string, string] | null = null;
  const nodeLabelMap = new Map(graphDataNodes.map((n) => [n.id, n.label]));
  const edgeMap = new Map(ctx.g6Edges.map((e) => [String(e.id), e]));

  const fwdAdj = new Map<string, Array<{ target: string; edgeId: string }>>();
  ctx.g6Nodes.forEach((n) => fwdAdj.set(n.id, []));
  ctx.g6Edges.forEach((e) => {
    if (e.id === undefined) {
      return;
    }
    fwdAdj
      .get(String(e.source))
      ?.push({ target: String(e.target), edgeId: String(e.id) });
  });

  const applyPathHighlight = (nodeId: string): void => {
    ctx.pendingHighlightRef.current = nodeId;
    const { nodeIds: pathNodes, edgeIds: pathEdges } = findHighlightPath(
      ctx.focusNodeId,
      nodeId,
      fwdAdj
    );

    const edgesToReset = [...activeHighlightEdges].filter(
      (id) => !pathEdges.has(id)
    );
    if (edgesToReset.length > 0) {
      graph.updateEdgeData(
        edgesToReset.map((id) => ({ id, style: EDGE_STYLE_RESET }))
      );
      edgesToReset.forEach((id) => activeHighlightEdges.delete(id));
    }

    const nodesToReset = [...activeHighlightNodes].filter(
      (id) => !pathNodes.has(id)
    );
    if (nodesToReset.length > 0) {
      graph.updateNodeData(
        nodesToReset.map((id) => buildNodeUpdateData(id, nodeMap, false))
      );
      nodesToReset.forEach((id) => activeHighlightNodes.delete(id));
    }

    const newPathEdges = [...pathEdges].filter(
      (id) => !activeHighlightEdges.has(id)
    );
    if (newPathEdges.length > 0) {
      const highlightStyle = buildEdgeHighlightStyle(
        ctx.brandColors?.primaryColor ?? PRIMARY_COLOR
      );
      graph.updateEdgeData(
        newPathEdges.map((id) => ({ id, style: highlightStyle }))
      );
      newPathEdges.forEach((id) => activeHighlightEdges.add(id));
    }

    const newPathNodes = [...pathNodes].filter(
      (id) => !activeHighlightNodes.has(id)
    );
    if (newPathNodes.length > 0) {
      graph.updateNodeData(
        newPathNodes.map((id) => buildNodeUpdateData(id, nodeMap, true))
      );
      newPathNodes.forEach((id) => activeHighlightNodes.add(id));
    }

    // Guard against stale async draws: if the user moved to a different node before this draw runs, skip it.
    if (ctx.pendingHighlightRef.current !== nodeId) {
      return;
    }
    void graph.draw();
  };

  const clearAllHighlights = (): void => {
    ctx.pendingHighlightRef.current = null;
    if (activeHighlightEdges.size > 0) {
      graph.updateEdgeData(
        [...activeHighlightEdges].map((id) => ({ id, style: EDGE_STYLE_RESET }))
      );
      activeHighlightEdges.clear();
    }
    if (activeHighlightNodes.size > 0) {
      graph.updateNodeData(
        [...activeHighlightNodes].map((id) =>
          buildNodeUpdateData(id, nodeMap, false)
        )
      );
      activeHighlightNodes.clear();
    }
    void graph.draw();
  };

  graph.on('node:click', (evt: IElementEvent) => {
    const nodeId = evt.target.id;
    if (!nodeId) {
      return;
    }
    const node = graphDataNodes.find((n) => n.id === nodeId);
    setSelectedNode(node ?? null);
    selectedNodeIdRef.current = nodeId;
    applyPathHighlight(nodeId);
  });

  graph.on('node:dblclick', (evt: IElementEvent) => {
    const nodeId = evt.target.id;
    if (!nodeId) {
      return;
    }
    const node = graphDataNodes.find((n) => n.id === nodeId);
    if (node?.type && node?.fullyQualifiedName) {
      window.open(
        getEntityLinkFromType(node.fullyQualifiedName, node.type as EntityType),
        '_blank',
        'noopener,noreferrer'
      );
    }
  });

  graph.on('node:pointerover', (evt: IElementEvent) => {
    const nodeId = evt.target.id;
    if (nodeId) {
      applyPathHighlight(nodeId);
    }
  });

  graph.on('node:pointerleave', (evt: IElementEvent) => {
    const nodeId = evt.target.id;
    if (!nodeId) {
      return;
    }
    const highlightTarget = selectedNodeIdRef.current;
    if (highlightTarget) {
      applyPathHighlight(highlightTarget);
    } else {
      clearAllHighlights();
    }
  });

  graph.on('edge:pointerover', (evt: IElementEvent) => {
    const edgeId = evt.target.id;
    if (!edgeId) {
      return;
    }
    const edge = edgeMap.get(edgeId);
    if (!edge) {
      return;
    }

    const srcId = String(edge.source);
    const tgtId = String(edge.target);
    const rawLabels = edge.data?.['mergedLabels'];
    const labels: string[] = Array.isArray(rawLabels)
      ? (rawLabels as string[])
      : [String(edge.data?.['label'] ?? '')];

    // Restore previous edge's visual state before applying the new one;
    // prevents permanently-highlighted edges when switching edges without a gap.
    if (hoveredEdgeId && hoveredEdgeId !== edgeId) {
      if (!activeHighlightEdges.has(hoveredEdgeId)) {
        graph.updateEdgeData([{ id: hoveredEdgeId, style: EDGE_STYLE_RESET }]);
      }
      if (hoveredEndpoints) {
        const staleNodes = hoveredEndpoints.filter(
          (id) => !activeHighlightNodes.has(id)
        );
        if (staleNodes.length > 0) {
          graph.updateNodeData(
            staleNodes.map((id) => buildNodeUpdateData(id, nodeMap, false))
          );
        }
      }
    }

    hoveredEdgeId = edgeId;
    hoveredEndpoints = [srcId, tgtId];

    graph.updateEdgeData([
      {
        id: edgeId,
        style: buildEdgeHighlightStyle(
          ctx.brandColors?.primaryColor ?? PRIMARY_COLOR
        ),
      },
    ]);
    graph.updateNodeData([
      buildNodeUpdateData(srcId, nodeMap, true),
      buildNodeUpdateData(tgtId, nodeMap, true),
    ]);
    void graph.draw();

    const canvasEl = canvasRef.current?.querySelector('canvas');
    if (canvasEl) {
      canvasEl.style.cursor = 'pointer';
    }

    setEdgeTooltip({
      x: evt.client.x,
      y: evt.client.y,
      labels,
      sourceLabel: nodeLabelMap.get(srcId) ?? srcId,
      targetLabel: nodeLabelMap.get(tgtId) ?? tgtId,
    });
  });

  graph.on('edge:pointerleave', () => {
    const canvasEl = canvasRef.current?.querySelector('canvas');
    if (canvasEl) {
      canvasEl.style.cursor = '';
    }

    setEdgeTooltip(null);

    if (hoveredEdgeId && !activeHighlightEdges.has(hoveredEdgeId)) {
      graph.updateEdgeData([{ id: hoveredEdgeId, style: EDGE_STYLE_RESET }]);
    }

    if (hoveredEndpoints) {
      const [srcId, tgtId] = hoveredEndpoints;
      const nodesToReset = [srcId, tgtId].filter(
        (id) => !activeHighlightNodes.has(id)
      );
      if (nodesToReset.length > 0) {
        graph.updateNodeData(
          nodesToReset.map((id) => buildNodeUpdateData(id, nodeMap, false))
        );
      }
    }

    hoveredEdgeId = null;
    hoveredEndpoints = null;

    void graph.draw();

    // Re-apply the selected node's path highlight because edge hover temporarily overrides it.
    const highlightTarget = selectedNodeIdRef.current;
    if (highlightTarget) {
      applyPathHighlight(highlightTarget);
    }
  });

  graph.on('edge:click', (evt: IElementEvent) => {
    const edgeId = evt.target.id;
    if (!edgeId) {
      return;
    }
    const edge = edgeMap.get(edgeId);
    if (!edge) {
      return;
    }

    const srcId = String(edge.source);
    const tgtId = String(edge.target);
    // Focus the endpoint that isn't currently selected; default to target when nothing is selected.
    const farId =
      selectedNodeIdRef.current === srcId
        ? tgtId
        : selectedNodeIdRef.current === tgtId
        ? srcId
        : tgtId;

    void graph.focusElement(farId, {
      duration: ZOOM_DURATION_MS,
      easing: ZOOM_EASING,
    });
    selectedNodeIdRef.current = farId;
  });

  graph.on('canvas:click', () => {
    setSelectedNode(null);
    selectedNodeIdRef.current = null;
    clearAllHighlights();
  });
};

export const getNodeRenderKey = (nodeData: NodeData): string => {
  const data = nodeData.data ?? {};

  return [
    toString(nodeData.id),
    toString(data.label),
    toString(data.type),
    toString(data.colorMain),
    toString(data.colorLight),
    toString(data.highlighted),
  ].join('|');
};

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
  BIDIRECTIONAL_CURVE_OFFSET,
  DIMMED_OPACITY,
  EDGE_ARROW_SIZE,
  EDGE_HIGHLIGHT_ARROW_SIZE,
  EDGE_HIGHLIGHT_LINE_WIDTH,
  EDGE_LABEL_FONT_SIZE,
  EDGE_LINE_WIDTH,
  ENTITY_TYPE_COLORS,
  LABEL_BAND_END,
  LABEL_BAND_START,
  LABEL_PLACEMENT_SOLO,
  MAX_NODE_WIDTH,
  MIN_NODE_WIDTH,
  NODE_HEIGHT,
  NODE_NEUTRAL_COLOR,
  NODE_WIDTH,
  RING_STRETCH_MAX,
  SERVICE_TYPE_COLOR,
  ZOOM_DURATION_MS,
  ZOOM_EASING,
} from '../components/KnowledgeGraph/KnowledgeGraph.constants';
import {
  ElementFocusState,
  GraphData,
  GraphInteractionCtx,
} from '../components/KnowledgeGraph/KnowledgeGraph.interface';
import {
  classifyMergedRelation,
  classifyRelation,
  getRelationStyle,
  RelationCategory,
  RELATION_CATEGORIES,
} from '../components/KnowledgeGraph/KnowledgeGraph.relations';
import { EntityType } from '../enums/entity.enum';
import { resolveCssColor } from './common/cssColor.utils';
import { getEntityLinkFromType } from './EntityLinkUtils';
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

export const normalizeEntityTypeKey = (type: string): string =>
  type.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

/**
 * Entity type → accent colours, resolved against the live theme so the graph
 * follows dark mode and custom branding. Every `*Service` type collapses onto
 * one colour; anything unrecognised gets the neutral grey rather than an
 * arbitrary hashed hue, so an unknown type reads as "unclassified" instead of
 * masquerading as a known one.
 */
export const getColorSetForType = (
  type: string
): { main: string; light: string } => {
  const key = normalizeEntityTypeKey(type);
  const palette =
    ENTITY_TYPE_COLORS[key] ??
    (key.endsWith('service') ? SERVICE_TYPE_COLOR : undefined);

  return palette
    ? {
        main: resolveCssColor(palette.token, palette.fallback),
        light: resolveCssColor(palette.bgToken, palette.bgFallback),
      }
    : {
        main: resolveCssColor(
          NODE_NEUTRAL_COLOR.token,
          NODE_NEUTRAL_COLOR.fallback
        ),
        light: resolveCssColor('var(--om-color-gray-50)', '#fafafa'),
      };
};

const ELK_KG_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'LEFT',
  'elk.spacing.nodeNode': '70',
  // A depth-1 graph is a star: every neighbour sits in one layer and fans into
  // the focus node. The gap between layers is the corridor those edges and
  // their labels have to share, so it has to be wide enough to read — at the
  // old 20px every label landed on top of its neighbours.
  'elk.layered.spacing.nodeNodeBetweenLayers': '220',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  'elk.spacing.edgeNode': '24',
  'elk.spacing.edgeEdge': '16',
  'elk.layered.spacing.edgeNodeBetweenLayers': '24',
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
    const d = depth.get(cur) ?? 0;
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

/**
 * Spreads a circular ring into an ellipse shaped like the graph pane.
 *
 * The pane is far wider than it is tall, so a circle wide enough to seat every
 * neighbour is much taller than the viewport, and `fitView` then shrinks the
 * whole graph — labels included — to make it fit. Stretching x and compressing
 * y by the same factor keeps the ring's circumference, so nodes never crowd
 * each other, while letting the graph fill the pane at a noticeably larger
 * scale.
 *
 * Compressing y is safe because the ring is sized by node *width* (~200px+)
 * while nodes are only {@link NODE_HEIGHT} tall, so the vertical clearance it
 * gives up is clearance the layout never needed.
 */
export const stretchRingToViewport = (
  positions: Map<string, { x: number; y: number }>,
  cx: number,
  cy: number
): Map<string, { x: number; y: number }> => {
  const stretch = Math.min(
    RING_STRETCH_MAX,
    Math.max(1, Math.sqrt(cy > 0 ? cx / cy : 1))
  );

  if (stretch === 1) {
    return positions;
  }

  return new Map(
    [...positions].map(([id, { x, y }]) => [
      id,
      { x: cx + (x - cx) * stretch, y: cy + (y - cy) / stretch },
    ])
  );
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

    return stretchRingToViewport(finalPositions, cx, cy);
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

    return stretchRingToViewport(fallback, cx, cy);
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

/**
 * Resting appearance of an edge: coloured and dashed by relation family, with
 * a matching arrowhead and a label pill tinted the same way. Passing
 * `showLabels: false` keeps the geometry but drops the text, which is how the
 * "Relationship labels" toggle de-clutters a dense graph.
 */
export const buildEdgeBaseStyle = (
  category: RelationCategory,
  labelText: string,
  showLabels = true
) => {
  const style = getRelationStyle(category);

  return {
    stroke: style.color,
    lineWidth: EDGE_LINE_WIDTH,
    lineDash: style.lineDash,
    opacity: 1,
    zIndex: 0,
    endArrow: true,
    endArrowSize: EDGE_ARROW_SIZE,
    endArrowFill: style.color,
    endArrowStroke: style.color,
    labelText: showLabels ? labelText : '',
    labelFontSize: EDGE_LABEL_FONT_SIZE,
    labelFontWeight: 500,
    labelFill: style.color,
    labelBackground: showLabels,
    labelBackgroundFill: style.labelBg,
    labelBackgroundOpacity: 1,
    labelBackgroundStroke: style.color,
    labelBackgroundLineWidth: 1,
    labelBackgroundRadius: 4,
    labelPadding: [3, 6],
    labelZIndex: 100,
  };
};

/**
 * Fraction along each edge at which to anchor its label.
 *
 * A depth-1 graph is a star, so most edges share the focus node and run nearly
 * parallel into it. Anchoring them all at the same fraction stacks every label
 * into one unreadable column, so edges that share an endpoint get their anchors
 * spread across the corridor instead. A lone edge keeps the old 0.4, which
 * avoids the geometrically crowded midpoint.
 */
export const computeLabelPlacements = (
  edges: Array<{ from: string; to: string }>
): number[] => {
  const seenPerEndpoint = new Map<string, number>();
  const sizePerEndpoint = new Map<string, number>();

  // Degree per endpoint, tallied in one pass. Scanning `edges` inside the
  // per-edge callback below would make this O(E²), which the depth slider can
  // reach: depth 5 returns hundreds of edges.
  const fromDegree = new Map<string, number>();
  const toDegree = new Map<string, number>();
  edges.forEach((edge) => {
    fromDegree.set(edge.from, (fromDegree.get(edge.from) ?? 0) + 1);
    toDegree.set(edge.to, (toDegree.get(edge.to) ?? 0) + 1);
  });

  // The shared endpoint is whichever one repeats; prefer the busier side so a
  // hub's spokes are the ones that get spread.
  const endpointOf = (edge: { from: string; to: string }): string =>
    (toDegree.get(edge.to) ?? 0) >= (fromDegree.get(edge.from) ?? 0)
      ? `to:${edge.to}`
      : `from:${edge.from}`;

  const endpoints = edges.map(endpointOf);
  endpoints.forEach((key) =>
    sizePerEndpoint.set(key, (sizePerEndpoint.get(key) ?? 0) + 1)
  );

  return endpoints.map((key) => {
    const size = sizePerEndpoint.get(key) ?? 1;
    const seen = seenPerEndpoint.get(key) ?? 0;
    seenPerEndpoint.set(key, seen + 1);

    return size < 2
      ? LABEL_PLACEMENT_SOLO
      : LABEL_BAND_START +
          (seen / (size - 1)) * (LABEL_BAND_END - LABEL_BAND_START);
  });
};

export const transformToG6Format = (
  data: GraphData | null,
  options: { showEdgeLabels?: boolean } = {}
): G6GraphData => {
  if (!data) {
    return { nodes: [], edges: [] };
  }

  const { showEdgeLabels = true } = options;
  const nodeTypeById = new Map(data.nodes.map((node) => [node.id, node.type]));

  const nodes: G6NodeData[] = data.nodes.map((node) => {
    const colorSet = getColorSetForType(node.type);
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
  const labelPlacements = computeLabelPlacements(mergedEdges);

  const edges: G6EdgeData[] = mergedEdges.map((edge, index) => {
    const isBidirectional = directionSet.has(`${edge.to}→${edge.from}`);
    // G6 computes curveOffset perpendicular to travel direction, so both
    // edges in a bidirectional pair share the same positive value —
    // the reversed travel direction automatically curves them to opposite
    // visual sides.
    const curveOffset: number | undefined = isBidirectional
      ? BIDIRECTIONAL_CURVE_OFFSET
      : undefined;
    const labelPlacement = labelPlacements[index];

    // The relation family — not the endpoint types — drives the edge's colour
    // and dash, so the same kind of relationship always looks the same and the
    // legend stays a valid key to the picture.
    const category = classifyMergedRelation(
      edge.mergedLabels ?? [edge.label],
      nodeTypeById.get(edge.from) ?? '',
      nodeTypeById.get(edge.to) ?? ''
    );

    return {
      id: `edge-${index}`,
      source: edge.from,
      target: edge.to,
      data: {
        label: edge.label,
        category,
        ...(edge.mergedLabels ? { mergedLabels: edge.mergedLabels } : {}),
      } as Record<string, unknown>,
      style: {
        ...buildEdgeBaseStyle(category, edge.label, showEdgeLabels),
        labelPlacement,
        ...(curveOffset === undefined ? {} : { curveOffset }),
      },
    };
  });

  return { nodes, edges };
};

/**
 * The focused appearance: same family colour so the edge stays identifiable,
 * but thicker, solid, and lifted above its neighbours.
 */
/**
 * Edge count per relation family, used to build the legend. Counts raw edges
 * rather than the merged ones the canvas draws, so the numbers match what the
 * relationship-type filter reports.
 */
export const countRelationCategories = (
  data: GraphData | null
): Record<RelationCategory, number> => {
  const counts = Object.fromEntries(
    RELATION_CATEGORIES.map((category) => [category, 0])
  ) as Record<RelationCategory, number>;

  if (data) {
    const nodeTypeById = new Map(
      data.nodes.map((node) => [node.id, node.type])
    );
    data.edges.forEach((edge) => {
      const category = classifyRelation(
        edge.label,
        nodeTypeById.get(edge.from) ?? '',
        nodeTypeById.get(edge.to) ?? ''
      );
      counts[category] += 1;
    });
  }

  return counts;
};

/**
 * The focused appearance: the relation family's colour and dash are kept so the
 * edge stays decodable against the legend, but it is thicker, fully opaque and
 * lifted above its neighbours.
 *
 * This layers over the resting style rather than patching a few properties:
 * G6 merges style updates, so an edge coming back from {@link buildEdgeDimStyle}
 * would otherwise keep that style's cleared label and never show its text again
 * — leaving the one edge the user is reading as the only unlabelled one.
 */
export const buildEdgeHighlightStyle = (
  category: RelationCategory,
  labelText: string,
  showLabels = true
) => ({
  ...buildEdgeBaseStyle(category, labelText, showLabels),
  lineWidth: EDGE_HIGHLIGHT_LINE_WIDTH,
  zIndex: 100,
  endArrowSize: EDGE_HIGHLIGHT_ARROW_SIZE,
  labelFontWeight: 700,
  labelBackgroundLineWidth: 2,
});

/** Pushes an edge into the background while another path holds focus. */
export const buildEdgeDimStyle = (category: RelationCategory) => ({
  ...buildEdgeBaseStyle(
    category,
    '',
    // A dimmed label is unreadable at 18% and only adds noise, so drop the text
    // entirely rather than fading it.
    false
  ),
  opacity: DIMMED_OPACITY,
});

export const buildNodeUpdateData = (
  id: string,
  nodeMap: Map<string, G6NodeData>,
  highlighted: boolean,
  dimmed = false
) => {
  const n = nodeMap.get(id);

  return {
    id,
    // Intentionally omit positional style (x, y) so drag-moved nodes stay
    // at their new position when highlight updates fire.
    style: { zIndex: highlighted ? 100 : 0 },
    // `dimmed` travels in data rather than style because the node body is a
    // React overlay, not a canvas shape — CustomNode turns it into a class.
    data: { ...n?.data, highlighted, dimmed },
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
  const nodeMap = new Map(ctx.g6Nodes.map((n) => [n.id, n]));
  const nodeLabelMap = new Map(graphDataNodes.map((n) => [n.id, n.label]));
  const edgeMap = new Map(ctx.g6Edges.map((e) => [String(e.id), e]));
  const allEdgeIds = [...edgeMap.keys()];
  const allNodeIds = ctx.g6Nodes.map((n) => n.id);

  // Every element starts at rest; the maps then track only what focus mode
  // has changed, so repaints stay proportional to the delta.
  const edgeStates = new Map<string, ElementFocusState>(
    allEdgeIds.map((id) => [id, 'base'] as const)
  );
  const nodeStates = new Map<string, ElementFocusState>(
    allNodeIds.map((id) => [id, 'base'] as const)
  );

  const edgeCategoryOf = (edgeId: string): RelationCategory =>
    (edgeMap.get(edgeId)?.data?.['category'] as RelationCategory) ??
    'structure';

  const edgeLabelOf = (edgeId: string): string =>
    String(edgeMap.get(edgeId)?.data?.['label'] ?? '');

  const edgeStyleFor = (
    edgeId: string,
    state: ElementFocusState
  ): Record<string, unknown> => {
    const category = edgeCategoryOf(edgeId);
    let style: Record<string, unknown>;
    if (state === 'focus') {
      style = buildEdgeHighlightStyle(
        category,
        edgeLabelOf(edgeId),
        ctx.showEdgeLabels
      );
    } else if (state === 'dim') {
      style = buildEdgeDimStyle(category);
    } else {
      style = buildEdgeBaseStyle(
        category,
        edgeLabelOf(edgeId),
        ctx.showEdgeLabels
      );
    }

    return style;
  };

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

  /**
   * Repaints only the elements whose visual state actually changed. Without
   * this bookkeeping a focus pass would push an update for every node and edge
   * on every pointer move.
   */
  const applyStates = (
    nextEdgeStates: Map<string, ElementFocusState>,
    nextNodeStates: Map<string, ElementFocusState>
  ): void => {
    const edgeUpdates: Array<{ id: string; style: Record<string, unknown> }> =
      [];
    nextEdgeStates.forEach((state, id) => {
      if (edgeStates.get(id) !== state) {
        edgeUpdates.push({ id, style: edgeStyleFor(id, state) });
        edgeStates.set(id, state);
      }
    });

    const nodeUpdates: ReturnType<typeof buildNodeUpdateData>[] = [];
    nextNodeStates.forEach((state, id) => {
      if (nodeStates.get(id) !== state) {
        nodeUpdates.push(
          buildNodeUpdateData(id, nodeMap, state === 'focus', state === 'dim')
        );
        nodeStates.set(id, state);
      }
    });

    if (edgeUpdates.length > 0) {
      graph.updateEdgeData(edgeUpdates);
    }
    if (nodeUpdates.length > 0) {
      graph.updateNodeData(nodeUpdates);
    }
  };

  /**
   * Focus mode: the path between the entity in focus and `nodeId` is drawn at
   * full strength and everything else recedes, so a single relationship chain
   * is readable even in a crowded graph.
   */
  const applyPathHighlight = (nodeId: string): void => {
    ctx.pendingHighlightRef.current = nodeId;
    const { nodeIds: pathNodes, edgeIds: pathEdges } = findHighlightPath(
      ctx.focusNodeId,
      nodeId,
      fwdAdj
    );

    // A node with no directed path to the entity in focus yields an empty path,
    // which would dim the whole graph — including the node under the cursor.
    // Keeping the hovered node lit means hovering always reads as "this one".
    const focusNodes = new Set(pathNodes).add(nodeId);

    const nextEdgeStates = new Map<string, ElementFocusState>();
    allEdgeIds.forEach((id) =>
      nextEdgeStates.set(id, pathEdges.has(id) ? 'focus' : 'dim')
    );

    const nextNodeStates = new Map<string, ElementFocusState>();
    allNodeIds.forEach((id) =>
      nextNodeStates.set(id, focusNodes.has(id) ? 'focus' : 'dim')
    );

    applyStates(nextEdgeStates, nextNodeStates);

    // Guard against stale async draws: if the user moved to a different node before this draw runs, skip it.
    if (ctx.pendingHighlightRef.current !== nodeId) {
      return;
    }
    void graph.draw();
  };

  const clearAllHighlights = (): void => {
    ctx.pendingHighlightRef.current = null;
    const nextEdgeStates = new Map<string, ElementFocusState>();
    allEdgeIds.forEach((id) => nextEdgeStates.set(id, 'base'));
    const nextNodeStates = new Map<string, ElementFocusState>();
    allNodeIds.forEach((id) => nextNodeStates.set(id, 'base'));

    applyStates(nextEdgeStates, nextNodeStates);
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
    const labels: string[] = (
      Array.isArray(rawLabels)
        ? (rawLabels as string[])
        : [String(edge.data?.['label'] ?? '')]
    ).filter((s) => s.length > 0);

    // Isolate the hovered relationship: it and its two endpoints stay at full
    // strength, the rest of the graph recedes. Because `applyStates` diffs
    // against the last applied state, moving between adjacent edges cannot
    // leave a previously hovered edge stuck in the highlighted style.
    const nextEdgeStates = new Map<string, ElementFocusState>();
    allEdgeIds.forEach((id) =>
      nextEdgeStates.set(id, id === edgeId ? 'focus' : 'dim')
    );
    const nextNodeStates = new Map<string, ElementFocusState>();
    allNodeIds.forEach((id) =>
      nextNodeStates.set(id, id === srcId || id === tgtId ? 'focus' : 'dim')
    );
    applyStates(nextEdgeStates, nextNodeStates);
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
      edgeId,
    });
  });

  graph.on('edge:pointerleave', () => {
    const canvasEl = canvasRef.current?.querySelector('canvas');
    if (canvasEl) {
      canvasEl.style.cursor = '';
    }

    setEdgeTooltip(null);

    // Edge hover temporarily overrides the selection, so fall back to the
    // selected node's path rather than to the resting graph.
    const highlightTarget = selectedNodeIdRef.current;
    if (highlightTarget) {
      applyPathHighlight(highlightTarget);
    } else {
      clearAllHighlights();
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
    toString(data.dimmed),
  ].join('|');
};

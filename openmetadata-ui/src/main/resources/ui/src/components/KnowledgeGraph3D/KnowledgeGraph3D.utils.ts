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
  ALWAYS_VISIBLE_LABEL_LIMIT,
  DENSE_GRAPH_DEPTH_SCALE,
  DENSE_GRAPH_NODE_THRESHOLD,
  LABEL_RENDER_LIMIT,
  MAX_HORIZONTAL_LAYOUT_SCALE,
  PRIORITY_LABEL_LIMIT,
  TARGET_LAYOUT_VIEWPORT_RATIO,
} from './KnowledgeGraph3D.constants';
import { Graph3DData, GraphLink3D, GraphNode3D, Lens, Level } from './types';

export const idOf = (endpoint: string | GraphNode3D): string =>
  typeof endpoint === 'object' ? endpoint.id : endpoint;

const linkMatchesLens = (link: GraphLink3D, lens: Lens): boolean =>
  lens === 'all' || link.kind === lens;

/**
 * Derives the nodes/links visible for the current level + relationship lens.
 * In a focused lens (not "all") nodes with no visible link are pruned so the
 * scene shows only what is in context. Ported from the reference `view()`.
 */
export const viewGraph = (
  graph: Graph3DData,
  level: Level,
  lens: Lens
): Graph3DData => {
  const nodes = graph.nodes.filter((node) => node.levels.includes(level));
  const ids = new Set(nodes.map((node) => node.id));
  const links = graph.links.filter(
    (link) =>
      link.levels.includes(level) &&
      ids.has(idOf(link.source)) &&
      ids.has(idOf(link.target)) &&
      linkMatchesLens(link, lens)
  );

  let visibleNodes = nodes;
  if (lens !== 'all') {
    const live = new Set<string>();
    links.forEach((link) => {
      live.add(idOf(link.source));
      live.add(idOf(link.target));
    });
    visibleNodes = nodes.filter((node) => live.has(node.id));
  }

  // Return the original node/link object references (filtered, not cloned) so
  // react-force-graph keeps each node's identity — and therefore its settled
  // x/y/z position — across level/lens toggles. Spread-cloning gave every node
  // a new identity, forcing the whole simulation to reheat to full alpha and
  // every three.js node object to be rebuilt on what is only a re-filter.
  return { nodes: visibleNodes, links };
};

export interface HighlightSet {
  nodes: Set<string>;
  links: Set<GraphLink3D>;
}

/**
 * Builds the highlight set for a selected node: the node, its direct
 * neighbors, and the incident links from the currently visible graph.
 */
export const computeHighlight = (
  links: GraphLink3D[],
  nodeId: string
): HighlightSet => {
  const nodes = new Set<string>([nodeId]);
  const incident = new Set<GraphLink3D>();
  links.forEach((link) => {
    const source = idOf(link.source);
    const target = idOf(link.target);
    if (source === nodeId || target === nodeId) {
      incident.add(link);
      nodes.add(source);
      nodes.add(target);
    }
  });

  return { nodes, links: incident };
};

/**
 * Stable identity for a link (source/target may be ids or, after the force
 * simulation runs, node objects). Used to track the selected edge.
 */
export const linkKey = (link: GraphLink3D): string =>
  `${idOf(link.source)}|${idOf(link.target)}|${link.label}`;

/** Highlight set for a selected edge: the edge plus its two endpoints. */
export const computeLinkHighlight = (
  links: GraphLink3D[],
  key: string
): HighlightSet => {
  const nodes = new Set<string>();
  const incident = new Set<GraphLink3D>();
  links.forEach((link) => {
    if (linkKey(link) === key) {
      incident.add(link);
      nodes.add(idOf(link.source));
      nodes.add(idOf(link.target));
    }
  });

  return { nodes, links: incident };
};

const degreesOf = (graph: Graph3DData): Map<string, number> => {
  const degrees = new Map<string, number>();
  graph.nodes.forEach((node) => degrees.set(node.id, 0));
  graph.links.forEach((link) => {
    const source = idOf(link.source);
    const target = idOf(link.target);
    degrees.set(source, (degrees.get(source) ?? 0) + 1);
    degrees.set(target, (degrees.get(target) ?? 0) + 1);
  });

  return degrees;
};

/**
 * Keeps dense-graph labels useful without painting every name at once. The
 * focus and selection labels win first, followed by selected neighbors and
 * then the most connected nodes. Hover labels are handled imperatively by the
 * scene so pointer movement does not repeat this ranking work.
 */
export const getVisibleLabelIds = (
  graph: Graph3DData,
  focusNodeId: string | undefined,
  selectedNodeId: string | null
): Set<string> => {
  if (graph.nodes.length > LABEL_RENDER_LIMIT) {
    return new Set();
  }

  if (graph.nodes.length <= ALWAYS_VISIBLE_LABEL_LIMIT) {
    return new Set(graph.nodes.map((node) => node.id));
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const visible = new Set<string>();
  const addVisible = (nodeId: string | null | undefined): void => {
    if (nodeId && nodeIds.has(nodeId)) {
      visible.add(nodeId);
    }
  };

  addVisible(selectedNodeId);
  addVisible(focusNodeId);

  const degrees = degreesOf(graph);
  const selectedNeighborhood = selectedNodeId
    ? computeHighlight(graph.links, selectedNodeId).nodes
    : new Set<string>();
  const ranked = [...graph.nodes].sort((left, right) => {
    const neighborhoodRank =
      Number(selectedNeighborhood.has(right.id)) -
      Number(selectedNeighborhood.has(left.id));
    if (neighborhoodRank !== 0) {
      return neighborhoodRank;
    }

    const degreeRank =
      (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0);

    return degreeRank || left.name.localeCompare(right.name);
  });

  for (const node of ranked) {
    if (visible.size >= PRIORITY_LABEL_LIMIT) {
      break;
    }
    visible.add(node.id);
  }

  return visible;
};

const isFiniteCoordinate = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Force layouts naturally settle into a roughly spherical footprint. Stretch
 * dense graphs toward the stage aspect ratio and flatten some depth so a wide
 * viewport is used for separation instead of empty gutters.
 */
export const expandGraphLayout = (
  nodes: GraphNode3D[],
  viewportWidth: number,
  viewportHeight: number
): number => {
  if (
    nodes.length < DENSE_GRAPH_NODE_THRESHOLD ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return 1;
  }

  const xCoordinates = nodes.map((node) => node.x).filter(isFiniteCoordinate);
  const yCoordinates = nodes.map((node) => node.y).filter(isFiniteCoordinate);
  if (xCoordinates.length < 2 || yCoordinates.length < 2) {
    return 1;
  }

  const minX = Math.min(...xCoordinates);
  const maxX = Math.max(...xCoordinates);
  const minY = Math.min(...yCoordinates);
  const maxY = Math.max(...yCoordinates);
  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  if (graphWidth <= 0 || graphHeight <= 0) {
    return 1;
  }

  const viewportAspect = viewportWidth / viewportHeight;
  const targetAspect = Math.max(
    1,
    viewportAspect * TARGET_LAYOUT_VIEWPORT_RATIO
  );
  const horizontalScale = Math.min(
    MAX_HORIZONTAL_LAYOUT_SCALE,
    Math.max(1, targetAspect / (graphWidth / graphHeight))
  );
  const centerX = (minX + maxX) / 2;
  const zCoordinates = nodes.map((node) => node.z).filter(isFiniteCoordinate);
  const centerZ = zCoordinates.length
    ? (Math.min(...zCoordinates) + Math.max(...zCoordinates)) / 2
    : 0;

  nodes.forEach((node) => {
    if (isFiniteCoordinate(node.x)) {
      node.x = centerX + (node.x - centerX) * horizontalScale;
    }
    if (isFiniteCoordinate(node.z)) {
      node.z = centerZ + (node.z - centerZ) * DENSE_GRAPH_DEPTH_SCALE;
    }
  });

  return horizontalScale;
};

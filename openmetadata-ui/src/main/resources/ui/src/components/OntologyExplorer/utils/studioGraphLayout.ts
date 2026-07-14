/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { DagreLayout, EdgeData, NodeData } from '@antv/g6';
import { NODE_HEIGHT } from './graphConfig';

const STUDIO_NODE_WIDTH = 150;
const STUDIO_RANK_GAP = 70;
const STUDIO_NODE_GAP = 70;
const STUDIO_OFFSET_X = 110;
const STUDIO_OFFSET_Y = 60;
const STUDIO_COMPONENT_GAP_X = 120;
const STUDIO_COMPONENT_GAP_Y = 100;
const STUDIO_ISOLATED_ROW_GAP = 90;
const STUDIO_ISOLATED_COLUMN_GAP = 220;
const STUDIO_MAX_ISOLATED_COLUMNS = 4;
const STUDIO_DEFAULT_VIEWPORT_WIDTH = 1600;

const BUILT_IN_HIERARCHICAL_RELATIONS = new Set([
  'broader',
  'childof',
  'componentof',
  'composedof',
  'haspart',
  'hastypes',
  'instanceof',
  'isa',
  'narrower',
  'parentof',
  'partof',
  'subclassof',
  'typeof',
]);

const REVERSE_HIERARCHICAL_RELATIONS = new Set([
  'broader',
  'childof',
  'componentof',
  'instanceof',
  'isa',
  'partof',
  'subclassof',
  'typeof',
]);

export interface StudioNodePosition {
  x: number;
  y: number;
}

export interface StudioGraphLayoutOptions {
  hierarchicalRelationTypes?: ReadonlySet<string>;
  viewportWidth?: number;
}

type StudioNodePositions = Record<string, StudioNodePosition>;

interface StudioLayoutEdge {
  id: string;
  relationType: string;
  source: string;
  target: string;
}

interface ComponentLayout {
  height: number;
  minX: number;
  minY: number;
  positions: StudioNodePositions;
  width: number;
}

function normalizeRelationType(relationType: string): string {
  return relationType.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function getNodeSortKey(node: NodeData): string {
  const label = (node.data as { label?: unknown } | undefined)?.label;

  return `${typeof label === 'string' ? label : ''}\u0000${String(node.id)}`;
}

function sortNodes(nodes: NodeData[]): NodeData[] {
  return [...nodes].sort((left, right) =>
    getNodeSortKey(left).localeCompare(getNodeSortKey(right))
  );
}

function getValidEdges(
  edges: EdgeData[],
  nodeIds: Set<string>,
  nodeSortKeys: Map<string, string>
): StudioLayoutEdge[] {
  return edges
    .map((edge, index) => {
      const data = edge.data as { relationType?: unknown } | undefined;

      return {
        id: String(edge.id ?? `studio-edge-${index}`),
        relationType:
          typeof data?.relationType === 'string' ? data.relationType : '',
        source: String(edge.source ?? ''),
        target: String(edge.target ?? ''),
      };
    })
    .filter(
      (edge) =>
        edge.source !== edge.target &&
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target)
    )
    .sort((left, right) =>
      `${nodeSortKeys.get(left.source)}\u0000${nodeSortKeys.get(
        left.target
      )}\u0000${left.relationType}\u0000${left.id}`.localeCompare(
        `${nodeSortKeys.get(right.source)}\u0000${nodeSortKeys.get(
          right.target
        )}\u0000${right.relationType}\u0000${right.id}`
      )
    );
}

function getConnectedComponents(
  nodes: NodeData[],
  edges: StudioLayoutEdge[]
): NodeData[][] {
  const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
  const adjacency = new Map<string, Set<string>>(
    nodes.map((node) => [String(node.id), new Set<string>()])
  );
  edges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const visited = new Set<string>();
  const components: NodeData[][] = [];
  sortNodes(nodes).forEach((node) => {
    const nodeId = String(node.id);
    if (visited.has(nodeId)) {
      return;
    }
    const pending = [nodeId];
    const component: NodeData[] = [];
    visited.add(nodeId);

    while (pending.length > 0) {
      const currentId = pending.shift();
      if (!currentId) {
        continue;
      }
      const currentNode = nodeById.get(currentId);
      if (currentNode) {
        component.push(currentNode);
      }
      [...(adjacency.get(currentId) ?? [])].sort().forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          pending.push(neighborId);
        }
      });
    }
    components.push(sortNodes(component));
  });

  return components.sort(
    (left, right) =>
      right.length - left.length ||
      getNodeSortKey(left[0]).localeCompare(getNodeSortKey(right[0]))
  );
}

function createsDirectedCycle(
  adjacency: Map<string, Set<string>>,
  source: string,
  target: string
): boolean {
  const pending = [target];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    if (current === source) {
      return true;
    }
    visited.add(current);
    adjacency.get(current)?.forEach((next) => pending.push(next));
  }

  return false;
}

function buildLayoutEdges(
  componentNodeIds: Set<string>,
  allEdges: StudioLayoutEdge[],
  hierarchicalRelationTypes: Set<string>
): EdgeData[] {
  const componentEdges = allEdges.filter(
    (edge) =>
      componentNodeIds.has(edge.source) && componentNodeIds.has(edge.target)
  );
  const parent = new Map([...componentNodeIds].map((id) => [id, id]));
  const find = (id: string): string => {
    const currentParent = parent.get(id) ?? id;
    if (currentParent === id) {
      return id;
    }
    const root = find(currentParent);
    parent.set(id, root);

    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  const directedAdjacency = new Map<string, Set<string>>();
  const seenPairs = new Set<string>();
  const layoutEdges: EdgeData[] = [];

  componentEdges.forEach((edge) => {
    const relationType = normalizeRelationType(edge.relationType);
    if (!hierarchicalRelationTypes.has(relationType)) {
      return;
    }
    const reverse = REVERSE_HIERARCHICAL_RELATIONS.has(relationType);
    const source = reverse ? edge.target : edge.source;
    const target = reverse ? edge.source : edge.target;
    const pairKey = [source, target].sort().join('\u0000');
    if (
      seenPairs.has(pairKey) ||
      createsDirectedCycle(directedAdjacency, source, target)
    ) {
      return;
    }
    seenPairs.add(pairKey);
    const targets = directedAdjacency.get(source) ?? new Set<string>();
    targets.add(target);
    directedAdjacency.set(source, targets);
    union(source, target);
    layoutEdges.push({
      id: `hierarchy-${layoutEdges.length}-${edge.id}`,
      source,
      target,
    });
  });

  componentEdges.forEach((edge) => {
    if (find(edge.source) === find(edge.target)) {
      return;
    }
    union(edge.source, edge.target);
    layoutEdges.push({
      id: `connector-${layoutEdges.length}-${edge.id}`,
      source: edge.source,
      target: edge.target,
    });
  });

  return layoutEdges;
}

function positionComponentAsGrid(nodes: NodeData[]): ComponentLayout {
  const sortedNodes = sortNodes(nodes);
  const columns = Math.max(1, Math.ceil(Math.sqrt(sortedNodes.length)));
  const positions: StudioNodePositions = {};
  sortedNodes.forEach((node, index) => {
    positions[String(node.id)] = {
      x:
        STUDIO_NODE_WIDTH / 2 +
        (index % columns) * (STUDIO_NODE_WIDTH + STUDIO_COMPONENT_GAP_X),
      y:
        NODE_HEIGHT / 2 +
        Math.floor(index / columns) * (NODE_HEIGHT + STUDIO_COMPONENT_GAP_Y),
    };
  });
  const rows = Math.ceil(sortedNodes.length / columns);

  return {
    height: rows * NODE_HEIGHT + Math.max(0, rows - 1) * STUDIO_COMPONENT_GAP_Y,
    minX: 0,
    minY: 0,
    positions,
    width:
      columns * STUDIO_NODE_WIDTH +
      Math.max(0, columns - 1) * STUDIO_COMPONENT_GAP_X,
  };
}

async function layoutComponent(
  nodes: NodeData[],
  edges: StudioLayoutEdge[],
  hierarchicalRelationTypes: Set<string>
): Promise<ComponentLayout> {
  const componentNodeIds = new Set(nodes.map((node) => String(node.id)));
  const layoutEdges = buildLayoutEdges(
    componentNodeIds,
    edges,
    hierarchicalRelationTypes
  );
  const layout = new DagreLayout({
    rankdir: 'LR',
    nodesep: STUDIO_NODE_GAP,
    ranksep: STUDIO_RANK_GAP,
    nodeSize: [STUDIO_NODE_WIDTH, NODE_HEIGHT],
    directed: true,
    compound: false,
    multigraph: true,
    animation: false,
  });

  try {
    await layout.execute({
      nodes: sortNodes(nodes).map((node) => ({ id: String(node.id) })),
      edges: layoutEdges,
    });
    const positions: StudioNodePositions = {};
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    layout.forEachNode((node) => {
      positions[String(node.id)] = { x: node.x, y: node.y };
      minX = Math.min(minX, node.x - STUDIO_NODE_WIDTH / 2);
      maxX = Math.max(maxX, node.x + STUDIO_NODE_WIDTH / 2);
      minY = Math.min(minY, node.y - NODE_HEIGHT / 2);
      maxY = Math.max(maxY, node.y + NODE_HEIGHT / 2);
    });
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    ) {
      return positionComponentAsGrid(nodes);
    }

    return {
      height: maxY - minY,
      minX,
      minY,
      positions,
      width: maxX - minX,
    };
  } catch {
    return positionComponentAsGrid(nodes);
  } finally {
    layout.destroy();
  }
}

function positionIsolatedNodes(
  nodes: NodeData[],
  startY: number,
  viewportWidth: number,
  positions: StudioNodePositions
) {
  const availableColumns = Math.max(
    1,
    Math.floor(
      (viewportWidth - STUDIO_OFFSET_X * 2 + STUDIO_ISOLATED_COLUMN_GAP) /
        STUDIO_ISOLATED_COLUMN_GAP
    )
  );
  const columns = Math.min(
    STUDIO_MAX_ISOLATED_COLUMNS,
    availableColumns,
    Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  );

  sortNodes(nodes).forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions[String(node.id)] = {
      x:
        STUDIO_OFFSET_X +
        STUDIO_NODE_WIDTH / 2 +
        column * STUDIO_ISOLATED_COLUMN_GAP,
      y:
        startY +
        NODE_HEIGHT / 2 +
        row * (NODE_HEIGHT + STUDIO_ISOLATED_ROW_GAP),
    };
  });
}

export async function calculateStudioNodePositions(
  nodes: NodeData[],
  edges: EdgeData[],
  options: StudioGraphLayoutOptions = {}
): Promise<StudioNodePositions> {
  const positions: StudioNodePositions = {};
  if (nodes.length === 0) {
    return positions;
  }

  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  const nodeSortKeys = new Map(
    nodes.map((node) => [String(node.id), getNodeSortKey(node)])
  );
  const validEdges = getValidEdges(edges, nodeIds, nodeSortKeys);
  const connectedIds = new Set<string>();
  validEdges.forEach((edge) => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  });
  const connectedNodes = nodes.filter((node) =>
    connectedIds.has(String(node.id))
  );
  const isolatedNodes = nodes.filter(
    (node) => !connectedIds.has(String(node.id))
  );
  const hierarchicalRelationTypes = new Set(BUILT_IN_HIERARCHICAL_RELATIONS);
  options.hierarchicalRelationTypes?.forEach((relationType) =>
    hierarchicalRelationTypes.add(normalizeRelationType(relationType))
  );
  const viewportWidth = Math.max(
    STUDIO_NODE_WIDTH + STUDIO_OFFSET_X * 2,
    options.viewportWidth ?? STUDIO_DEFAULT_VIEWPORT_WIDTH
  );

  let cursorX = STUDIO_OFFSET_X;
  let cursorY = STUDIO_OFFSET_Y;
  let rowHeight = 0;
  let maxConnectedY = STUDIO_OFFSET_Y;
  const components = getConnectedComponents(connectedNodes, validEdges);
  for (const component of components) {
    const componentLayout = await layoutComponent(
      component,
      validEdges,
      hierarchicalRelationTypes
    );
    const maxContentX = viewportWidth - STUDIO_OFFSET_X;
    if (
      cursorX > STUDIO_OFFSET_X &&
      cursorX + componentLayout.width > maxContentX
    ) {
      cursorX = STUDIO_OFFSET_X;
      cursorY += rowHeight + STUDIO_COMPONENT_GAP_Y;
      rowHeight = 0;
    }
    Object.entries(componentLayout.positions).forEach(([nodeId, position]) => {
      positions[nodeId] = {
        x: cursorX + position.x - componentLayout.minX,
        y: cursorY + position.y - componentLayout.minY,
      };
    });
    cursorX += componentLayout.width + STUDIO_COMPONENT_GAP_X;
    rowHeight = Math.max(rowHeight, componentLayout.height);
    maxConnectedY = Math.max(maxConnectedY, cursorY + componentLayout.height);
  }

  if (isolatedNodes.length > 0) {
    const isolatedStartY =
      connectedNodes.length > 0
        ? maxConnectedY + STUDIO_ISOLATED_ROW_GAP
        : STUDIO_OFFSET_Y;
    positionIsolatedNodes(
      isolatedNodes,
      isolatedStartY,
      viewportWidth,
      positions
    );
  }

  return positions;
}

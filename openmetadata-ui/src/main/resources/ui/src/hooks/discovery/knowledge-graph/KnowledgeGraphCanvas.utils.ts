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

import type { EdgeData, Graph, NodeData } from '@antv/g6';
import { RelationCategory } from '../../../interface/discovery/knowledge-graph-relations.interface';
import {
  GraphLevelRing,
  GraphNodePresentation,
  KnowledgeGraphEdge,
  KnowledgeGraphEdgeData,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLayout,
  KnowledgeGraphNodeData,
} from '../../../interface/discovery/knowledge-graph.interface';
import {
  buildEdgeBaseStyle,
  buildEdgeDimStyle,
  buildEdgeHighlightStyle,
  buildNodeUpdateData,
  fitGraphViewport,
  getColorSetForType,
  getGraphLevelRings,
  getLaneLevelBands,
  resolveFocusNodeId,
} from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';

export type GraphSelection =
  | { kind: 'node' | 'edge'; id: string }
  | { kind: 'category'; category: RelationCategory }
  | null;

/** Typed accessor for the G6 node `data` blob — replaces `as` assertions. */
export const readNodeData = (
  node: NodeData | undefined
): KnowledgeGraphNodeData | undefined =>
  node?.data as KnowledgeGraphNodeData | undefined;

/** Typed accessor for the G6 edge `data` blob — replaces `as` assertions. */
export const readEdgeData = (
  edge: EdgeData | undefined
): KnowledgeGraphEdgeData | undefined =>
  edge?.data as KnowledgeGraphEdgeData | undefined;

export const readPresentation = (
  node: NodeData | undefined
): GraphNodePresentation | undefined => readNodeData(node)?.presentation;

export const readMembers = (
  edge: EdgeData | undefined
): KnowledgeGraphEdge[] | undefined => readEdgeData(edge)?.members;

export const readCategory = (edge: EdgeData | undefined): RelationCategory =>
  readEdgeData(edge)?.category ?? 'other';

export const nodesForRings = (data: { nodes?: NodeData[] }): NodeData[] =>
  data.nodes ?? [];

export const displayedNodeId = (
  nodes: NodeData[],
  id: string
): string | undefined =>
  nodes.find((node) => node.id === id)?.id ??
  nodes.find((node) =>
    readPresentation(node)?.members?.some((member) => member.id === id)
  )?.id;

export const displayedSelection = (
  nodes: NodeData[],
  selection: GraphSelection
): GraphSelection =>
  selection?.kind === 'node'
    ? { ...selection, id: displayedNodeId(nodes, selection.id) ?? selection.id }
    : selection;

export const matchesSelection = (
  edge: EdgeData,
  selection: NonNullable<GraphSelection>
): boolean => {
  switch (selection.kind) {
    case 'edge':
      return (
        edge.id === selection.id ||
        readMembers(edge)?.some((member) => member.id === selection.id) === true
      );
    case 'category':
      return readEdgeData(edge)?.category === selection.category;
    case 'node':
      return edge.source === selection.id || edge.target === selection.id;
  }
};

export const selectionSurvives = (
  selection: GraphSelection,
  nodes: NodeData[],
  edges: EdgeData[]
): boolean => {
  if (selection?.kind === 'node') {
    return Boolean(displayedNodeId(nodes, selection.id));
  }
  if (selection?.kind === 'edge') {
    return edges.some((edge) => matchesSelection(edge, selection));
  }

  return true;
};

export const isEdgeLabelVisible = (
  mode: KnowledgeGraphLabelMode,
  edge: EdgeData,
  context: { direct: boolean; selected: boolean; groupSelected: boolean }
): boolean => {
  if (mode === 'all') {
    return true;
  }
  if (mode === 'none') {
    return false;
  }
  if (readEdgeData(edge)?.presentationOnly && context.groupSelected) {
    return false;
  }

  return context.direct || context.selected;
};

export const edgeLabel = (edge: EdgeData): string => {
  const members = readMembers(edge);
  const label = readEdgeData(edge)?.label ?? '';

  return (
    String(label) + (members && members.length > 1 ? ' ×' + members.length : '')
  );
};

export const getContextEdgeStyle = (
  edge: EdgeData,
  nodes: Map<string, NodeData>,
  layout: KnowledgeGraphLayout,
  selected: boolean,
  lineWidth: number
): {
  strokeOpacity: number;
  endArrowFillOpacity: number;
  lineWidth: number;
} => {
  const source = readPresentation(nodes.get(edge.source));
  const target = readPresentation(nodes.get(edge.target));
  const branch = [
    source?.root,
    target?.root,
    source?.anchorId === edge.target,
    target?.anchorId === edge.source,
    source?.groupId === edge.target,
    target?.groupId === edge.source,
  ].some(Boolean);
  const context = layout === 'lanes' && !selected && !branch;

  return {
    strokeOpacity: context ? 0.3 : 1,
    endArrowFillOpacity: context ? 0.3 : 1,
    lineWidth: context ? 1 : lineWidth,
  };
};

export const getWorldRings = (
  layout: KnowledgeGraphLayout,
  nodes: NodeData[],
  focusId: string
): GraphLevelRing[] => {
  if (layout === 'radial') {
    return getGraphLevelRings(nodes, focusId);
  }
  if (layout !== 'lanes') {
    return [];
  }

  return getLaneLevelBands(nodes);
};

export const isFocusInView = (graph: Graph, entityId: string): boolean => {
  const nodes = graph.getNodeData();
  const focus = nodes.find(
    (node) => node.id === resolveFocusNodeId(nodes, entityId)
  );
  if (!focus) {
    return true;
  }
  const [x, y] = graph.getViewportByCanvas([
    Number(focus.style?.x ?? 0),
    Number(focus.style?.y ?? 0),
  ]);
  const [width, height] = graph.getSize();

  return x >= 0 && y >= 0 && x <= width && y <= height;
};

export const fitViewport = async (
  graph: Graph,
  focusId: string,
  container: HTMLDivElement | null
): Promise<void> => {
  const width = container?.clientWidth || 800;
  const height = container?.clientHeight || 600;
  // The legend can resize the pane before ResizeObserver reaches G6.
  graph.resize(width, height);
  await fitGraphViewport(graph, focusId, width, height);
};

export const configureParallelEdges = (
  graph: Graph,
  edges: EdgeData[],
  layout: KnowledgeGraphLayout
): void => {
  if (layout === 'lanes') {
    graph.setTransforms([]);

    return;
  }
  const counts = new Map<string, number>();
  const key = (edge: EdgeData) =>
    JSON.stringify([edge.source, edge.target].sort());
  edges.forEach((edge) =>
    counts.set(key(edge), (counts.get(key(edge)) ?? 0) + 1)
  );
  const parallel = edges
    .filter((edge) => (counts.get(key(edge)) ?? 0) > 1)
    .map((edge) => String(edge.id));
  graph.setTransforms(
    parallel.length
      ? [
          {
            type: 'process-parallel-edges',
            mode: 'bundle',
            distance: 32,
            edges: parallel,
          },
        ]
      : []
  );
};

export const focusPendingNode = async (
  graph: Graph,
  nodes: NodeData[],
  pending: { current: string | null },
  container: HTMLDivElement | null
): Promise<void> => {
  if (!pending.current || !nodes.some((node) => node.id === pending.current)) {
    return;
  }
  const id = pending.current;
  pending.current = null;
  await graph.focusElement(id, false);
  container
    ?.querySelector<HTMLButtonElement>(`[data-node-id="${CSS.escape(id)}"]`)
    ?.focus({ preventScroll: true });
};

export const retainSelection = async (
  graph: Graph,
  selection: GraphSelection,
  previousNodes: NodeData[],
  nodes: NodeData[],
  edges: EdgeData[],
  focusId: string,
  onSelectionChange: (selection: GraphSelection) => void
): Promise<void> => {
  if (!selectionSurvives(selection, nodes, edges)) {
    onSelectionChange(null);
    if (nodes.some((node) => node.id === focusId)) {
      await graph.focusElement(focusId, false);
    }
  } else if (selection?.kind === 'node') {
    const id = displayedNodeId(nodes, selection.id);
    if (id && id !== displayedNodeId(previousNodes, selection.id)) {
      await graph.focusElement(id, false);
    }
  }
};

interface AppearanceInputs {
  labelMode: KnowledgeGraphLabelMode;
  layout: KnowledgeGraphLayout;
  entityId: string;
  focus: GraphSelection;
}

type NodeUpdate = ReturnType<typeof buildNodeUpdateData>;

type EdgeUpdate = {
  id: string;
  style: Record<string, unknown>;
} & { [key: string]: unknown };

/**
 * Given the current G6 node/edge tables and a focus selection, compute the
 * highlight/dim/label styling for every node and edge. Extracted from the
 * hook so it is straightforward to unit-test in isolation.
 */
export const computeAppearance = (
  nodes: NodeData[],
  edges: EdgeData[],
  inputs: AppearanceInputs
): { nodeUpdates: NodeUpdate[]; edgeUpdates: EdgeUpdate[] } => {
  const { labelMode, layout, entityId } = inputs;
  const focus = displayedSelection(nodes, inputs.focus);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const rootId = resolveFocusNodeId(nodes, entityId);
  const groupSelected =
    focus?.kind === 'node' &&
    Boolean(
      readPresentation(nodes.find((node) => node.id === focus.id))?.members
    );
  if (focus) {
    edges.forEach((edge) => {
      if (matchesSelection(edge, focus)) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
        edgeIds.add(String(edge.id));
      }
    });
    if (focus.kind === 'node') {
      nodeIds.add(focus.id);
      const adjacency = new Map<string, { node: string; edge: string }[]>();
      nodes.forEach((node) => adjacency.set(node.id, []));
      edges.forEach((edge) => {
        adjacency
          .get(edge.source)
          ?.push({ node: edge.target, edge: String(edge.id) });
        adjacency
          .get(edge.target)
          ?.push({ node: edge.source, edge: String(edge.id) });
      });
      const parents = new Map<string, { node: string; edge: string }>();
      const visited = new Set([rootId]);
      const pending = [rootId];
      for (
        let index = 0;
        index < pending.length && !visited.has(focus.id);
        index++
      ) {
        const from = pending[index];
        adjacency.get(from)?.forEach(({ node, edge }) => {
          if (!visited.has(node)) {
            visited.add(node);
            parents.set(node, { node: from, edge });
            pending.push(node);
          }
        });
      }
      let cursor = focus.id;
      let parent = parents.get(cursor);
      while (parent) {
        nodeIds.add(cursor);
        nodeIds.add(parent.node);
        edgeIds.add(parent.edge);
        cursor = parent.node;
        parent = parents.get(cursor);
      }
    }
  }
  const nodeMap = new Map<string, NodeData>(
    nodes.map((node) => {
      const color = getColorSetForType(String(readNodeData(node)?.type ?? ''));

      return [
        node.id,
        {
          ...node,
          data: {
            ...node.data,
            colorMain: color.main,
            colorLight: color.light,
          },
        },
      ];
    })
  );
  const nodeUpdates = nodes.map((node) =>
    buildNodeUpdateData(
      node.id,
      nodeMap,
      nodeIds.has(node.id) || node.id === rootId,
      Boolean(focus) &&
        !groupSelected &&
        !nodeIds.has(node.id) &&
        node.id !== rootId
    )
  );
  const edgeUpdates = edges.map((edge) => {
    const category = readCategory(edge);
    const label = edgeLabel(edge);
    const direct =
      Number(readNodeData(nodeMap.get(edge.source))?.level) < 3 &&
      Number(readNodeData(nodeMap.get(edge.target))?.level) < 3;
    const show = isEdgeLabelVisible(labelMode, edge, {
      direct,
      selected: edgeIds.has(String(edge.id)),
      groupSelected,
    });
    let style = buildEdgeBaseStyle(category, label, show);
    if (edgeIds.has(String(edge.id))) {
      style = buildEdgeHighlightStyle(category, label, show);
    } else if (focus && !groupSelected) {
      style = {
        ...style,
        ...buildEdgeDimStyle(category),
        labelText: labelMode === 'all' ? label : '',
      };
    }

    return {
      id: String(edge.id),
      style: {
        ...style,
        ...getContextEdgeStyle(
          edge,
          nodeMap,
          layout,
          Boolean(focus),
          style.lineWidth
        ),
        endArrow: !readEdgeData(edge)?.derivation,
        labelAutoRotate: false,
      },
    };
  });

  return { nodeUpdates, edgeUpdates };
};

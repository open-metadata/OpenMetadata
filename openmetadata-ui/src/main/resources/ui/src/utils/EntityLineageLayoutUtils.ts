/*
 *  Copyright 2024 Collate.
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

import { graphlib, layout } from '@dagrejs/dagre';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node, ReactFlowInstance } from 'reactflow';
import { Position } from 'reactflow';
import type { ExportViewport } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import type { CustomElement } from '../components/Entity/EntityLineage/EntityLineage.interface';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  ZOOM_TRANSITION_DURATION,
  ZOOM_VALUE,
} from '../constants/Lineage.constants';
import { EntityLineageDirection } from '../enums/entity.enum';
import { useLineageStore } from '../hooks/useLineageStore';
import { getNodeHeight } from './CanvasUtils';
import { getEntityChildrenAndLabel } from './EntityLineageNodeUtils';
import ELKLayout from './Lineage/Layout/ELKUtil/ELKUtil';

interface LayoutedElements {
  node: Array<Node & { nodeHeight: number }>;
  edge: Edge[];
}

export const centerNodePosition = (
  node: Node,
  reactFlowInstance?: ReactFlowInstance,
  zoomValue?: number
) => {
  const { position, width } = node;
  reactFlowInstance?.setCenter(
    position.x + (width ?? 1) / 2,
    position.y + NODE_HEIGHT / 2,
    {
      zoom: zoomValue ?? ZOOM_VALUE,
      duration: ZOOM_TRANSITION_DURATION,
    }
  );
};

export const getLayoutedElements = (
  elements: CustomElement,
  direction = EntityLineageDirection.LEFT_RIGHT,
  isExpanded = true
): LayoutedElements => {
  const Graph = graphlib.Graph;
  const dagreGraph = new Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  const nodeSet = new Set(elements.node.map((item) => item.id));

  const nodeData = elements.node.map((el) => {
    const nodeHeight = isExpanded ? 550 : NODE_HEIGHT;

    dagreGraph.setNode(el.id, {
      width: NODE_WIDTH,
      height: nodeHeight,
    });

    return {
      ...el,
      nodeHeight,
    };
  });

  const edgesRequired = elements.edge.filter(
    (el) => nodeSet.has(el.source) && nodeSet.has(el.target)
  );
  edgesRequired.forEach((el) => dagreGraph.setEdge(el.source, el.target));

  layout(dagreGraph);

  const uNode = nodeData.map((el) => {
    const nodeWithPosition = dagreGraph.node(el.id);

    return {
      ...el,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - el.nodeHeight / 2,
      },
    };
  });

  return { node: uNode, edge: edgesRequired };
};

export const getELKLayoutedElements = async (
  nodes: Node[],
  edges: Edge[],
  columnsHavingLineage: Map<string, Set<string>> = new Map()
) => {
  const { nodeFilterState, isColumnLevelLineage, isEditMode } =
    useLineageStore.getState();
  const elkNodes: ElkNode[] = nodes.map((node) => {
    const isColumnOnlyFilterActive =
      (isColumnLevelLineage || nodeFilterState.get(node.id)) ?? false;
    const columns = isEditMode
      ? getEntityChildrenAndLabel(node.data.node).children.length
      : columnsHavingLineage.get(node.id)?.size ?? 0;

    const nodeHeight = getNodeHeight(node, isColumnOnlyFilterActive, columns);

    return {
      id: node.id,
      width: NODE_WIDTH,
      height: nodeHeight,
    };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  try {
    const layoutedGraph = await ELKLayout.layoutGraph(elkNodes, elkEdges);
    const layoutedMap = new Map(
      (layoutedGraph?.children ?? []).map((n) => [n.id, n])
    );
    const updatedNodes: Node[] = nodes.map((node) => {
      const layoutedNode = layoutedMap.get(node.id);

      return {
        ...node,
        position: { x: layoutedNode?.x ?? 0, y: layoutedNode?.y ?? 0 },
        height: layoutedNode?.height ?? node.height,
        hidden: false,
      };
    });

    return { nodes: updatedNodes, edges: edges ?? [] };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error occurred while layouting graph:', error);

    return { nodes: [], edges: [] };
  }
};

export const positionNodesUsingElk = async (
  nodes: Node[],
  edges: Edge[],
  columnsHavingLineage: Map<string, Set<string>>
) => {
  const obj = await getELKLayoutedElements(nodes, edges, columnsHavingLineage);

  return obj;
};

export const getNodesBoundsReactFlow = (nodes: Node[]) => {
  const bounds = {
    xMin: Infinity,
    yMin: Infinity,
    xMax: -Infinity,
    yMax: -Infinity,
  };

  nodes.forEach((node) => {
    const { x, y } = node.position;
    const width = node.width ?? 0;
    const height = node.height ?? 0;

    const padding = 20;

    bounds.xMin = Math.min(bounds.xMin, x - padding);
    bounds.yMin = Math.min(bounds.yMin, y - padding);
    bounds.xMax = Math.max(bounds.xMax, x + width + padding);
    bounds.yMax = Math.max(bounds.yMax, y + height + padding);
  });

  return bounds;
};

export const getViewportForBoundsReactFlow = (
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number },
  imageWidth: number,
  imageHeight: number,
  scaleFactor = 1
) => {
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;

  const padding = 20;
  const paddedWidth = width + padding * 2;
  const paddedHeight = height + padding * 2;

  const scale =
    Math.min(
      (imageWidth - padding * 2) / paddedWidth,
      (imageHeight - padding * 2) / paddedHeight
    ) * scaleFactor;

  const translateX =
    (imageWidth - paddedWidth * scale) / 2 - bounds.xMin * scale;
  const translateY =
    (imageHeight - paddedHeight * scale) / 2 - bounds.yMin * scale;

  return { x: translateX, y: translateY, zoom: scale };
};

export const getViewportForLineageExport = (
  nodes: Node[],
  documentSelector: string
): ExportViewport => {
  const exportElement = document.querySelector(documentSelector) as HTMLElement;

  const imageWidth = exportElement.scrollWidth;
  const imageHeight = exportElement.scrollHeight;

  const nodesBounds = getNodesBoundsReactFlow(nodes);

  return getViewportForBoundsReactFlow(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.9
  );
};

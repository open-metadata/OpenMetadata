/*
 *  Copyright 2022 Collate.
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

import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import { Edge, Node } from 'reactflow';
import { NODE_HEIGHT, NODE_WIDTH } from '../constants/Lineage.constants';
import { getEntityChildrenAndLabel } from './EntityLineageUtils';

const elk = new ELK();

interface LayoutConfig {
  horizontalSpacing?: number;
  verticalSpacing?: number;
}

const getNodeHeightMap = (
  nodes: Node[],
  isExpanded: boolean,
  expandAllColumns: boolean,
  columnsHavingLineage: string[]
): Map<string, number> => {
  const heightMap = new Map<string, number>();
  nodes.forEach((node) => {
    const { childrenHeight } = getEntityChildrenAndLabel(
      node.data.node,
      expandAllColumns,
      columnsHavingLineage
    );
    const nodeHeight = isExpanded ? childrenHeight + 220 : NODE_HEIGHT;
    heightMap.set(node.id, nodeHeight);
  });

  return heightMap;
};

export const getELKLayoutedElementsV1 = async (
  nodes: Node[],
  edges: Edge[] = [],
  isExpanded = true,
  expandAllColumns = false,
  columnsHavingLineage: string[] = []
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const rootNode = nodes.find((n) => n.data.isRootNode);

  if (!rootNode || nodes.length === 0) {
    return { nodes, edges };
  }

  const nodeHeightMap = getNodeHeightMap(
    nodes,
    isExpanded,
    expandAllColumns,
    columnsHavingLineage
  );

  const elkNodes: ElkNode[] = nodes.map((node) => {
    const nodeDepth = node.data?.nodeDepth;

    return {
      id: node.id,
      width: NODE_WIDTH,
      height: nodeHeightMap.get(node.id) ?? NODE_HEIGHT,
      ...(nodeDepth !== undefined && {
        layoutOptions: {
          'elk.partitioning.partition': String(nodeDepth),
        },
      }),
    };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': 40,
    'elk.layered.spacing.nodeNodeBetweenLayers': 40,
    'elk.layered.nodePlacement.strategy': 'SIMPLE',
    'elk.partitioning.activate': 'true',
  };

  try {
    const layoutedGraph = await elk.layout({
      id: 'root',
      layoutOptions,
      children: elkNodes,
      edges: elkEdges,
    });

    const rootLayoutedNode = layoutedGraph.children?.find(
      (n) => n.id === rootNode.id
    );

    if (!rootLayoutedNode) {
      return { nodes, edges };
    }

    const updatedNodes: Node[] = nodes.map((node) => {
      const layoutedNode = layoutedGraph.children?.find(
        (n) => n.id === node.id
      );

      if (!layoutedNode) {
        return {
          ...node,
          position: { x: 0, y: 0 },
          hidden: false,
        };
      }

      return {
        ...node,
        position: {
          x: layoutedNode.x ?? 0,
          y: layoutedNode.y ?? 0,
        },
        height: layoutedNode.height ?? node.height,
        hidden: false,
      };
    });

    return {
      nodes: updatedNodes,
      edges,
    };
  } catch (error) {
    return { nodes, edges };
  }
};

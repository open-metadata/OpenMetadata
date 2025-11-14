/*
 *  Copyright 2025 Collate.
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
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import { keyBy } from 'lodash';
import { Position } from 'reactflow';
import { CustomElement } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { NODE_WIDTH } from '../constants/Lineage.constants';
import { EntityLineageDirection } from '../enums/entity.enum';

const elk = new ELK();

export const getELKLayoutElements = async (
  nodes: ElkNode[],
  edges: ElkExtendedEdge[]
) => {
  const layoutNodes = await elk.layout({
    id: 'root',
    // Layout options for the elk graph https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-mrtree.html
    layoutOptions: {
      'elk.algorithm': 'mrtree',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.edgeNodeBetweenLayers': '50',
      'elk.spacing.nodeNode': '100',
      'elk.layered.nodePlacement.strategy': 'SIMPLE',
    },
    children: nodes,
    edges: edges,
  });

  return keyBy(layoutNodes.children, 'id');
};

/**
 * Convert edges to ELK format
 * @param edges - Array of edges with id, source and target
 * @returns ELK formatted edges
 */
export const getELKEdges = <
  T extends { id: string; source: string; target: string }
>(
  edges: T[]
): ElkExtendedEdge[] => {
  return edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));
};

/**
 *
 * @param elements
 * @param direction
 * @returns
 */
export const getDagreLayoutElements = (
  elements: CustomElement,
  direction = EntityLineageDirection.LEFT_RIGHT
) => {
  const Graph = graphlib.Graph;
  const dagreGraph = new Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  const nodeSet = new Set(elements.node.map((item) => item.id));

  //   const nodeData = elements.node.map((el) => {
  //     const { childrenHeight } = getEntityChildrenAndLabel(
  //       el.data.node,
  //       expandAllColumns,
  //       columnsHavingLineage
  //     );
  //     const nodeHeight = isExpanded ? childrenHeight + 220 : NODE_HEIGHT;

  //     dagreGraph.setNode(el.id, {
  //       width: NODE_WIDTH,
  //       height: nodeHeight,
  //     });

  //     return {
  //       ...el,
  //       nodeHeight,
  //       childrenHeight,
  //     };
  //   });

  const edgesRequired = elements.edge.filter(
    (el) => nodeSet.has(el.source) && nodeSet.has(el.target)
  );
  edgesRequired.forEach((el) => dagreGraph.setEdge(el.source, el.target));

  layout(dagreGraph);

  const uNode = elements.node.map((el) => {
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

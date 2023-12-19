/*
 *  Copyright 2023 Collate.
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
import dagre from 'dagre';
import { isNil, isUndefined } from 'lodash';
import {
  Edge,
  getConnectedEdges,
  getIncomers,
  getOutgoers,
  MarkerType,
  Node,
  Position,
} from 'reactflow';
import { EdgeTypeEnum } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { EdgeDetails } from '../components/Lineage/Lineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { NODE_HEIGHT, NODE_WIDTH } from '../constants/Lineage.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
} from '../enums/entity.enum';
import { EntitiesEdge } from '../generated/api/lineage/addLineage';
import { EntityReference } from '../generated/entity/type';
import { ColumnLineage, LineageDetails } from '../generated/type/entityLineage';

export const checkUpstreamDownstream = (id: string, data: EdgeDetails[]) => {
  const hasUpstream = data.some((edge: EdgeDetails) => edge.toEntity.id === id);

  const hasDownstream = data.some(
    (edge: EdgeDetails) => edge.fromEntity.id === id
  );

  return { hasUpstream, hasDownstream };
};

const removeDuplicateNodes = (nodesData: EntityReference[]) => {
  const uniqueNodesMap = new Map<string, EntityReference>();
  nodesData.forEach((node) => {
    uniqueNodesMap.set(node.fullyQualifiedName ?? '', node);
  });

  const uniqueNodesArray = Array.from(uniqueNodesMap.values());

  return uniqueNodesArray;
};

const getNodeType = (
  edgesData: EdgeDetails[],
  id: string
): EntityLineageNodeType => {
  const hasDownStreamToEntity = edgesData.find(
    (down) => down.toEntity.id === id
  );
  const hasDownStreamFromEntity = edgesData.find(
    (down) => down.fromEntity.id === id
  );
  const hasUpstreamFromEntity = edgesData.find((up) => up.fromEntity.id === id);
  const hasUpstreamToEntity = edgesData.find((up) => up.toEntity.id === id);

  if (hasDownStreamToEntity && !hasDownStreamFromEntity) {
    return EntityLineageNodeType.OUTPUT;
  }
  if (hasUpstreamFromEntity && !hasUpstreamToEntity) {
    return EntityLineageNodeType.INPUT;
  }

  return EntityLineageNodeType.DEFAULT;
};

export const createNodes = (
  nodesData: EntityReference[],
  edgesData: EdgeDetails[]
) => {
  const uniqueNodesData = removeDuplicateNodes(nodesData);

  // Create a new dagre graph
  const graph = new dagre.graphlib.Graph();

  // Set an object for the graph label
  graph.setGraph({ rankdir: EntityLineageDirection.LEFT_RIGHT });

  // Default to assigning a new object as a label for each new edge.
  graph.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  uniqueNodesData.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to the graph (if you have edge information)
  edgesData.forEach((edge) => {
    graph.setEdge(edge.fromEntity.id, edge.toEntity.id);
  });

  // Perform the layout
  dagre.layout(graph);

  // Get the layout positions
  const layoutPositions = graph.nodes().map((nodeId) => graph.node(nodeId));

  return uniqueNodesData.map((node, index) => {
    const position = layoutPositions[index];

    const type = getNodeType(edgesData, node.id);

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: type,
      className: '',
      data: {
        node,
      },
      position: {
        x: position.x,
        y: position.y,
      },
    };
  });
};

export const createEdges = (nodes: EntityReference[], edges: EdgeDetails[]) => {
  const lineageEdgesV1: Edge[] = [];

  edges.forEach((edge) => {
    const sourceType = nodes.find((n) => edge.fromEntity.id === n.id);
    const targetType = nodes.find((n) => edge.toEntity.id === n.id);

    if (isUndefined(sourceType) || isUndefined(targetType)) {
      return;
    }

    if (!isUndefined(edge.columns)) {
      edge.columns?.forEach((e) => {
        const toColumn = e.toColumn || '';
        if (toColumn && e.fromColumns && e.fromColumns.length > 0) {
          e.fromColumns.forEach((fromColumn) => {
            lineageEdgesV1.push({
              id: `column-${fromColumn}-${toColumn}-edge-${edge.fromEntity.id}-${edge.toEntity.id}`,
              source: edge.fromEntity.id,
              target: edge.toEntity.id,
              targetHandle: toColumn,
              sourceHandle: fromColumn,
              style: { strokeWidth: '2px' },
              type: 'buttonedge',
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
              data: {
                edge,
                isColumnLineage: true,
                targetHandle: toColumn,
                sourceHandle: fromColumn,
              },
            });
          });
        }
      });
    }

    lineageEdgesV1.push({
      id: `edge-${edge.fromEntity.id}-${edge.toEntity.id}`,
      source: `${edge.fromEntity.id}`,
      target: `${edge.toEntity.id}`,
      type: 'buttonedge',
      animated: !isNil(edge.pipeline),
      style: { strokeWidth: '2px' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      data: {
        edge,
        isColumnLineage: false,
      },
    });
  });

  return lineageEdgesV1;
};

export const getColumnLineageData = (
  columnsData: ColumnLineage[],
  data: Edge
) => {
  const columnsLineage = columnsData?.reduce((col, curr) => {
    if (curr.toColumn === data.data?.targetHandle) {
      const newCol = {
        ...curr,
        fromColumns:
          curr.fromColumns?.filter(
            (column) => column !== data.data?.sourceHandle
          ) ?? [],
      };
      if (newCol.fromColumns?.length) {
        return [...col, newCol];
      } else {
        return col;
      }
    }

    return [...col, curr];
  }, [] as ColumnLineage[]);

  return columnsLineage;
};

export const getLineageEdge = (
  sourceNode: SourceType,
  targetNode: SourceType
): { edge: EdgeDetails } => {
  const {
    id: sourceId,
    entityType: sourceType,
    fullyQualifiedName: sourceFqn,
  } = sourceNode;
  const {
    id: targetId,
    entityType: targetType,
    fullyQualifiedName: targetFqn,
  } = targetNode;

  return {
    edge: {
      fromEntity: {
        id: sourceId,
        type: sourceType ?? '',
        fqn: sourceFqn ?? '',
      },
      toEntity: { id: targetId, type: targetType ?? '', fqn: targetFqn ?? '' },
      sqlQuery: '',
    },
  };
};

export const getLineageEdgeForAPI = (
  sourceNode: SourceType,
  targetNode: SourceType
): { edge: EntitiesEdge } => {
  const { id: sourceId, entityType: sourceType } = sourceNode;
  const { id: targetId, entityType: targetType } = targetNode;

  return {
    edge: {
      fromEntity: { id: sourceId, type: sourceType ?? '' },
      toEntity: { id: targetId, type: targetType ?? '' },
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [],
      },
    },
  };
};

export const getLineageDetailsObject = (edge: Edge): LineageDetails => {
  const { data } = edge;

  return {
    sqlQuery: data?.edge?.sqlQuery ?? '',
    columnsLineage: data?.edge?.columns ?? [],
    description: data?.edge?.description ?? '',
    pipeline: data?.edge?.pipeline ?? undefined,
    source: data?.edge?.source ?? '',
  };
};

const checkTarget = (edgesObj: Edge[], id: string) => {
  const edges = edgesObj.filter((ed) => {
    return ed.target !== id;
  });

  return edges;
};

const checkSource = (edgesObj: Edge[], id: string) => {
  const edges = edgesObj.filter((ed) => {
    return ed.source !== id;
  });

  return edges;
};

const getOutgoersAndConnectedEdges = (
  node: Node,
  allNodes: Node[],
  allEdges: Edge[],
  currentNodeID: string
) => {
  const outgoers = getOutgoers(node, allNodes, allEdges);
  const connectedEdges = checkTarget(
    getConnectedEdges([node], allEdges),
    currentNodeID
  );

  return { outgoers, connectedEdges };
};

const getIncomersAndConnectedEdges = (
  node: Node,
  allNodes: Node[],
  allEdges: Edge[],
  currentNodeID: string
) => {
  const outgoers = getIncomers(node, allNodes, allEdges);
  const connectedEdges = checkSource(
    getConnectedEdges([node], allEdges),
    currentNodeID
  );

  return { outgoers, connectedEdges };
};

/**
 * This function returns all downstream nodes and edges of given node.
 * The output of this method is further passed to collapse downstream nodes and edges.
 *
 * @param {Node} selectedNode - The node for which to retrieve the downstream nodes and edges.
 * @param {Node[]} nodes - All nodes in the lineage.
 * @param {Edge[]} edges - All edges in the lineage.
 * @return {{ nodes: Node[]; edges: Edge[], nodeIds: string[], edgeIds: string[] }} -
 * An object containing the downstream nodes and edges.
 */
export const getConnectedNodesEdges = (
  selectedNode: Node,
  nodes: Node[],
  edges: Edge[],
  direction: EdgeTypeEnum
): { nodes: Node[]; edges: Edge[]; nodeFqn: string[] } => {
  const visitedNodes = new Set();
  const outgoers: Node[] = [];
  const connectedEdges: Edge[] = [];
  const stack: Node[] = [selectedNode];
  const currentNodeID = selectedNode.id;

  while (stack.length > 0) {
    const currentNode = stack.pop();
    if (currentNode && !visitedNodes.has(currentNode.id)) {
      visitedNodes.add(currentNode.id);

      const { outgoers: childNodes, connectedEdges: childEdges } =
        direction === EdgeTypeEnum.DOWN_STREAM
          ? getOutgoersAndConnectedEdges(
              currentNode,
              nodes,
              edges,
              currentNodeID
            )
          : getIncomersAndConnectedEdges(
              currentNode,
              nodes,
              edges,
              currentNodeID
            );

      stack.push(...childNodes);
      outgoers.push(...childNodes);
      connectedEdges.push(...childEdges);
    }
  }

  const childNodeFqn = outgoers.map(
    (node) => node.data.node.fullyQualifiedName
  );

  return {
    nodes: outgoers,
    edges: connectedEdges,
    nodeFqn: childNodeFqn,
  };
};

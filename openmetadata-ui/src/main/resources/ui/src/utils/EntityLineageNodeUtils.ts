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

import { SearchOutlined } from '@ant-design/icons';
import { isEqual, isUndefined, omit, pick, uniqWith } from 'lodash';
import type { Edge, Node } from 'reactflow';
import {
  getConnectedEdges,
  getIncomers,
  getOutgoers,
  isNode,
  Position,
} from 'reactflow';
import { ReactComponent as DashboardIcon } from '../assets/svg/dashboard-grey.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/mlmodal.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/pipeline-grey.svg';
import { ReactComponent as TableIcon } from '../assets/svg/table-grey.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/topic-grey.svg';
import type {
  EntityChildren,
  Flatten,
} from '../components/Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import type {
  EdgeDetails,
  LineageEntityReference,
  LineageNodeType,
} from '../components/Lineage/Lineage.interface';
import type { LineagePagingInfo } from '../components/LineageTable/LineageTable.interface';
import {
  DATATYPES_HAVING_SUBFIELDS,
  NODE_HEIGHT,
  NODE_WIDTH,
} from '../constants/Lineage.constants';
import { LineagePlatformView } from '../context/LineageProvider/LineageProvider.interface';
import { EntityLineageNodeType, EntityType } from '../enums/entity.enum';
import { LineageDirection } from '../generated/api/lineage/lineageDirection';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import type { Container } from '../generated/entity/data/container';
import type { SearchIndex } from '../generated/entity/data/searchIndex';
import type { Table } from '../generated/entity/data/table';
import type { Topic } from '../generated/entity/data/topic';
import type { EntityReference } from '../generated/type/entityReference';
import { getEntityName } from './EntityNameUtils';
import { isDeleted } from './EntityStatusUtils';
import { t } from './i18next/LocalUtil';

export function getEntityChildrenAndLabel(node: LineageNodeType) {
  if (!node) {
    return {
      children: [],
      childrenHeading: '',
      childrenCount: 0,
    };
  }
  const entityMappings: Record<
    string,
    { data: EntityChildren; label: string; childrenCount: number }
  > = {
    [EntityType.TABLE]: {
      data: node.flattenChildren ?? node.columns ?? [],
      label: t('label.column-plural'),
      childrenCount: node.columns?.length ?? 0,
    },
    [EntityType.DASHBOARD]: {
      data: node.charts ?? [],
      label: t('label.chart-plural'),
      childrenCount: node.charts?.length ?? 0,
    },
    [EntityType.MLMODEL]: {
      data: node.mlFeatures ?? [],
      label: t('label.feature-plural'),
      childrenCount: node.mlFeatures?.length ?? 0,
    },
    [EntityType.DASHBOARD_DATA_MODEL]: {
      data: node.flattenChildren ?? node.columns ?? [],
      label: t('label.column-plural'),
      childrenCount: node.columns?.length ?? 0,
    },
    [EntityType.CONTAINER]: {
      data: node.flattenChildren ?? node.dataModel?.columns ?? [],
      label: t('label.column-plural'),
      childrenCount: node.dataModel?.columns?.length ?? 0,
    },
    [EntityType.TOPIC]: {
      data: node.flattenChildren ?? node.messageSchema?.schemaFields ?? [],
      label: t('label.field-plural'),
      childrenCount: node.messageSchema?.schemaFields?.length ?? 0,
    },
    [EntityType.API_ENDPOINT]: {
      data:
        node.flattenChildren ??
        node?.responseSchema?.schemaFields ??
        node?.requestSchema?.schemaFields ??
        [],
      label: t('label.field-plural'),
      childrenCount:
        node?.responseSchema?.schemaFields?.length ??
        node?.requestSchema?.schemaFields?.length ??
        0,
    },
    [EntityType.SEARCH_INDEX]: {
      data: node.flattenChildren ?? node.fields ?? [],
      label: t('label.field-plural'),
      childrenCount: node.fields?.length ?? 0,
    },
  };

  const { data, label, childrenCount } = entityMappings[
    node.entityType as EntityType
  ] || {
    data: [],
    label: '',
    childrenCount: 0,
  };

  return {
    children: data,
    childrenHeading: label,
    childrenCount,
  };
}

export const getEntityNodeIcon = (label: string) => {
  switch (label) {
    case EntityType.TABLE:
      return TableIcon;
    case EntityType.DASHBOARD:
      return DashboardIcon;
    case EntityType.TOPIC:
      return TopicIcon;
    case EntityType.PIPELINE:
      return PipelineIcon;
    case EntityType.MLMODEL:
      return MlModelIcon;
    case EntityType.SEARCH_INDEX:
      return SearchOutlined;
    default:
      return TableIcon;
  }
};

export const checkUpstreamDownstream = (id: string, data: EdgeDetails[]) => {
  const hasUpstream = data.some((edge: EdgeDetails) => edge.toEntity.id === id);

  const hasDownstream = data.some(
    (edge: EdgeDetails) => edge.fromEntity.id === id
  );

  return { hasUpstream, hasDownstream };
};

export function getUpstreamDownstreamNodesEdges(
  edges: EdgeDetails[],
  nodes: EntityReference[],
  currentNode: string
) {
  const downstreamEdges: EdgeDetails[] = [];
  const upstreamEdges: EdgeDetails[] = [];
  const downstreamNodes: EntityReference[] = [];
  const upstreamNodes: EntityReference[] = [];
  const activeNode = nodes.find(
    (node) => node.fullyQualifiedName === currentNode
  );

  if (!activeNode) {
    return { downstreamEdges, upstreamEdges, downstreamNodes, upstreamNodes };
  }

  function findDownstream(node: EntityReference) {
    const directDownstream = edges.filter(
      (edge) => edge.fromEntity.fullyQualifiedName === node.fullyQualifiedName
    );
    downstreamEdges.push(...directDownstream);
    directDownstream.forEach((edge) => {
      const toNode = nodes.find(
        (item) => item.fullyQualifiedName === edge.toEntity.fullyQualifiedName
      );
      if (!isUndefined(toNode)) {
        if (!downstreamNodes.includes(toNode)) {
          downstreamNodes.push(toNode);
          findDownstream(toNode);
        }
      }
    });
  }

  function findUpstream(node: EntityReference) {
    const directUpstream = edges.filter(
      (edge) => edge.toEntity.fullyQualifiedName === node.fullyQualifiedName
    );
    upstreamEdges.push(...directUpstream);
    directUpstream.forEach((edge) => {
      const fromNode = nodes.find(
        (item) => item.fullyQualifiedName === edge.fromEntity.fullyQualifiedName
      );
      if (!isUndefined(fromNode)) {
        if (!upstreamNodes.includes(fromNode)) {
          upstreamNodes.push(fromNode);
          findUpstream(fromNode);
        }
      }
    });
  }

  findDownstream(activeNode);
  findUpstream(activeNode);

  return { downstreamEdges, upstreamEdges, downstreamNodes, upstreamNodes };
}

const getTracedNode = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  isIncomer: boolean
) => {
  if (!isNode(node)) {
    return [];
  }

  const tracedEdgeIds = new Set<string>();

  for (const e of edges) {
    const id = isIncomer ? e.target : e.source;
    if (id === node.id) {
      const targetId = isIncomer ? e.source : e.target;

      const matches = /([\w-^]+)__([\w-]+)/.exec(targetId);
      tracedEdgeIds.add(matches ? matches[1] : targetId);
    }
  }

  return nodes.filter((n) => tracedEdgeIds.has(n.id));
};

export const getAllTracedNodes = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  prevTraced = [] as Node[],
  isIncomer: boolean
) => {
  const visitedNodeIds = new Set<string>(prevTraced.map((n) => n.id));
  const result: Node[] = [];

  const queue: Node[] = [node];

  while (queue.length > 0) {
    const currentNode = queue.shift()!;

    if (currentNode !== node) {
      result.push(currentNode);
    }

    const connectedNodes = getTracedNode(currentNode, nodes, edges, isIncomer);

    for (const connectedNode of connectedNodes) {
      if (!visitedNodeIds.has(connectedNode.id)) {
        visitedNodeIds.add(connectedNode.id);
        queue.push(connectedNode);
      }
    }
  }

  for (const nodeId of visitedNodeIds) {
    if (!prevTraced.some((n) => n.id === nodeId)) {
      const tracedNode = nodes.find((n) => n.id === nodeId);
      if (tracedNode) {
        prevTraced.push(tracedNode);
      }
    }
  }

  return result;
};

const checkTarget = (edgesObj: Edge[], id: string) => {
  return edgesObj.filter((ed) => {
    return ed.target !== id;
  });
};

const checkSource = (edgesObj: Edge[], id: string) => {
  return edgesObj.filter((ed) => {
    return ed.source !== id;
  });
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

export const getConnectedNodesEdges = (
  selectedNode: Node,
  nodes: Node[],
  edges: Edge[],
  direction: LineageDirection
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
        direction === LineageDirection.Downstream
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

      const finalNodes = childNodes.filter((node) => node.data.nodeDepth !== 0);

      stack.push(...finalNodes);
      outgoers.push(...finalNodes);
      connectedEdges.push(...childEdges);
    }
  }

  const childNodeFqn = outgoers.map(
    (node) => node.data.node.fullyQualifiedName
  );

  return {
    nodes: outgoers,
    edges: uniqWith(connectedEdges, isEqual),
    nodeFqn: childNodeFqn,
  };
};

const flattenColumn = <T extends { children?: T[]; dataType: string }>(
  column: T,
  depth: number
): Flatten<T>[] => {
  const result: Flatten<T>[] = [
    { ...omit(column, ['children']), depth } as Flatten<T>,
  ];

  if (
    DATATYPES_HAVING_SUBFIELDS.includes(column.dataType) &&
    column.children &&
    column.children.length > 0
  ) {
    for (const child of column.children) {
      result.push(...flattenColumn(child, depth + 1));
    }
  }

  return result;
};

const flatItems = <T extends { children?: T[]; dataType: string }>(
  columns: T[]
) => columns.flatMap((column) => flattenColumn(column as T, 0));

const getFlattenChildrenFromEntity = (
  entity: EntityReference
): EntityChildren => {
  const children: EntityChildren = [];

  const entityType = 'entityType' in entity ? entity.entityType : '';

  switch (entityType) {
    case EntityType.TABLE:
    case EntityType.DASHBOARD_DATA_MODEL: {
      const tableData = entity as unknown as Table;
      children.push(...flatItems(tableData.columns));

      break;
    }
    case EntityType.CONTAINER: {
      const dataModelColumns =
        (entity as unknown as Container).dataModel?.columns ?? [];
      children.push(...flatItems(dataModelColumns));

      break;
    }
    case EntityType.TOPIC: {
      const messageSchemaFields =
        (entity as unknown as Topic).messageSchema?.schemaFields ?? [];
      children.push(...flatItems(messageSchemaFields));

      break;
    }
    case EntityType.API_ENDPOINT: {
      const apiEndpointFields =
        (entity as unknown as APIEndpoint).responseSchema?.schemaFields ??
        (entity as unknown as APIEndpoint).requestSchema?.schemaFields ??
        [];
      children.push(...flatItems(apiEndpointFields));

      break;
    }
    case EntityType.SEARCH_INDEX: {
      const searchIndexFields = (entity as unknown as SearchIndex).fields ?? [];
      children.push(...flatItems(searchIndexFields));

      break;
    }
  }

  return children;
};

export const getNodeLineageData = (node: EntityReference) => {
  return {
    ...(pick(node, [
      'id',
      'type',
      'columns',
      'fullyQualifiedName',
      'name',
      'displayName',
      'upstreamLineage',
      'entityType',
      'dataModel',
      'deleted',
      'mlFeatures',
      'charts',
      'messageSchema',
      'responseSchema',
      'requestSchema',
      'fields',
      'serviceType',
      'testSuite',
      'database',
      'databaseSchema',
      'service',
      'lineageSqlQueries',
    ]) as unknown as LineageEntityReference),
    flattenChildren: getFlattenChildrenFromEntity(node),
  };
};

export const createNodes = (
  nodesData: LineageNodeType[],
  edgesData: EdgeDetails[],
  entityFqn: string,
  incomingMap: Map<string, number>,
  outgoingMap: Map<string, number>,
  isExpanded = false,
  hidden?: boolean
) => {
  const uniqueNodesMap = new Map<string, LineageNodeType>();
  nodesData.forEach((node) => {
    if (node?.fullyQualifiedName) {
      uniqueNodesMap.set(node.fullyQualifiedName, node);
    }
  });

  const uniqueNodesData = Array.from(uniqueNodesMap.values()).sort((a, b) =>
    getEntityName(a).localeCompare(getEntityName(b))
  );

  const { upstreamNodes, downstreamNodes } = getUpstreamDownstreamNodesEdges(
    edgesData ?? [],
    uniqueNodesData,
    entityFqn
  );

  const upstreamNodeIds = new Set(upstreamNodes.map((node) => node.id));
  const downstreamNodeIds = new Set(downstreamNodes.map((node) => node.id));

  return uniqueNodesData.map((node) => {
    node.deleted = isDeleted(node.deleted);

    const type =
      node.type === EntityLineageNodeType.LOAD_MORE
        ? node.type
        : incomingMap.has(node.id) && !outgoingMap.has(node.id)
        ? EntityLineageNodeType.OUTPUT
        : !incomingMap.has(node.id) && outgoingMap.has(node.id)
        ? EntityLineageNodeType.INPUT
        : EntityLineageNodeType.DEFAULT;

    const nodeHeight = isExpanded ? 550 : NODE_HEIGHT;

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type,
      className: '',
      data: {
        node,
        nodeDepth: node.nodeDepth,
        isRootNode: entityFqn === node.fullyQualifiedName,
        hasIncomers: incomingMap.has(node.id),
        hasOutgoers: outgoingMap.has(node.id),
        isUpstreamNode: upstreamNodeIds.has(node.id),
        isDownstreamNode: downstreamNodeIds.has(node.id),
      },
      width: NODE_WIDTH,
      height: nodeHeight,
      position: { x: 0, y: 0 },
      ...(hidden && { hidden }),
    };
  });
};

export const removeUnconnectedNodes = (
  edgeData: { fromId: string; toId: string },
  nodes: Node[],
  edges: Edge[]
): Node[] => {
  const targetNode = nodes?.find((n) => edgeData.toId === n.id);
  const sourceNode = nodes?.find((n) => edgeData.fromId === n.id);
  let updatedNodes = [...nodes];

  if (targetNode && sourceNode) {
    const outgoersSourceNode = getOutgoers(sourceNode, nodes, edges);
    const incomersSourceNode = getIncomers(sourceNode, nodes, edges);

    const outgoersTargetNode = getOutgoers(targetNode, nodes, edges);
    const incomersTargetNode = getIncomers(targetNode, nodes, edges);

    if (outgoersSourceNode.length + incomersSourceNode.length <= 1) {
      updatedNodes = updatedNodes.filter((n) => n.id !== sourceNode.id);
    }

    if (outgoersTargetNode.length + incomersTargetNode.length <= 1) {
      updatedNodes = updatedNodes.filter((n) => n.id !== targetNode.id);
    }
  }

  return updatedNodes;
};

export const getEntityTypeFromPlatformView = (
  platformView: LineagePlatformView
): string => {
  switch (platformView) {
    case LineagePlatformView.DataProduct:
      return EntityType.DATA_PRODUCT;
    case LineagePlatformView.Domain:
      return EntityType.DOMAIN;
    default:
      return 'service';
  }
};

export const getEntityCountAtDepth = (
  depthInfo: LineagePagingInfo['upstreamDepthInfo'] | undefined,
  depth: number
) => depthInfo?.find((info) => info.depth === depth)?.entityCount ?? 0;

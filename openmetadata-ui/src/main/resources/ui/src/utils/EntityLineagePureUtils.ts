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

import type { AxiosError } from 'axios';
import { get, isEqual, uniqueId, uniqWith } from 'lodash';
import type { EntityTags } from 'Models';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ReactFlowInstance } from 'reactflow';
import type { EdgeData } from '../components/Entity/EntityLineage/EntityLineage.interface';
import type {
  EdgeDetails,
  LineageData,
  LineageEntityReference,
  LineageNodeType,
  LineageSourceType,
} from '../components/Lineage/Lineage.interface';
import { LINEAGE_EXPORT_HEADERS } from '../constants/Lineage.constants';
import { EntityLineageNodeType, EntityType } from '../enums/entity.enum';
import type { AddLineage } from '../generated/api/lineage/addLineage';
import { LineageDirection } from '../generated/api/lineage/lineageDirection';
import { PipelineViewMode } from '../generated/configuration/lineageSettings';
import type { Pipeline } from '../generated/entity/data/pipeline';
import type {
  ColumnLineage,
  TempLineageTable,
} from '../generated/type/entityLineage';
import type { EntityReference } from '../generated/type/entityReference';
import { TagSource } from '../generated/type/tagLabel';
import { addLineage, deleteLineageEdge } from '../rest/miscAPI';
import { getNodeLineageData } from './EntityLineageNodeUtils';
import { getEntityName } from './EntityNameUtils';
import { t } from './i18next/LocalUtil';
import { jsonToCSV } from './StringUtils';
import { showErrorToast } from './ToastUtils';

export * from './EntityLineageEdgeUtils';
export * from './EntityLineageLayoutUtils';
export * from './EntityLineageNodeUtils';

export const MAX_LINEAGE_LENGTH = 20;

export const onLoad = (reactFlowInstance: ReactFlowInstance) => {
  reactFlowInstance.fitView();
};

export const onNodeContextMenu = (
  event: ReactMouseEvent,
  _node: import('reactflow').Node
) => {
  event.preventDefault();
};

export const dragHandle = (event: ReactMouseEvent) => {
  event.stopPropagation();
};

export const addLineageHandler = async (edge: AddLineage): Promise<void> => {
  try {
    await addLineage(edge);
  } catch (err) {
    showErrorToast(
      err as AxiosError,
      t('server.add-entity-error', {
        entity: t('label.lineage'),
      })
    );

    throw err;
  }
};

export const removeLineageHandler = async (data: EdgeData): Promise<void> => {
  try {
    await deleteLineageEdge(
      data.fromEntity,
      data.fromId,
      data.toEntity,
      data.toId
    );
  } catch (err) {
    showErrorToast(
      err as AxiosError,
      t('server.delete-entity-error', {
        entity: t('label.edge-lowercase'),
      })
    );

    throw err;
  }
};

export const getExportEntity = (entity: LineageSourceType) => {
  const {
    name,
    displayName = '',
    fullyQualifiedName = '',
    entityType = '',
    direction = '',
    owners,
    domains,
    tier,
    tags = [],
    depth = '',
  } = entity;

  const classificationTags = [];
  const glossaryTerms = [];

  for (const tag of tags) {
    if (tag.source === TagSource.Classification) {
      classificationTags.push(tag.tagFQN);
    } else if (tag.source === TagSource.Glossary) {
      glossaryTerms.push(tag.tagFQN);
    }
  }

  return {
    name,
    displayName,
    fullyQualifiedName,
    entityType,
    direction,
    owners: owners?.map((owner) => getEntityName(owner) ?? '').join(',') ?? '',
    domains:
      domains?.map((domain) => domain.fullyQualifiedName ?? '').join(',') ?? '',
    tags: classificationTags.join(', '),
    tier: (tier as EntityTags)?.tagFQN ?? '',
    glossaryTerms: glossaryTerms.join(', '),
    depth,
  };
};

export const getExportData = (
  allNodes: LineageSourceType[] | EntityReference[]
) => {
  const exportResultData = allNodes.map((child) =>
    getExportEntity(child as LineageSourceType)
  );

  return jsonToCSV(exportResultData, LINEAGE_EXPORT_HEADERS);
};

export const getColumnFunctionValue = (
  columns: ColumnLineage[],
  sourceFqn: string,
  targetFqn: string
) => {
  const column = columns.find(
    (col) => col.toColumn === targetFqn && col.fromColumns?.includes(sourceFqn)
  );

  return column?.function;
};

export const getLineageEntityExclusionFilter = () => {
  return {
    query: {
      bool: {
        must_not: [
          {
            term: {
              entityType: EntityType.GLOSSARY_TERM,
            },
          },
          {
            term: {
              entityType: EntityType.TAG,
            },
          },
          {
            term: {
              entityType: EntityType.DATA_PRODUCT,
            },
          },
          {
            term: {
              entityType: EntityType.KNOWLEDGE_PAGE,
            },
          },
        ],
      },
    },
  };
};

const createLoadMoreNode = (
  parentNode: LineageNodeType,
  currentCount: number,
  totalCount: number,
  direction: LineageDirection
): LineageNodeType => {
  const uniqueNodeId = uniqueId('node');
  const newNodeId = `loadmore_${uniqueNodeId}`;

  return {
    id: newNodeId,
    columns: [],
    type: EntityLineageNodeType.LOAD_MORE,
    name: `load_more_${uniqueNodeId}_${parentNode.id}`,
    displayName: 'Load More',
    fullyQualifiedName: `load_more_${uniqueNodeId}_${parentNode.id}`,
    pagination_data: {
      index: currentCount,
      parentId: parentNode.id,
      childrenLength: totalCount - currentCount,
    },
    entityType: 'load_more',
    direction,
  };
};

const createLoadMoreEdge = (
  parentNode: EntityReference,
  loadMoreNode: EntityReference,
  isDownstream: boolean
): EdgeDetails => {
  const [source, target] = isDownstream
    ? [parentNode, loadMoreNode]
    : [loadMoreNode, parentNode];

  return {
    fromEntity: {
      id: source.id,
      type: source.type,
      fullyQualifiedName: source.fullyQualifiedName ?? '',
    },
    toEntity: {
      id: target.id,
      type: target.type,
      fullyQualifiedName: target.fullyQualifiedName ?? '',
    },
  };
};

const handleNodePagination = (
  node: LineageNodeType,
  edges: Record<string, EdgeDetails>,
  isDownstream: boolean
): { newNode?: LineageNodeType; newEdge?: EdgeDetails } => {
  const { paging } = node;
  const totalCount = isDownstream
    ? paging?.entityDownstreamCount
    : paging?.entityUpstreamCount;

  if (!totalCount || totalCount <= 0) {
    return {};
  }

  const currentCount = Object.values(edges).filter((edge) =>
    isDownstream ? edge.fromEntity.id === node.id : edge.toEntity.id === node.id
  ).length;

  if (currentCount >= totalCount) {
    return {};
  }

  const loadMoreNode = createLoadMoreNode(
    node,
    currentCount,
    totalCount,
    isDownstream ? LineageDirection.Downstream : LineageDirection.Upstream
  );

  const loadMoreEdge = createLoadMoreEdge(node, loadMoreNode, isDownstream);

  return { newNode: loadMoreNode, newEdge: loadMoreEdge };
};

const processNodeArray = (
  nodes: Record<
    string,
    import('../components/Lineage/Lineage.interface').NodeData
  >,
  entityFqn: string
): LineageNodeType[] => {
  return Object.values(nodes).map(
    (node) =>
      ({
        ...getNodeLineageData(node.entity),
        paging: {
          entityUpstreamCount: node.paging?.entityUpstreamCount ?? 0,
          entityDownstreamCount: node.paging?.entityDownstreamCount ?? 0,
        },
        nodeDepth: node.nodeDepth,
        upstreamExpandPerformed:
          (node.entity as LineageEntityReference).upstreamExpandPerformed !==
          undefined
            ? (node.entity as LineageEntityReference).upstreamExpandPerformed
            : node.entity.fullyQualifiedName === entityFqn,
        downstreamExpandPerformed:
          (node.entity as LineageEntityReference).downstreamExpandPerformed !==
          undefined
            ? (node.entity as LineageEntityReference).downstreamExpandPerformed
            : node.entity.fullyQualifiedName === entityFqn,
      } as LineageNodeType)
  );
};

const processPipelineEdge = (
  edge: EdgeDetails,
  pipelineNode: Pipeline
): EdgeDetails[] => {
  const pipelineEntityType = String(get(pipelineNode, 'entityType'));
  const pipelineRef = {
    id: pipelineNode.id,
    type: pipelineEntityType,
    fullyQualifiedName: pipelineNode.fullyQualifiedName ?? '',
  };

  return [
    { fromEntity: edge.fromEntity, toEntity: pipelineRef, extraInfo: edge },
    { fromEntity: pipelineRef, toEntity: edge.toEntity, extraInfo: edge },
  ];
};

const processEdges = (
  edges: EdgeDetails[],
  nodesArray: LineageNodeType[]
): EdgeDetails[] => {
  return edges.reduce<EdgeDetails[]>(
    (acc: EdgeDetails[], edge: EdgeDetails) => {
      if (!edge.pipeline) {
        return [...acc, edge];
      }

      const pipelineNode = nodesArray.find(
        (node) => node.fullyQualifiedName === edge.pipeline?.fullyQualifiedName
      );

      if (!pipelineNode) {
        return [...acc, edge];
      }

      const pipelineEdges = processPipelineEdge(
        edge,
        pipelineNode as unknown as Pipeline
      );

      return [...acc, ...pipelineEdges];
    },
    []
  );
};

const processPagination = (
  nodesArray: LineageNodeType[],
  downstreamEdges: Record<string, EdgeDetails>,
  upstreamEdges: Record<string, EdgeDetails>
): {
  newNodes: LineageNodeType[];
  newEdges: EdgeDetails[];
} => {
  const newNodes: LineageNodeType[] = [];
  const newEdges: EdgeDetails[] = [];

  const eligibleNodes = nodesArray.filter(
    (node) =>
      ![EntityType.PIPELINE, EntityType.STORED_PROCEDURE].includes(
        get(node, 'entityType') as EntityType
      )
  );

  eligibleNodes.forEach((node) => {
    const downstream = handleNodePagination(node, downstreamEdges, true);
    if (downstream.newNode && downstream.newEdge) {
      newNodes.push(downstream.newNode);
      newEdges.push(downstream.newEdge);
    }

    const upstream = handleNodePagination(node, upstreamEdges, false);
    if (upstream.newNode && upstream.newEdge) {
      newNodes.push(upstream.newNode);
      newEdges.push(upstream.newEdge);
    }
  });

  return { newNodes, newEdges };
};

const getOrCreateTempNode = (
  nameOrFqn: string,
  existingByFqn: Map<string, LineageNodeType>,
  newTempNodes: Map<string, LineageNodeType>
): LineageNodeType => {
  const existing = existingByFqn.get(nameOrFqn);
  if (existing) {
    return existing;
  }
  if (newTempNodes.has(nameOrFqn)) {
    return newTempNodes.get(nameOrFqn) as LineageNodeType;
  }
  const tempNode: LineageNodeType = {
    id: `temp_${nameOrFqn}`,
    name: nameOrFqn,
    displayName: nameOrFqn,
    fullyQualifiedName: nameOrFqn,
    type: EntityType.TABLE,
    entityType: EntityType.TABLE,
    isTempTable: true,
    columns: [],
  };
  newTempNodes.set(nameOrFqn, tempNode);

  return tempNode;
};

const extractTempLineageNodes = (
  edges: EdgeDetails[],
  existingNodes: LineageNodeType[]
): { nodes: LineageNodeType[]; edges: EdgeDetails[] } => {
  const newTempNodes = new Map<string, LineageNodeType>();
  const newEdges: EdgeDetails[] = [];

  const existingByFqn = new Map(
    existingNodes
      .filter((n) => n.fullyQualifiedName)
      .map((n) => [n.fullyQualifiedName!, n])
  );

  edges.forEach((edge) => {
    if (!edge.tempLineageTables?.length) {
      return;
    }
    edge.tempLineageTables.forEach((hop: TempLineageTable) => {
      const fromNode = getOrCreateTempNode(
        hop.fromEntity,
        existingByFqn,
        newTempNodes
      );
      const toNode = getOrCreateTempNode(
        hop.toEntity,
        existingByFqn,
        newTempNodes
      );
      newEdges.push({
        fromEntity: {
          id: fromNode.id,
          type: fromNode.type ?? EntityType.TABLE,
          fullyQualifiedName: fromNode.fullyQualifiedName,
        },
        toEntity: {
          id: toNode.id,
          type: toNode.type ?? EntityType.TABLE,
          fullyQualifiedName: toNode.fullyQualifiedName,
        },
      });
    });
  });

  const pureNewNodes = Array.from(newTempNodes.values()).filter(
    (n) => !existingByFqn.has(n.fullyQualifiedName ?? '')
  );

  return { nodes: pureNewNodes, edges: newEdges };
};

export const parseLineageData = (
  data: LineageData,
  entityFqn: string,
  rootFqn: string,
  pipelineViewMode: PipelineViewMode = PipelineViewMode.Node
): {
  nodes: LineageNodeType[];
  edges: EdgeDetails[];
  entity: LineageNodeType;
} => {
  const { nodes, downstreamEdges, upstreamEdges } = data;

  const nodesArray = uniqWith(processNodeArray(nodes, rootFqn), isEqual);

  const processedNodes: LineageNodeType[] = [...nodesArray];

  const allEdges = [
    ...Object.values(downstreamEdges),
    ...Object.values(upstreamEdges),
  ];
  const processedEdges =
    pipelineViewMode === PipelineViewMode.Node
      ? processEdges(allEdges, nodesArray)
      : allEdges;

  const { newNodes, newEdges } = processPagination(
    nodesArray,
    downstreamEdges,
    upstreamEdges
  );

  const finalNodes = [...processedNodes, ...newNodes];
  const finalEdges = [
    ...(processedEdges as unknown as EdgeDetails[]),
    ...newEdges,
  ];

  const { nodes: tempNodes, edges: tempEdges } = extractTempLineageNodes(
    finalEdges,
    finalNodes
  );

  const entity = nodesArray.find(
    (node) => node.fullyQualifiedName === entityFqn
  ) as LineageNodeType;

  const baseEdges = tempEdges.length
    ? finalEdges.filter((e) => !e.tempLineageTables?.length)
    : finalEdges;

  return {
    nodes: [...finalNodes, ...tempNodes],
    edges: [...baseEdges, ...tempEdges],
    entity,
  };
};

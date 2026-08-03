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

import type { Connection, Edge } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import type { AddLineage } from '../../../generated/api/lineage/addLineage';
import {
  LineageBand,
  LineageLevelKind,
  type LineageScene,
  type LineageSceneEdge,
  type LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import type { LineageDetails } from '../../../generated/type/entityLineage';
import { getUpdatedColumnsFromEdge } from '../../../utils/EntityLineageEdgeUtils';
import type {
  EdgeDetails,
  EdgeFromToData,
} from '../../Lineage/Lineage.interface';

export const FIELD_SEPARATOR = '::field::';

const EDITABLE_ASSET_LEVEL_KINDS = new Set<LineageLevelKind>([
  LineageLevelKind.Table,
  LineageLevelKind.Topic,
  LineageLevelKind.Dashboard,
  LineageLevelKind.DashboardDataModel,
  LineageLevelKind.Model,
  LineageLevelKind.Pipeline,
  LineageLevelKind.StoredProcedure,
  LineageLevelKind.Container,
  LineageLevelKind.SearchIndex,
  LineageLevelKind.APIEndpoint,
  LineageLevelKind.Metric,
  LineageLevelKind.Directory,
  LineageLevelKind.File,
  LineageLevelKind.Spreadsheet,
  LineageLevelKind.Worksheet,
  LineageLevelKind.Asset,
]);

export interface LineageMapEdgeData {
  dataTestId?: string;
  edge: EdgeDetails;
  isColumnLineage: boolean;
  isRollup?: boolean;
  label?: string;
  sceneEdge?: LineageSceneEdge;
  sourceHandle?: string;
  targetHandle?: string;
  weight?: number;
}

const getSourceEntity = (node: LineageSceneNode): Record<string, unknown> =>
  (node.sourceEntity ?? {}) as Record<string, unknown>;

const getStringValue = (
  value: unknown,
  fallback?: string
): string | undefined => (typeof value === 'string' ? value : fallback);

export const getEndpointNodeId = (endpoint: string) => {
  const separatorIndex = endpoint.indexOf(FIELD_SEPARATOR);

  return separatorIndex === -1 ? endpoint : endpoint.slice(0, separatorIndex);
};

export const getEndpointHandle = (endpoint: string) => {
  const separatorIndex = endpoint.indexOf(FIELD_SEPARATOR);

  return separatorIndex === -1
    ? undefined
    : endpoint.slice(separatorIndex + FIELD_SEPARATOR.length);
};

const getConnectionHandle = (
  handle: string | null | undefined,
  nodeId: string
) => (handle && handle !== nodeId ? handle : undefined);

export const getRealEntityRef = (
  node: LineageSceneNode
): EdgeFromToData | undefined => {
  const sourceEntity = getSourceEntity(node);
  const id = getStringValue(sourceEntity.id);
  const type = getStringValue(
    sourceEntity.entityType,
    getStringValue(sourceEntity.type, node.entityType)
  );

  if (!id || !type) {
    return undefined;
  }

  return {
    id,
    type,
    fullyQualifiedName: getStringValue(
      sourceEntity.fullyQualifiedName,
      node.fullyQualifiedName
    ),
  };
};

export const hasSceneEntityConnection = (
  scene: LineageScene,
  fromEntityId: string,
  toEntityId: string,
  sourceHandle?: string,
  targetHandle?: string
) => {
  const sourceNode = scene.nodes.find(
    (node) => getRealEntityRef(node)?.id === fromEntityId
  );
  const targetNode = scene.nodes.find(
    (node) => getRealEntityRef(node)?.id === toEntityId
  );
  if (!sourceNode || !targetNode) {
    return false;
  }

  return scene.edges.some(
    (edge) =>
      getEndpointNodeId(edge.from) === sourceNode.id &&
      getEndpointNodeId(edge.to) === targetNode.id &&
      getEndpointHandle(edge.from) === sourceHandle &&
      getEndpointHandle(edge.to) === targetHandle
  );
};

export const isEditableSceneNode = (
  node?: LineageSceneNode
): node is LineageSceneNode => {
  if (
    !node ||
    node.band === LineageBand.Layer ||
    !EDITABLE_ASSET_LEVEL_KINDS.has(node.levelKind)
  ) {
    return false;
  }

  const sourceEntity = getSourceEntity(node);

  return (
    sourceEntity.lineageSceneSyntheticCount !== true &&
    Boolean(getRealEntityRef(node))
  );
};

export const isEditableSceneEdge = (
  edge: LineageSceneEdge,
  nodeById: Map<string, LineageSceneNode>
) => {
  const sourceHandle = getEndpointHandle(edge.from);
  const targetHandle = getEndpointHandle(edge.to);
  const hasValidHandlePair =
    (sourceHandle === undefined && targetHandle === undefined) ||
    (sourceHandle !== undefined && targetHandle !== undefined);

  return (
    hasValidHandlePair &&
    !edge.isRollup &&
    (edge.weight ?? 1) === 1 &&
    isEditableSceneNode(nodeById.get(getEndpointNodeId(edge.from))) &&
    isEditableSceneNode(nodeById.get(getEndpointNodeId(edge.to)))
  );
};

export const isRemovableSceneNode = (
  node: LineageSceneNode,
  edges: LineageSceneEdge[],
  nodeById: Map<string, LineageSceneNode>
) => {
  if (!isEditableSceneNode(node) || node.isOrigin || node.isFocus) {
    return false;
  }

  return edges
    .filter(
      (edge) =>
        getEndpointNodeId(edge.from) === node.id ||
        getEndpointNodeId(edge.to) === node.id
    )
    .every((edge) => isEditableSceneEdge(edge, nodeById));
};

export const toFlowEdge = (
  nodeById: Map<string, LineageSceneNode>,
  edge: LineageScene['edges'][number]
): Edge<LineageMapEdgeData> => {
  const source = getEndpointNodeId(edge.from);
  const target = getEndpointNodeId(edge.to);
  const sourceHandle = getEndpointHandle(edge.from);
  const targetHandle = getEndpointHandle(edge.to);
  const sourceNode = nodeById.get(source);
  const targetNode = nodeById.get(target);
  const fromEntity = sourceNode ? getRealEntityRef(sourceNode) : undefined;
  const toEntity = targetNode ? getRealEntityRef(targetNode) : undefined;
  const isColumnLineage = Boolean(sourceHandle && targetHandle);
  const dataTestId = isColumnLineage
    ? `column-edge-${sourceHandle}-${targetHandle}`
    : `edge-${sourceNode?.fullyQualifiedName ?? source}-${
        targetNode?.fullyQualifiedName ?? target
      }`;

  return {
    animated: Boolean(edge.pipeline),
    data: {
      dataTestId,
      edge: {
        description: edge.description,
        fromEntity: fromEntity ?? {
          id: '',
          type: sourceNode?.entityType ?? '',
          fullyQualifiedName: sourceNode?.fullyQualifiedName,
        },
        pipeline: edge.pipeline,
        pipelineEntityType:
          edge.pipeline?.type === EntityType.STORED_PROCEDURE
            ? EntityType.STORED_PROCEDURE
            : edge.pipeline
            ? EntityType.PIPELINE
            : undefined,
        source: edge.source,
        sqlQuery: edge.sqlQuery,
        toEntity: toEntity ?? {
          id: '',
          type: targetNode?.entityType ?? '',
          fullyQualifiedName: targetNode?.fullyQualifiedName,
        },
      },
      isColumnLineage,
      isRollup: edge.isRollup,
      label: edge.label,
      sceneEdge: edge,
      sourceHandle,
      targetHandle,
      weight: edge.weight,
    },
    id: edge.id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'buttonedge',
  };
};

const getPipelineSceneNode = (
  nodeById: Map<string, LineageSceneNode>,
  edge: LineageSceneEdge
) => {
  if (!edge.pipeline) {
    return undefined;
  }

  return Array.from(nodeById.values()).find((node) => {
    const entity = getRealEntityRef(node);

    return (
      node.id === edge.pipeline?.id ||
      entity?.id === edge.pipeline?.id ||
      (Boolean(edge.pipeline?.fullyQualifiedName) &&
        (node.fullyQualifiedName === edge.pipeline?.fullyQualifiedName ||
          entity?.fullyQualifiedName === edge.pipeline?.fullyQualifiedName))
    );
  });
};

export const toFlowEdges = (
  nodeById: Map<string, LineageSceneNode>,
  sceneEdges: LineageSceneEdge[],
  renderPipelinesAsNodes: boolean
): Edge<LineageMapEdgeData>[] =>
  sceneEdges.flatMap((sceneEdge) => {
    const source = getEndpointNodeId(sceneEdge.from);
    const target = getEndpointNodeId(sceneEdge.to);
    const pipelineNode = renderPipelinesAsNodes
      ? getPipelineSceneNode(nodeById, sceneEdge)
      : undefined;

    if (
      !pipelineNode ||
      getEndpointHandle(sceneEdge.from) ||
      getEndpointHandle(sceneEdge.to) ||
      pipelineNode.id === source ||
      pipelineNode.id === target
    ) {
      return [toFlowEdge(nodeById, sceneEdge)];
    }

    const toPipelineSegment = (
      id: string,
      from: string,
      to: string
    ): Edge<LineageMapEdgeData> => {
      const flowEdge = toFlowEdge(nodeById, {
        ...sceneEdge,
        id,
        from,
        to,
        pipeline: undefined,
      });

      return {
        ...flowEdge,
        data: {
          ...flowEdge.data,
          sceneEdge,
        },
      };
    };

    return [
      toPipelineSegment(
        `${sceneEdge.id}::pipeline-in`,
        source,
        pipelineNode.id
      ),
      toPipelineSegment(
        `${sceneEdge.id}::pipeline-out`,
        pipelineNode.id,
        target
      ),
    ];
  });

const toEdgeDetails = (
  fromEntity: EdgeFromToData,
  toEntity: EdgeFromToData,
  sceneEdge: LineageSceneEdge,
  details?: LineageDetails
): EdgeDetails => {
  const pipeline = details?.pipeline ?? sceneEdge.pipeline;

  return {
    fromEntity,
    toEntity,
    columns: details?.columnsLineage,
    createdAt: details?.createdAt,
    createdBy: details?.createdBy,
    description: details?.description ?? sceneEdge.description,
    pipeline,
    pipelineEntityType:
      pipeline?.type === EntityType.STORED_PROCEDURE
        ? EntityType.STORED_PROCEDURE
        : pipeline
        ? EntityType.PIPELINE
        : undefined,
    source: details?.source ? String(details.source) : sceneEdge.source,
    sqlQuery: details?.sqlQuery ?? sceneEdge.sqlQuery,
    tempLineageTables: details?.tempLineageTables,
    updatedAt: details?.updatedAt,
    updatedBy: details?.updatedBy,
  };
};

export const hydrateSelectedEdge = (
  edge: Edge<LineageMapEdgeData>,
  sceneEdge: LineageSceneEdge,
  nodeById: Map<string, LineageSceneNode>,
  details?: LineageDetails
): Edge<LineageMapEdgeData> | null => {
  const fromNode = nodeById.get(getEndpointNodeId(sceneEdge.from));
  const toNode = nodeById.get(getEndpointNodeId(sceneEdge.to));
  const fromEntity = fromNode ? getRealEntityRef(fromNode) : undefined;
  const toEntity = toNode ? getRealEntityRef(toNode) : undefined;

  if (!fromEntity || !toEntity) {
    return null;
  }

  const sourceHandle = getEndpointHandle(sceneEdge.from);
  const targetHandle = getEndpointHandle(sceneEdge.to);

  return {
    ...edge,
    animated: Boolean(details?.pipeline ?? sceneEdge.pipeline),
    data: {
      ...edge.data,
      edge: toEdgeDetails(fromEntity, toEntity, sceneEdge, details),
      isColumnLineage: Boolean(sourceHandle && targetHandle),
      sceneEdge,
      sourceHandle,
      targetHandle,
    },
    sourceHandle,
    targetHandle,
  };
};

export const buildConnectPayload = (
  connection: Connection,
  nodeById: Map<string, LineageSceneNode>,
  existingDetails?: LineageDetails
): AddLineage | null => {
  const sourceNode = connection.source
    ? nodeById.get(connection.source)
    : undefined;
  const targetNode = connection.target
    ? nodeById.get(connection.target)
    : undefined;
  const fromEntity = sourceNode ? getRealEntityRef(sourceNode) : undefined;
  const toEntity = targetNode ? getRealEntityRef(targetNode) : undefined;
  const sourceHandle = connection.source
    ? getConnectionHandle(connection.sourceHandle, connection.source)
    : undefined;
  const targetHandle = connection.target
    ? getConnectionHandle(connection.targetHandle, connection.target)
    : undefined;
  const isColumnConnection = Boolean(sourceHandle && targetHandle);

  if (
    !fromEntity ||
    !toEntity ||
    fromEntity.id === toEntity.id ||
    Boolean(sourceHandle) !== Boolean(targetHandle)
  ) {
    return null;
  }

  const currentEdge: EdgeDetails = {
    fromEntity,
    toEntity,
    columns: existingDetails?.columnsLineage,
  };
  const columnsLineage = isColumnConnection
    ? getUpdatedColumnsFromEdge(connection, currentEdge)
    : existingDetails?.columnsLineage ?? [];

  return {
    edge: {
      fromEntity: {
        id: fromEntity.id,
        type: fromEntity.type,
      },
      toEntity: {
        id: toEntity.id,
        type: toEntity.type,
      },
      lineageDetails: {
        columnsLineage,
        description: existingDetails?.description,
        pipeline: existingDetails?.pipeline,
        source: existingDetails?.source,
        sqlQuery: existingDetails?.sqlQuery ?? '',
        tempLineageTables: existingDetails?.tempLineageTables,
      },
    },
  };
};

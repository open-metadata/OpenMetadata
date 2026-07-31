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

import { isEmpty, isNil, isUndefined } from 'lodash';
import type { Connection, Edge } from 'reactflow';
import { getBezierPath, MarkerType } from 'reactflow';
import type {
  CustomEdgeData,
  EdgeData,
} from '../components/Entity/EntityLineage/EntityLineage.interface';
import type { EdgeDetails } from '../components/Lineage/Lineage.interface';
import type { SourceType } from '../components/SearchedData/SearchedData.interface';
import { EntityType, FqnPart } from '../enums/entity.enum';
import type {
  AddLineage,
  EntitiesEdge,
} from '../generated/api/lineage/addLineage';
import type {
  ColumnLineage,
  LineageDetails,
} from '../generated/type/entityLineage';
import type { EntityReference } from '../generated/type/entityReference';
import { getEntityReferenceFromEntity } from './EntityReferenceUtils';
import Fqn from './Fqn';
import { getPartialNameFromTableFQN } from './FqnUtils';
import { t } from './i18next/LocalUtil';

interface EdgeAlignmentPathDataProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: import('reactflow').Position;
  targetPosition: import('reactflow').Position;
}

export const getModalBodyText = (selectedEdge: Edge) => {
  const { data } = selectedEdge;
  const { fromEntity, toEntity } = data.edge as EdgeDetails;
  const { sourceHandle = '', targetHandle = '' } = selectedEdge;

  const { isColumnLineage } = data as CustomEdgeData;
  let sourceEntity = '';
  let targetEntity = '';

  const sourceFQN = isColumnLineage
    ? sourceHandle
    : fromEntity.fullyQualifiedName;
  const targetFQN = isColumnLineage
    ? targetHandle
    : toEntity.fullyQualifiedName;
  const fqnPart = isColumnLineage ? FqnPart.Column : FqnPart.Table;

  if (fromEntity.type === EntityType.TABLE) {
    sourceEntity = getPartialNameFromTableFQN(sourceFQN ?? '', [fqnPart]);
  } else {
    const arrFqn = Fqn.split(sourceFQN ?? '');
    sourceEntity = arrFqn[arrFqn.length - 1];
  }

  if (toEntity.type === EntityType.TABLE) {
    targetEntity = getPartialNameFromTableFQN(targetFQN ?? '', [fqnPart]);
  } else {
    const arrFqn = Fqn.split(targetFQN ?? '');
    targetEntity = arrFqn[arrFqn.length - 1];
  }

  return t('message.remove-edge-between-source-and-target', {
    sourceDisplayName: sourceEntity,
    targetDisplayName: targetEntity,
  });
};

export const getNewLineageConnectionDetails = (
  selectedEdgeValue: Edge | undefined,
  selectedPipeline: EntityReference | undefined
) => {
  const { fromEntity, toEntity, sqlQuery, columns } =
    selectedEdgeValue?.data.edge ?? {};
  const updatedLineageDetails: LineageDetails = {
    sqlQuery: sqlQuery ?? '',
    columnsLineage: columns ?? [],
    pipeline: selectedPipeline,
  };

  const newEdge: AddLineage = {
    edge: {
      fromEntity: {
        id: fromEntity.id,
        type: fromEntity.type,
      },
      toEntity: {
        id: toEntity.id,
        type: toEntity.type,
      },
      lineageDetails:
        updatedLineageDetails as AddLineage['edge']['lineageDetails'],
    },
  };

  return {
    updatedLineageDetails,
    newEdge,
  };
};

export const getClassifiedEdge = (edges: Edge[]) => {
  return edges.reduce(
    (acc, edge) => {
      if (isUndefined(edge.sourceHandle) && isUndefined(edge.targetHandle)) {
        acc.normalEdge.push(edge);
      } else {
        acc.columnEdge.push(edge);
      }

      return acc;
    },
    {
      normalEdge: [] as Edge[],
      columnEdge: [] as Edge[],
    }
  );
};

const getTracedEdge = (
  selectedColumn: string,
  edges: Edge[],
  isIncomer: boolean
) => {
  if (isEmpty(selectedColumn)) {
    return [];
  }

  const tracedEdgeIds = edges
    .filter((e) => {
      const { sourceHandle, targetHandle } = e;
      const id = isIncomer ? targetHandle : sourceHandle;

      return id === selectedColumn;
    })
    .map((e) => {
      const { sourceHandle, targetHandle } = e;

      return isIncomer ? sourceHandle ?? '' : targetHandle ?? '';
    });

  return tracedEdgeIds;
};

export const getAllTracedEdges = (
  selectedColumn: string,
  edges: Edge[],
  prevTraced = [] as string[],
  isIncomer: boolean
) => {
  const visitedEdgeIds = new Set<string>(prevTraced);
  const result: string[] = [];

  const queue: string[] = [selectedColumn];

  while (queue.length > 0) {
    const currentColumn = queue.shift()!;

    if (currentColumn !== selectedColumn) {
      result.push(currentColumn);
    }

    const connectedEdges = getTracedEdge(currentColumn, edges, isIncomer);

    for (const connectedEdge of connectedEdges) {
      if (!visitedEdgeIds.has(connectedEdge) && connectedEdge) {
        visitedEdgeIds.add(connectedEdge);
        queue.push(connectedEdge);
      }
    }
  }

  for (const edgeId of visitedEdgeIds) {
    if (!prevTraced.includes(edgeId)) {
      prevTraced.push(edgeId);
    }
  }

  return result;
};

export const getAllTracedColumnEdge = (column: string, columnEdge: Edge[]) => {
  const incomingColumnEdges = getAllTracedEdges(column, columnEdge, [], true);
  const outGoingColumnEdges = getAllTracedEdges(column, columnEdge, [], false);

  return {
    incomingColumnEdges,
    outGoingColumnEdges,
    connectedColumnEdges: new Set([
      column,
      ...incomingColumnEdges,
      ...outGoingColumnEdges,
    ]),
  };
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
        id: sourceId ?? '',
        type: sourceType ?? '',
        fullyQualifiedName: sourceFqn ?? '',
      },
      toEntity: {
        id: targetId ?? '',
        type: targetType ?? '',
        fullyQualifiedName: targetFqn ?? '',
      },
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
      fromEntity: { id: sourceId ?? '', type: sourceType ?? '' },
      toEntity: { id: targetId ?? '', type: targetType ?? '' },
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [],
      },
    },
  };
};

export const getLineageDetailsObject = (edge: Edge): LineageDetails => {
  const {
    sqlQuery = '',
    columns = [],
    description = '',
    pipeline,
    source,
    pipelineEntityType,
  } = edge.data?.edge || {};

  return {
    sqlQuery,
    columnsLineage: columns,
    description,
    pipeline: pipeline
      ? getEntityReferenceFromEntity(
          pipeline,
          pipelineEntityType ?? EntityType.PIPELINE
        )
      : undefined,
    source,
  };
};

export const getUpdatedColumnsFromEdge = (
  edgeToConnect: Edge | Connection,
  currentEdge: EdgeDetails
) => {
  const { target, source, sourceHandle, targetHandle } = edgeToConnect;
  const columnConnection = source !== sourceHandle && target !== targetHandle;

  if (columnConnection) {
    const updatedColumns: ColumnLineage[] =
      currentEdge.columns?.map((lineage) => {
        if (lineage.toColumn === targetHandle) {
          return {
            ...lineage,
            fromColumns: [...(lineage.fromColumns ?? []), sourceHandle ?? ''],
          };
        }

        return lineage;
      }) ?? [];

    if (!updatedColumns.find((lineage) => lineage.toColumn === targetHandle)) {
      updatedColumns.push({
        fromColumns: [sourceHandle ?? ''],
        toColumn: targetHandle ?? '',
      });
    }

    return updatedColumns;
  }

  return [];
};

export const getColumnLineageData = (
  columnsData: ColumnLineage[],
  data: Edge
) => {
  const columnsLineage = columnsData?.reduce((col, curr) => {
    const sourceHandle = data.data?.sourceHandle;
    const targetHandle = data.data?.targetHandle;

    if (curr.toColumn === targetHandle) {
      const newCol = {
        ...curr,
        fromColumns:
          curr.fromColumns?.filter((column) => column !== sourceHandle) ?? [],
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

export const createNewEdge = (edge: Edge) => {
  const { data } = edge;
  const selectedEdge: AddLineage = {
    edge: {
      fromEntity: {
        id: data.edge.fromEntity.id,
        type: data.edge.fromEntity.type,
      },
      toEntity: {
        id: data.edge.toEntity.id,
        type: data.edge.toEntity.type,
      },
    },
  };

  const updatedCols = getColumnLineageData(data.edge.columns, edge);
  selectedEdge.edge.lineageDetails = getLineageDetailsObject(
    edge
  ) as AddLineage['edge']['lineageDetails'];
  (selectedEdge.edge.lineageDetails as LineageDetails).columnsLineage =
    updatedCols;

  return selectedEdge;
};

export const isSelfConnectingEdge = (source: string, target: string) => {
  return source === target;
};

const getSelfConnectingEdgePath = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeAlignmentPathDataProps) => {
  const radiusX = (sourceX - targetX) * 0.6;
  const radiusY = 50;

  return `M ${sourceX - 5} ${sourceY} A ${radiusX} ${radiusY} 0 1 0 ${
    targetX + 2
  } ${targetY}`;
};

export const getEdgePathAlignmentData = (
  source: string,
  target: string,
  edgePathData: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
  }
) => {
  if (isSelfConnectingEdge(source, target)) {
    return {
      sourceX: edgePathData.sourceX - 5,
      sourceY: edgePathData.sourceY - 80,
      targetX: edgePathData.targetX + 2,
      targetY: edgePathData.targetY - 80,
    };
  }

  return edgePathData;
};

const getEdgePath = (
  edgePath: string,
  source: string,
  target: string,
  alignmentPathData: EdgeAlignmentPathDataProps
) => {
  return isSelfConnectingEdge(source, target)
    ? getSelfConnectingEdgePath(alignmentPathData)
    : edgePath;
};

export const getEdgePathData = (
  source: string,
  target: string,
  edgePathData: EdgeAlignmentPathDataProps
) => {
  const { sourceX, sourceY, targetX, targetY } = getEdgePathAlignmentData(
    source,
    target,
    edgePathData
  );
  const { sourcePosition, targetPosition } = edgePathData;

  const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return {
    edgePath: getEdgePath(edgePath, source, target, edgePathData),
    edgeCenterX,
    edgeCenterY,
  };
};

export const getEdgeDataFromEdge = (edge: Edge): EdgeData => {
  const { data } = edge;

  if (data.edge.extraInfo) {
    const { fromEntity, toEntity } = data.edge.extraInfo;

    return {
      fromEntity: fromEntity.type,
      fromId: fromEntity.id,
      toEntity: toEntity.type,
      toId: toEntity.id,
    };
  }

  return {
    fromEntity: data.edge.fromEntity.type,
    fromId: data.edge.fromEntity.id,
    toEntity: data.edge.toEntity.type,
    toId: data.edge.toEntity.id,
  };
};

export const createColumnEdges = (
  nodes: EntityReference[],
  edges: EdgeDetails[],
  hidden?: boolean
) => {
  const columnEdges: Edge[] = [];
  const edgeIds = new Set<string>();
  const columnsHavingLineage = new Map<string, Set<string>>();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  edges.forEach((edge) => {
    const sourceId = edge.fromEntity.id;
    const targetId = edge.toEntity.id;

    const sourceType = nodeById.get(sourceId);
    const targetType = nodeById.get(targetId);

    if (!columnsHavingLineage.has(sourceId)) {
      columnsHavingLineage.set(sourceId, new Set<string>());
    }

    if (!columnsHavingLineage.has(targetId)) {
      columnsHavingLineage.set(targetId, new Set());
    }

    if (isUndefined(sourceType) || isUndefined(targetType)) {
      return;
    }

    if (!isUndefined(edge.columns)) {
      edge.columns?.forEach((e) => {
        const toColumn = e.toColumn ?? '';
        if (toColumn && e.fromColumns?.length) {
          e.fromColumns.forEach((fromColumn) => {
            columnsHavingLineage.get(sourceId)?.add(fromColumn);
            columnsHavingLineage.get(targetId)?.add(toColumn);

            const edgeId = `column-${fromColumn}-${toColumn}-edge-${sourceId}-${targetId}`;

            if (!edgeIds.has(edgeId)) {
              edgeIds.add(edgeId);
              columnEdges.push({
                id: edgeId,
                source: sourceId,
                target: targetId,
                targetHandle: toColumn,
                sourceHandle: fromColumn,
                style: { strokeWidth: '2px' },
                type: 'buttonedge',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: {
                  edge,
                  isColumnLineage: true,
                  dataTestId: `column-edge-${fromColumn}-${toColumn}`,
                },
                ...(hidden && { hidden }),
              });
            }
          });
        }
      });
    }
  });

  return {
    columnEdges,
    columnsHavingLineage,
  };
};

export const createEntityEdgesAndMaps = (
  nodes: EntityReference[],
  edges: EdgeDetails[],
  entityFqn: string,
  hidden?: boolean
) => {
  const entityEdges: Edge[] = [];
  const incomingMap = new Map<string, number>();
  const outgoingMap = new Map<string, number>();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  edges.forEach((edge) => {
    const sourceId = edge.fromEntity.id;
    const targetId = edge.toEntity.id;

    const sourceType = nodeById.get(sourceId);
    const targetType = nodeById.get(targetId);

    if (isUndefined(sourceType) || isUndefined(targetType)) {
      return;
    }

    outgoingMap.set(sourceId, (outgoingMap.get(sourceId) ?? 0) + 1);
    incomingMap.set(targetId, (incomingMap.get(targetId) ?? 0) + 1);

    const edgeId = `edge-${sourceId}-${targetId}`;
    entityEdges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: 'buttonedge',
      animated: !isNil(edge.pipeline),
      style: { strokeWidth: '2px' },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        edge,
        isColumnLineage: false,
        isPipelineRootNode: !isNil(edge.pipeline)
          ? entityFqn === edge.pipeline?.fullyQualifiedName
          : false,
        dataTestId: `edge-${edge.fromEntity.fullyQualifiedName}-${edge.toEntity.fullyQualifiedName}`,
      },
      ...(hidden && { hidden }),
    });
  });

  return {
    entityEdges,
    incomingMap,
    outgoingMap,
  };
};

export const createEdgesAndEdgeMaps = (
  nodes: EntityReference[],
  edges: EdgeDetails[],
  entityFqn: string,
  isColumnLayerActive: boolean,
  hidden?: boolean
) => {
  const { entityEdges, incomingMap, outgoingMap } = createEntityEdgesAndMaps(
    nodes,
    edges,
    entityFqn,
    hidden
  );

  if (isColumnLayerActive) {
    const { columnEdges, columnsHavingLineage } = createColumnEdges(
      nodes,
      edges,
      hidden
    );

    return {
      edges: [...entityEdges, ...columnEdges],
      columnsHavingLineage,
      incomingMap,
      outgoingMap,
    };
  }

  return {
    edges: entityEdges,
    columnsHavingLineage: new Map<string, Set<string>>(),
    incomingMap,
    outgoingMap,
  };
};

export const getAllDownstreamEdges = (
  nodeId: string,
  edges: Edge[],
  visitedNodes: Set<string> = new Set()
): Edge[] => {
  if (visitedNodes.has(nodeId)) {
    return [];
  }

  visitedNodes.add(nodeId);

  const directDownstreamEdges = edges.filter((edge) => edge.source === nodeId);

  const targetNodes = directDownstreamEdges.map((edge) => edge.target);

  const nestedDownstreamEdges = targetNodes.flatMap((targetNodeId) =>
    getAllDownstreamEdges(targetNodeId, edges, visitedNodes)
  );

  return [...directDownstreamEdges, ...nestedDownstreamEdges];
};

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

import { CheckOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { AxiosError } from 'axios';
import { CustomEdge } from 'components/EntityLineage/CustomEdge.component';
import CustomNode from 'components/EntityLineage/CustomNode.component';
import {
  CustomEdgeData,
  CustomElement,
  CustomFlow,
  Edge as InterfaceEdge,
  EdgeData,
  EdgeTypeEnum,
  EntityReferenceChild,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
  ModifiedColumn,
  NodeIndexMap,
  SelectedEdge,
  SelectedNode,
} from 'components/EntityLineage/EntityLineage.interface';
import LineageNodeLabel from 'components/EntityLineage/LineageNodeLabel';
import LoadMoreNode from 'components/EntityLineage/LoadMoreNode.component';
import Loader from 'components/Loader/Loader';
import dagre from 'dagre';
import { t } from 'i18next';
import jsonData from 'jsons/en';
import {
  cloneDeep,
  isEmpty,
  isEqual,
  isNil,
  isUndefined,
  uniqueId,
  uniqWith,
} from 'lodash';
import { LoadingState } from 'Models';
import React, { Fragment, MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Connection,
  Edge,
  isNode,
  MarkerType,
  Node,
  Position,
  ReactFlowInstance,
} from 'reactflow';
import { addLineage, deleteLineageEdge } from 'rest/miscAPI';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  getDashboardDetailsPath,
  getMlModelPath,
  getPipelineDetailsPath,
  getTableTabPath,
  getTopicDetailsPath,
  SECONDARY_COLOR,
} from '../constants/constants';
import {
  EXPANDED_NODE_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  ZOOM_VALUE,
} from '../constants/Lineage.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
  EntityType,
  FqnPart,
} from '../enums/entity.enum';
import { AddLineage } from '../generated/api/lineage/addLineage';
import { Column } from '../generated/entity/data/table';
import {
  ColumnLineage,
  Edge as EntityLineageEdge,
  EntityLineage,
  LineageDetails,
} from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import {
  getEntityName,
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
  prepareLabel,
} from './CommonUtils';
import { isLeafNode } from './EntityUtils';
import { getEncodedFqn } from './StringsUtils';
import SVGIcons from './SvgUtils';
import { getEntityLink } from './TableUtils';
import { showErrorToast } from './ToastUtils';

export const MAX_LINEAGE_LENGTH = 20;

export const getHeaderLabel = (
  name = '',
  fqn = '',
  type: string,
  isMainNode: boolean
) => {
  return (
    <Fragment>
      {isMainNode ? (
        <span
          className="tw-break-words description-text tw-self-center tw-font-medium"
          data-testid="lineage-entity">
          {name || prepareLabel(type, fqn, false)}
        </span>
      ) : (
        <Typography.Title
          ellipsis
          className="m-b-0 text-base"
          level={5}
          title={name || prepareLabel(type, fqn, false)}>
          <Link className="" to={getEntityLink(type, fqn)}>
            <Button
              className="text-base font-semibold p-0"
              data-testid="link-button"
              type="link">
              {name || prepareLabel(type, fqn, false)}
            </Button>
          </Link>
        </Typography.Title>
      )}
    </Fragment>
  );
};

export const onLoad = (reactFlowInstance: ReactFlowInstance) => {
  reactFlowInstance.fitView();
  reactFlowInstance.zoomTo(ZOOM_VALUE);
};
/* eslint-disable-next-line */
export const onNodeMouseEnter = (_event: ReactMouseEvent, _node: Node) => {
  return;
};
/* eslint-disable-next-line */
export const onNodeMouseMove = (_event: ReactMouseEvent, _node: Node) => {
  return;
};
/* eslint-disable-next-line */
export const onNodeMouseLeave = (_event: ReactMouseEvent, _node: Node) => {
  return;
};
/* eslint-disable-next-line */
export const onNodeContextMenu = (event: ReactMouseEvent, _node: Node) => {
  event.preventDefault();
};

export const dragHandle = (event: ReactMouseEvent) => {
  event.stopPropagation();
};

const getNodeType = (
  entityLineage: EntityLineage,
  id: string
): EntityLineageNodeType => {
  const upStreamEdges = entityLineage.upstreamEdges || [];
  const downStreamEdges = entityLineage.downstreamEdges || [];

  const hasDownStreamToEntity = downStreamEdges.find(
    (down) => down.toEntity === id
  );
  const hasDownStreamFromEntity = downStreamEdges.find(
    (down) => down.fromEntity === id
  );
  const hasUpstreamFromEntity = upStreamEdges.find(
    (up) => up.fromEntity === id
  );
  const hasUpstreamToEntity = upStreamEdges.find((up) => up.toEntity === id);

  if (hasDownStreamToEntity && !hasDownStreamFromEntity) {
    return EntityLineageNodeType.OUTPUT;
  }
  if (hasUpstreamFromEntity && !hasUpstreamToEntity) {
    return EntityLineageNodeType.INPUT;
  }

  return EntityLineageNodeType.DEFAULT;
};

export const getColumnType = (edges: Edge[], id: string) => {
  const sourceEdge = edges.find((edge) => edge.sourceHandle === id);
  const targetEdge = edges.find((edge) => edge.targetHandle === id);

  if (sourceEdge?.sourceHandle === id && targetEdge?.targetHandle === id) {
    return EntityLineageNodeType.DEFAULT;
  }
  if (sourceEdge?.sourceHandle === id) {
    return EntityLineageNodeType.INPUT;
  }
  if (targetEdge?.targetHandle === id) {
    return EntityLineageNodeType.OUTPUT;
  }

  return EntityLineageNodeType.NOT_CONNECTED;
};

export const getLineageData = (
  entityLineage: EntityLineage,
  onSelect: (state: boolean, value: SelectedNode) => void,
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void,
  lineageLeafNodes: LeafNodes,
  isNodeLoading: LoadingNodeState,
  isEditMode: boolean,
  edgeType: string,
  onEdgeClick: (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => void,
  removeNodeHandler: (node: Node) => void,
  columns: { [key: string]: Column[] },
  addPipelineClick?: (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => void,
  handleColumnClick?: (value: string) => void,
  isExpanded?: boolean,
  onNodeExpand?: (isExpanded: boolean, node: EntityReference) => void
) => {
  const [x, y] = [0, 0];
  const nodes = [...(entityLineage['nodes'] || []), entityLineage['entity']];
  const edgesV1 = [
    ...(entityLineage.downstreamEdges || []),
    ...(entityLineage.upstreamEdges || []),
  ];
  const lineageEdgesV1: Edge[] = [];
  const mainNode = entityLineage['entity'];

  edgesV1.forEach((edge) => {
    const sourceType = nodes.find((n) => edge.fromEntity === n.id);
    const targetType = nodes.find((n) => edge.toEntity === n.id);

    if (isUndefined(sourceType) || isUndefined(targetType)) {
      return;
    }

    if (!isUndefined(edge.lineageDetails)) {
      edge.lineageDetails.columnsLineage?.forEach((e) => {
        const toColumn = e.toColumn || '';
        if (toColumn && e.fromColumns && e.fromColumns.length > 0) {
          const targetCol = nodes.find((n) => toColumn === n.id);
          if (!targetCol) {
            return;
          }

          e.fromColumns.forEach((fromColumn) => {
            const sourceCol = nodes.find((n) => fromColumn === n.id);
            if (!sourceCol) {
              return;
            }
            lineageEdgesV1.push({
              id: `column-${fromColumn}-${toColumn}-edge-${edge.fromEntity}-${edge.toEntity}`,
              source: edge.fromEntity,
              target: edge.toEntity,
              targetHandle: toColumn,
              sourceHandle: fromColumn,
              type: edgeType,
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
              data: {
                id: `column-${fromColumn}-${toColumn}-edge-${edge.fromEntity}-${edge.toEntity}`,
                source: edge.fromEntity,
                target: edge.toEntity,
                targetHandle: toColumn,
                sourceHandle: fromColumn,
                isEditMode,
                onEdgeClick,
                isColumnLineage: true,
                isExpanded,
                columnFunctionValue: e.function,
                edge,
              },
            });
          });
        }
      });
    }

    lineageEdgesV1.push({
      id: `edge-${edge.fromEntity}-${edge.toEntity}`,
      source: `${edge.fromEntity}`,
      target: `${edge.toEntity}`,
      type: edgeType,
      animated: !isUndefined(edge.lineageDetails?.pipeline),
      style: { strokeWidth: '2px' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      data: {
        id: `edge-${edge.fromEntity}-${edge.toEntity}`,
        label: getEntityName(edge.lineageDetails?.pipeline),
        pipeline: edge.lineageDetails?.pipeline,
        source: `${edge.fromEntity}`,
        target: `${edge.toEntity}`,
        sourceType: sourceType?.type,
        targetType: targetType?.type,
        isEditMode,
        onEdgeClick,
        addPipelineClick,
        isColumnLineage: false,
        isExpanded,
        edge,
      },
    });
  });

  const makeNode = (node: EntityReference) => {
    let type = node.type as EntityLineageNodeType;
    if (type !== EntityLineageNodeType.LOAD_MORE) {
      type = getNodeType(entityLineage, node.id);
    }
    const cols: { [key: string]: ModifiedColumn } = {};
    columns[node.id]?.forEach((col) => {
      cols[col.fullyQualifiedName || col.name] = {
        ...col,
        type:
          type === EntityLineageNodeType.LOAD_MORE
            ? type
            : isEditMode
            ? EntityLineageNodeType.DEFAULT
            : getColumnType(lineageEdgesV1, col.fullyQualifiedName || col.name),
      };
    });

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type:
        type === EntityLineageNodeType.LOAD_MORE || !isEditMode
          ? type
          : EntityLineageNodeType.DEFAULT,
      className: 'leaf-node',
      data: {
        label: (
          <div className="tw-flex">
            {type === EntityLineageNodeType.INPUT && (
              <div
                className="tw-pr-2 tw-self-center tw-cursor-pointer "
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(false, {} as SelectedNode);
                  if (node) {
                    loadNodeHandler(
                      {
                        ...node,
                        fullyQualifiedName: getEncodedFqn(
                          node.fullyQualifiedName ?? ''
                        ),
                      },
                      'from'
                    );
                  }
                }}>
                {!isLeafNode(lineageLeafNodes, node?.id as string, 'from') &&
                !node.id.includes(isNodeLoading.id as string) ? (
                  <LeftOutlined className="tw-text-primary tw-mr-2" />
                ) : null}
                {isNodeLoading.state &&
                node.id.includes(isNodeLoading.id as string) ? (
                  <Loader size="small" type="default" />
                ) : null}
              </div>
            )}
            <LineageNodeLabel
              isExpanded={isExpanded}
              node={node}
              onNodeExpand={onNodeExpand}
            />
            {type === EntityLineageNodeType.OUTPUT && (
              <div
                className="tw-pl-2 tw-self-center tw-cursor-pointer "
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(false, {} as SelectedNode);
                  if (node) {
                    loadNodeHandler(
                      {
                        ...node,
                        fullyQualifiedName: getEncodedFqn(
                          node.fullyQualifiedName ?? ''
                        ),
                      },
                      'to'
                    );
                  }
                }}>
                {!isLeafNode(lineageLeafNodes, node?.id as string, 'to') &&
                !node.id.includes(isNodeLoading.id as string) ? (
                  <RightOutlined className="tw-text-primary tw-ml-2" />
                ) : null}
                {isNodeLoading.state &&
                node.id.includes(isNodeLoading.id as string) ? (
                  <Loader size="small" type="default" />
                ) : null}
              </div>
            )}
          </div>
        ),
        entityType: node.type,
        removeNodeHandler,
        isEditMode,
        isExpanded,
        columns: cols,
        handleColumnClick,
        node,
      },
      position: {
        x: x,
        y: y,
      },
    };
  };

  const mainCols: { [key: string]: ModifiedColumn } = {};
  columns[mainNode.id]?.forEach((col) => {
    mainCols[col.fullyQualifiedName || col.name] = {
      ...col,
      type: isEditMode
        ? EntityLineageNodeType.DEFAULT
        : getColumnType(lineageEdgesV1, col.fullyQualifiedName || col.name),
    };
  });

  const lineageData = [
    {
      id: `${mainNode.id}`,
      sourcePosition: 'right',
      targetPosition: 'left',
      type: getNodeType(entityLineage, mainNode.id),
      className: `leaf-node core`,
      data: {
        label: (
          <LineageNodeLabel
            isExpanded={isExpanded}
            node={mainNode}
            onNodeExpand={onNodeExpand}
          />
        ),
        isEditMode,
        removeNodeHandler,
        handleColumnClick,
        columns: mainCols,
        isExpanded,
        node: mainNode,
      },
      position: { x, y },
    },
  ];

  (entityLineage.nodes || []).forEach((n) => lineageData.push(makeNode(n)));

  return { node: lineageData, edge: lineageEdgesV1 };
};

export const getDataLabel = (
  displayName?: string,
  fqn = '',
  isTextOnly = false,
  type?: string
) => {
  const databaseName = getPartialNameFromTableFQN(fqn, [FqnPart.Database]);
  const schemaName = getPartialNameFromTableFQN(fqn, [FqnPart.Schema]);

  let label = '';
  if (displayName) {
    label = displayName;
  } else {
    label = prepareLabel(type as string, fqn);
  }

  if (isTextOnly) {
    return label;
  } else {
    return (
      <span
        className="tw-break-words tw-self-center w-72"
        data-testid="lineage-entity">
        {type === 'table'
          ? databaseName && schemaName
            ? `${databaseName}${FQN_SEPARATOR_CHAR}${schemaName}${FQN_SEPARATOR_CHAR}${label}`
            : label
          : label}
      </span>
    );
  }
};

export const getDeletedLineagePlaceholder = () => {
  return (
    <div className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
      <span>
        {t('message.lineage-data-is-not-available-for-deleted-entities')}
      </span>
    </div>
  );
};

export const getLayoutedElements = (
  elements: CustomElement,
  direction = EntityLineageDirection.LEFT_RIGHT
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const { node, edge } = elements;
  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  dagreGraph.setGraph({ rankdir: direction });

  const nodeIds = node.map((item) => item.id);

  node.forEach((el) => {
    const isExpanded = el.data.isExpanded;
    dagreGraph.setNode(el.id, {
      width: NODE_WIDTH,
      height: isExpanded ? EXPANDED_NODE_HEIGHT : NODE_HEIGHT,
    });
  });

  const edgesRequired: Edge[] = [];

  edge.forEach((el) => {
    if (
      nodeIds.indexOf(el.source) !== -1 &&
      nodeIds.indexOf(el.target) !== -1
    ) {
      edgesRequired.push(el);
      dagreGraph.setEdge(el.source, el.target);
    }
  });

  dagre.layout(dagreGraph);

  const uNode = node.map((el) => {
    const isExpanded = el.data.isExpanded;
    const nodeHight = isExpanded ? EXPANDED_NODE_HEIGHT : NODE_HEIGHT;
    const nodeWithPosition = dagreGraph.node(el.id);
    el.targetPosition = isHorizontal ? Position.Left : Position.Top;
    el.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    el.position = {
      x: nodeWithPosition.x - NODE_WIDTH / 2,
      y: nodeWithPosition.y - nodeHight / 2,
    };

    return el;
  });

  return { node: uNode, edge: edgesRequired };
};

export const getModalBodyText = (selectedEdge: SelectedEdge) => {
  const { data, source, target } = selectedEdge;
  const { isColumnLineage } = data as CustomEdgeData;
  let sourceEntity = '';
  let targetEntity = '';
  const sourceFQN = isColumnLineage
    ? data?.sourceHandle
    : source.fullyQualifiedName;

  const targetFQN = isColumnLineage
    ? data?.targetHandle
    : target.fullyQualifiedName;

  const fqnPart = isColumnLineage ? FqnPart.Column : FqnPart.Table;

  if (source.type === EntityType.TABLE) {
    sourceEntity = getPartialNameFromTableFQN(sourceFQN || '', [fqnPart]);
  } else {
    sourceEntity = getPartialNameFromFQN(sourceFQN || '', ['database']);
  }

  if (target.type === EntityType.TABLE) {
    targetEntity = getPartialNameFromTableFQN(targetFQN || '', [fqnPart]);
  } else {
    targetEntity = getPartialNameFromFQN(targetFQN || '', ['database']);
  }

  return t('message.remove-edge-between-source-and-target', {
    sourceDisplayName: source.displayName ? source.displayName : sourceEntity,
    targetDisplayName: target.displayName ? target.displayName : targetEntity,
  });
};

export const getUniqueFlowElements = (elements: CustomFlow[]) => {
  const flag: { [x: string]: boolean } = {};
  const uniqueElements: CustomFlow[] = [];

  elements.forEach((elem) => {
    if (!flag[elem.id]) {
      flag[elem.id] = true;
      uniqueElements.push(elem);
    }
  });

  return uniqueElements;
};

/**
 *
 * @param onClick - callback
 * @returns - Button element with attach callback
 */
export const getNodeRemoveButton = (onClick: () => void) => {
  return (
    <button
      className="tw-absolute tw--top-3.5 tw--right-3 tw-cursor-pointer tw-z-9999 tw-bg-body-hover tw-rounded-full"
      onClick={() => onClick()}>
      <SVGIcons alt="times-circle" icon="icon-times-circle" width="16px" />
    </button>
  );
};

export const getSelectedEdgeArr = (
  edgeArr: EntityLineageEdge[],
  edgeData: EdgeData
) => {
  return edgeArr.filter(
    (edge) =>
      !edgeArr.find(
        () =>
          edgeData.fromId === edge.fromEntity && edgeData.toId === edge.toEntity
      )
  );
};

/**
 * Finds the upstream/downstream edge based on selected edge
 * @param edgeArr edge[]
 * @param data selected edge
 * @returns edge
 */

export const findUpstreamDownStreamEdge = (
  edgeArr: EntityLineageEdge[] | undefined,
  data: SelectedEdge
) => {
  return edgeArr?.find(
    (edge) =>
      edge.fromEntity === data.source.id && edge.toEntity === data.target.id
  );
};

/**
 * Get upstream/downstream column lineage array
 * @param lineageDetails LineageDetails
 * @param data SelectedEdge
 * @returns Updated LineageDetails
 */

export const getUpStreamDownStreamColumnLineageArr = (
  lineageDetails: LineageDetails,
  data: SelectedEdge
) => {
  const columnsLineage = lineageDetails.columnsLineage?.reduce((col, curr) => {
    if (curr.toColumn === data.data?.targetHandle) {
      const newCol = {
        ...curr,
        fromColumns:
          curr.fromColumns?.filter(
            (column) => column !== data.data?.sourceHandle
          ) || [],
      };
      if (newCol.fromColumns?.length) {
        return [...col, newCol];
      } else {
        return col;
      }
    }

    return [...col, curr];
  }, [] as ColumnLineage[]);

  return {
    sqlQuery: lineageDetails.sqlQuery || '',
    columnsLineage: columnsLineage,
  };
};

/**
 * Get updated EntityLineageEdge Array based on selected data
 * @param edge EntityLineageEdge[]
 * @param data SelectedEdge
 * @param lineageDetails updated LineageDetails
 * @returns updated EntityLineageEdge[]
 */
export const getUpdatedUpstreamDownStreamEdgeArr = (
  edge: EntityLineageEdge[],
  data: SelectedEdge,
  lineageDetails: LineageDetails
) => {
  return edge.map((down) => {
    if (
      down.fromEntity === data.source.id &&
      down.toEntity === data.target.id
    ) {
      return {
        ...down,
        lineageDetails: lineageDetails,
      };
    }

    return down;
  });
};

/**
 * Get array of the removed node
 * @param nodes All the node
 * @param edge selected edge
 * @param entity main entity
 * @param selectedEntity selected entity
 * @returns details of removed node
 */
export const getRemovedNodeData = (
  nodes: EntityReference[],
  edge: Edge,
  entity: EntityReference,
  selectedEntity: EntityReference
) => {
  let targetNode = nodes.find((node) => edge.target?.includes(node.id));
  let sourceNode = nodes.find((node) => edge.source?.includes(node.id));
  const selectedNode = isEmpty(selectedEntity) ? entity : selectedEntity;

  if (isUndefined(targetNode)) {
    targetNode = selectedNode;
  }
  if (isUndefined(sourceNode)) {
    sourceNode = selectedNode;
  }

  return {
    id: edge.id,
    source: sourceNode,
    target: targetNode,
  };
};

/**
 * Get source/target edge based on query string
 * @param edge upstream/downstream edge array
 * @param queryStr source/target string
 * @param id main entity id
 * @returns source/target edge
 */
const getSourceTargetNode = (
  edge: EntityLineageEdge[],
  queryStr: string | null,
  id: string
) => {
  return edge.find(
    (d) =>
      (queryStr?.includes(d.fromEntity) || queryStr?.includes(d.toEntity)) &&
      queryStr !== id
  );
};

export const getEdgeType = (
  updatedLineageData: EntityLineage,
  params: Edge | Connection
) => {
  const { entity } = updatedLineageData;
  const { target, source } = params;
  const sourceDownstreamNode = getSourceTargetNode(
    updatedLineageData.downstreamEdges || [],
    source,
    entity.id
  );

  const sourceUpStreamNode = getSourceTargetNode(
    updatedLineageData.upstreamEdges || [],
    source,
    entity.id
  );

  const targetDownStreamNode = getSourceTargetNode(
    updatedLineageData.downstreamEdges || [],
    target,
    entity.id
  );

  const targetUpStreamNode = getSourceTargetNode(
    updatedLineageData.upstreamEdges || [],
    target,
    entity.id
  );

  const isUpstream =
    (!isNil(sourceUpStreamNode) && !isNil(targetDownStreamNode)) ||
    !isNil(sourceUpStreamNode) ||
    !isNil(targetUpStreamNode) ||
    target?.includes(entity.id);

  const isDownstream =
    (!isNil(sourceDownstreamNode) && !isNil(targetUpStreamNode)) ||
    !isNil(sourceDownstreamNode) ||
    !isNil(targetDownStreamNode) ||
    source?.includes(entity.id);

  if (isUpstream) {
    return EdgeTypeEnum.UP_STREAM;
  } else if (isDownstream) {
    return EdgeTypeEnum.DOWN_STREAM;
  }

  return EdgeTypeEnum.NO_STREAM;
};

/**
 * Get updated Edge with lineageDetails
 * @param edges Array of Edge
 * @param params new connected edge
 * @param lineageDetails updated lineage details
 * @returns updated edge array
 */
export const getUpdatedEdge = (
  edges: EntityLineageEdge[],
  params: Edge | Connection,
  lineageDetails: LineageDetails | undefined
) => {
  const updatedEdge: EntityLineageEdge[] = [];
  const { target, source } = params;
  edges.forEach((edge) => {
    if (edge.fromEntity === source && edge.toEntity === target) {
      updatedEdge.push({
        ...edge,
        lineageDetails: lineageDetails,
      });
    } else {
      updatedEdge.push(edge);
    }
  });

  return updatedEdge;
};

// create new edge
export const createNewEdge = (
  params: Edge | Connection,
  isEditMode: boolean,
  sourceNodeType: string,
  targetNodeType: string,
  isColumnLineage: boolean,
  onEdgeClick: (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => void,
  addPipelineClick: (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => void
) => {
  const { target, source, sourceHandle, targetHandle } = params;
  let data: Edge = {
    id: `edge-${source}-${target}`,
    source: `${source}`,
    target: `${target}`,
    type: isEditMode ? 'buttonedge' : 'default',
    style: { strokeWidth: '2px' },
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    data: {
      id: `edge-${source}-${target}`,
      source: source,
      target: target,
      sourceType: sourceNodeType,
      targetType: targetNodeType,
      isColumnLineage: isColumnLineage,
      onEdgeClick,
      isEditMode,
      addPipelineClick,
    },
  };

  if (isColumnLineage) {
    data = {
      ...data,
      id: `column-${sourceHandle}-${targetHandle}-edge-${source}-${target}`,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      style: undefined,
      data: {
        ...data.data,
        id: `column-${sourceHandle}-${targetHandle}-edge-${source}-${target}`,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        addPipelineClick: undefined,
      },
    };
  }

  return data;
};

export const getUpdatedEdgeWithPipeline = (
  edges: EntityLineage['downstreamEdges'],
  updatedLineageDetails: LineageDetails,
  selectedEdge: CustomEdgeData,
  pipelineDetail: EntityReference | undefined
) => {
  if (isUndefined(edges)) {
    return [];
  }

  const { source, target } = selectedEdge;

  return edges.map((edge) => {
    if (edge.fromEntity === source && edge.toEntity === target) {
      return {
        ...edge,
        lineageDetails: {
          ...updatedLineageDetails,
          pipeline: !isUndefined(updatedLineageDetails.pipeline)
            ? {
                displayName: pipelineDetail?.displayName,
                name: pipelineDetail?.name,
                ...updatedLineageDetails.pipeline,
              }
            : undefined,
        },
      };
    }

    return edge;
  });
};

export const getNewLineageConnectionDetails = (
  selectedEdgeValue: EntityLineageEdge | undefined,
  selectedPipelineId: string | undefined,
  customEdgeData: CustomEdgeData
) => {
  const { source, sourceType, target, targetType } = customEdgeData;
  const updatedLineageDetails: LineageDetails = {
    ...selectedEdgeValue?.lineageDetails,
    sqlQuery: selectedEdgeValue?.lineageDetails?.sqlQuery || '',
    columnsLineage: selectedEdgeValue?.lineageDetails?.columnsLineage || [],
    pipeline: isUndefined(selectedPipelineId)
      ? undefined
      : {
          id: selectedPipelineId,
          type: EntityType.PIPELINE,
        },
  };

  const newEdge: AddLineage = {
    edge: {
      fromEntity: {
        id: source,
        type: sourceType,
      },
      toEntity: {
        id: target,
        type: targetType,
      },
      lineageDetails: updatedLineageDetails,
    },
  };

  return {
    updatedLineageDetails,
    newEdge,
  };
};

export const getLoadingStatusValue = (
  defaultState: string | JSX.Element,
  loading: boolean,
  status: LoadingState
) => {
  if (loading) {
    return <Loader size="small" type="white" />;
  } else if (status === 'success') {
    return <CheckOutlined className="text-white" />;
  } else {
    return defaultState;
  }
};

const getTracedNode = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  isIncomer: boolean
) => {
  if (!isNode(node)) {
    return [];
  }

  const tracedEdgeIds = edges
    .filter((e) => {
      const id = isIncomer ? e.target : e.source;

      return id === node.id;
    })
    .map((e) => (isIncomer ? e.source : e.target));

  return nodes.filter((n) =>
    tracedEdgeIds
      .map((id) => {
        const matches = /([\w-^]+)__([\w-]+)/.exec(id);
        if (matches === null) {
          return id;
        }

        return matches[1];
      })
      .includes(n.id)
  );
};

export const getAllTracedNodes = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  prevTraced = [] as Node[],
  isIncomer: boolean
) => {
  const tracedNodes = getTracedNode(node, nodes, edges, isIncomer);

  return tracedNodes.reduce((memo, tracedNode) => {
    memo.push(tracedNode);

    if (prevTraced.findIndex((n) => n.id === tracedNode.id) === -1) {
      prevTraced.push(tracedNode);

      getAllTracedNodes(
        tracedNode,
        nodes,
        edges,
        prevTraced,
        isIncomer
      ).forEach((foundNode) => {
        memo.push(foundNode);

        if (prevTraced.findIndex((n) => n.id === foundNode.id) === -1) {
          prevTraced.push(foundNode);
        }
      });
    }

    return memo;
  }, [] as Node[]);
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

export const isTracedEdge = (
  selectedNode: Node,
  edge: Edge,
  incomerIds: string[],
  outgoerIds: string[]
) => {
  const incomerEdges =
    incomerIds.includes(edge.source) &&
    (incomerIds.includes(edge.target) || selectedNode.id === edge.target);
  const outgoersEdges =
    outgoerIds.includes(edge.target) &&
    (outgoerIds.includes(edge.source) || selectedNode.id === edge.source);

  return (
    (incomerEdges || outgoersEdges) &&
    isUndefined(edge.sourceHandle) &&
    isUndefined(edge.targetHandle)
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
      const id = isIncomer ? e.targetHandle : e.sourceHandle;

      return id === selectedColumn;
    })
    .map((e) => (isIncomer ? `${e.sourceHandle}` : `${e.targetHandle}`));

  return tracedEdgeIds;
};

export const getAllTracedEdges = (
  selectedColumn: string,
  edges: Edge[],
  prevTraced = [] as string[],
  isIncomer: boolean
) => {
  const tracedNodes = getTracedEdge(selectedColumn, edges, isIncomer);

  return tracedNodes.reduce((memo, tracedNode) => {
    memo.push(tracedNode);

    if (prevTraced.findIndex((n) => n === tracedNode) === -1) {
      prevTraced.push(tracedNode);

      getAllTracedEdges(tracedNode, edges, prevTraced, isIncomer).forEach(
        (foundNode) => {
          memo.push(foundNode);

          if (prevTraced.findIndex((n) => n === foundNode) === -1) {
            prevTraced.push(foundNode);
          }
        }
      );
    }

    return memo;
  }, [] as string[]);
};

export const getAllTracedColumnEdge = (column: string, columnEdge: Edge[]) => {
  const incomingColumnEdges = getAllTracedEdges(column, columnEdge, [], true);
  const outGoingColumnEdges = getAllTracedEdges(column, columnEdge, [], false);

  return {
    incomingColumnEdges,
    outGoingColumnEdges,
    connectedColumnEdges: [
      column,
      ...incomingColumnEdges,
      ...outGoingColumnEdges,
    ],
  };
};

export const isColumnLineageTraced = (
  column: string,
  edge: Edge,
  incomingColumnEdges: string[],
  outGoingColumnEdges: string[]
) => {
  const incomerEdges =
    incomingColumnEdges.includes(`${edge.sourceHandle}`) &&
    (incomingColumnEdges.includes(`${edge.targetHandle}`) ||
      column === edge.targetHandle);
  const outgoersEdges =
    outGoingColumnEdges.includes(`${edge.targetHandle}`) &&
    (outGoingColumnEdges.includes(`${edge.sourceHandle}`) ||
      column === edge.sourceHandle);

  return incomerEdges || outgoersEdges;
};

export const getEdgeStyle = (value: boolean) => {
  return {
    opacity: value ? 1 : 0.25,
    strokeWidth: value ? 2 : 1,
    stroke: value ? SECONDARY_COLOR : undefined,
  };
};

export const getChildMap = (obj: EntityLineage) => {
  const nodeSet = new Set<string>();
  nodeSet.add(obj.entity.id);
  const newData = cloneDeep(obj);
  newData.downstreamEdges = removeDuplicates(newData.downstreamEdges || []);
  newData.upstreamEdges = removeDuplicates(newData.upstreamEdges || []);

  const childMap: EntityReferenceChild[] = getChildren(
    newData,
    nodeSet,
    obj.entity.id
  );

  const parentsMap: EntityReferenceChild[] = getParents(
    newData,
    nodeSet,
    obj.entity.id
  );

  const map: EntityReferenceChild = {
    ...obj.entity,
    children: childMap,
    parents: parentsMap,
  };

  return map;
};

export const getPaginatedChildMap = (
  obj: EntityLineage,
  map: EntityReferenceChild | undefined,
  pagination_data: Record<string, NodeIndexMap>
) => {
  const nodes = [];
  const edges: EntityLineageEdge[] = [];
  nodes.push(obj.entity);
  if (map) {
    flattenObj(obj, map, true, obj.entity.id, nodes, edges, pagination_data);
    flattenObj(obj, map, false, obj.entity.id, nodes, edges, pagination_data);
  }

  return { nodes, edges };
};

export const flattenObj = (
  entityObj: EntityLineage,
  childMapObj: EntityReferenceChild,
  downwards: boolean,
  id: string,
  nodes: EntityReference[],
  edges: EntityLineageEdge[],
  pagination_data: Record<string, NodeIndexMap>
) => {
  const children = downwards ? childMapObj.children : childMapObj.parents;
  if (!children) {
    return;
  }
  const startIndex =
    pagination_data[id]?.[downwards ? 'downstream' : 'upstream'][0] ?? 0;
  const hasMoreThanLimit = children.length > startIndex + MAX_LINEAGE_LENGTH;
  const endIndex = startIndex + MAX_LINEAGE_LENGTH;

  children.slice(0, endIndex).forEach((item) => {
    if (item) {
      flattenObj(
        entityObj,
        item,
        downwards,
        item.id,
        nodes,
        edges,
        pagination_data
      );
      nodes.push(item);
    }
  });

  if (hasMoreThanLimit) {
    const newNodeId = `loadmore_${uniqueId('node_')}_${id}_${startIndex}`;
    const childrenLength = children.length - endIndex;

    const newNode = {
      description: 'Demo description',
      displayName: 'Load More',
      id: newNodeId,
      type: EntityLineageNodeType.LOAD_MORE,
      pagination_data: {
        index: endIndex,
        parentId: id,
        childrenLength,
      },
      edgeType: downwards ? EdgeTypeEnum.DOWN_STREAM : EdgeTypeEnum.UP_STREAM,
    };
    nodes.push(newNode);
    const newEdge: EntityLineageEdge = {
      fromEntity: downwards ? id : newNodeId,
      toEntity: downwards ? newNodeId : id,
    };
    edges.push(newEdge);
  }
};

export const getChildren = (
  obj: EntityLineage,
  nodeSet: Set<string>,
  id: string,
  index = 0
) => {
  const downStreamEdges = obj.downstreamEdges || [];
  const filtered = downStreamEdges.filter((edge) => edge.fromEntity === id);

  return filtered.reduce((childMap: EntityReferenceChild[], edge, i) => {
    const node = obj.nodes?.find((node) => node.id === edge.toEntity);
    if (node && !nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      const childNodes = getChildren(obj, nodeSet, node.id, i);
      childMap.push({ ...node, children: childNodes, pageIndex: index + i });
    }

    return childMap;
  }, []);
};

export const getParents = (
  obj: EntityLineage,
  nodeSet: Set<string>,
  id: string,
  index = 0
) => {
  const upstreamEdges = obj.upstreamEdges || [];

  return upstreamEdges
    .filter((edge) => edge.toEntity === id)
    .reduce((childMap: EntityReferenceChild[], edge, i) => {
      const node = obj.nodes?.find((node) => node.id === edge.fromEntity);
      if (node && !nodeSet.has(node.id)) {
        nodeSet.add(node.id);
        const childNodes = getParents(obj, nodeSet, node.id, i);
        childMap.push({ ...node, parents: childNodes, pageIndex: index + i });
      }

      return childMap;
    }, []);
};

export const removeDuplicates = (arr: EntityLineageEdge[]) => {
  return uniqWith(arr, isEqual);
};

export const nodeTypes = {
  output: CustomNode,
  input: CustomNode,
  default: CustomNode,
  'load-more': LoadMoreNode,
};

export const customEdges = { buttonedge: CustomEdge };

export const getNewNodes = ({
  nodes,
  downstreamEdges,
  upstreamEdges,
}: EntityLineage) => {
  return nodes?.filter(
    (n) =>
      !isUndefined(downstreamEdges?.find((d) => d.toEntity === n.id)) ||
      !isUndefined(upstreamEdges?.find((u) => u.fromEntity === n.id))
  );
};

export const findNodeById = (
  id: string,
  items: EntityReferenceChild[] = [],
  path: EntityReferenceChild[] = []
): EntityReferenceChild[] | undefined => {
  for (const [index, item] of items.entries()) {
    item.pageIndex = index;
    if (item.id === id) {
      // Return the path to the item, including the item itself
      return [...path, item];
    }
    const found = findNodeById(id, item.children, [...path, item]);
    if (found) {
      return found;
    }
  }

  return undefined;
};

export const addLineageHandler = async (edge: InterfaceEdge): Promise<void> => {
  try {
    await addLineage(edge);
  } catch (err) {
    showErrorToast(
      err as AxiosError,
      jsonData['api-error-messages']['add-lineage-error']
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
      jsonData['api-error-messages']['delete-lineage-error']
    );

    throw err;
  }
};

export const getParamByEntityType = (entityType: EntityType): string => {
  switch (entityType) {
    case EntityType.DATASET:
    case EntityType.TABLE:
      return 'datasetFQN';
    case EntityType.TOPIC:
      return 'topicFQN';
    case EntityType.PIPELINE:
      return 'pipelineFQN';
    case EntityType.MLMODEL:
      return 'mlModelFqn';
    case EntityType.DASHBOARD:
      return 'dashboardFQN';
    case EntityType.DATABASE:
      return 'databaseFQN';
    case EntityType.DATABASE_SCHEMA:
      return 'databaseSchemaFQN';
    default:
      return 'entityFQN';
  }
};

export const getEntityLineagePath = (
  entityType: EntityType,
  entityFQN: string
): string => {
  switch (entityType) {
    case EntityType.TABLE:
      return getTableTabPath(entityFQN, 'lineage');

    case EntityType.TOPIC:
      return getTopicDetailsPath(entityFQN, 'lineage');

    case EntityType.DASHBOARD:
      return getDashboardDetailsPath(entityFQN, 'lineage');

    case EntityType.PIPELINE:
      return getPipelineDetailsPath(entityFQN, 'lineage');

    case EntityType.MLMODEL:
      return getMlModelPath(entityFQN, 'lineage');

    default:
      return '';
  }
};

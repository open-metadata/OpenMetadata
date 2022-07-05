/*
 *  Copyright 2021 Collate
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

import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import dagre from 'dagre';
import { isUndefined } from 'lodash';
import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import React, { Fragment, MouseEvent as ReactMouseEvent } from 'react';
import {
  Edge,
  MarkerType,
  Node,
  Position,
  ReactFlowInstance,
} from 'react-flow-renderer';
import { Link } from 'react-router-dom';
import {
  CustomEdgeData,
  CustomeElement,
  CustomeFlow,
  ModifiedColumn,
  SelectedEdge,
  SelectedNode,
} from '../components/EntityLineage/EntityLineage.interface';
import Loader from '../components/Loader/Loader';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  nodeHeight,
  nodeWidth,
  zoomValue,
} from '../constants/Lineage.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
  EntityType,
  FqnPart,
} from '../enums/entity.enum';
import { Column } from '../generated/entity/data/table';
import { EntityLineage } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import {
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
  prepareLabel,
} from './CommonUtils';
import { isLeafNode } from './EntityUtils';
import SVGIcons from './SvgUtils';
import { getEntityLink } from './TableUtils';

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
        <span
          className="tw-break-words description-text tw-self-center link-text tw-font-medium"
          data-testid="lineage-entity">
          <Link to={getEntityLink(type, fqn)}>
            {name || prepareLabel(type, fqn, false)}
          </Link>
        </span>
      )}
    </Fragment>
  );
};

export const onLoad = (
  reactFlowInstance: ReactFlowInstance,
  length?: number,
  forceZoomReset = false
) => {
  reactFlowInstance.fitView();
  if (forceZoomReset || (length && length <= 2)) {
    reactFlowInstance.zoomTo(zoomValue);
  }
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

const getNodeType = (entityLineage: EntityLineage, id: string) => {
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

  if (hasDownStreamToEntity && !hasDownStreamFromEntity)
    return EntityLineageNodeType.OUTPUT;
  if (hasUpstreamFromEntity && !hasUpstreamToEntity)
    return EntityLineageNodeType.INPUT;

  return EntityLineageNodeType.DEFAULT;
};

export const getColumnType = (edges: Edge[], id: string) => {
  const sourceEdge = edges.find((edge) => edge.sourceHandle === id);
  const targetEdge = edges.find((edge) => edge.targetHandle === id);

  if (sourceEdge?.sourceHandle === id && targetEdge?.targetHandle === id)
    return EntityLineageNodeType.DEFAULT;
  if (sourceEdge?.sourceHandle === id) return EntityLineageNodeType.INPUT;
  if (targetEdge?.targetHandle === id) return EntityLineageNodeType.OUTPUT;

  return EntityLineageNodeType.NOT_CONNECTED;
};

export const getLineageDataV1 = (
  entityLineage: EntityLineage,
  onSelect: (state: boolean, value: SelectedNode) => void,
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void,
  lineageLeafNodes: LeafNodes,
  isNodeLoading: LoadingNodeState,
  getNodeLabel: (
    node: EntityReference,
    isExpanded?: boolean
  ) => React.ReactNode,
  isEditMode: boolean,
  edgeType: string,
  onEdgeClick: (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => void,
  removeNodeHandler: (node: Node) => void,
  columns: { [key: string]: Column[] },
  currentData: { nodes: Node[]; edges: Edge[] }
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

    if (!isUndefined(edge.lineageDetails)) {
      edge.lineageDetails.columnsLineage?.forEach((e) => {
        const toColumn = e.toColumn || '';
        if (e.fromColumns && e.fromColumns.length > 0) {
          e.fromColumns.forEach((fromColumn) => {
            lineageEdgesV1.push({
              id: `column-${fromColumn}-${toColumn}-edge-${edge.fromEntity}-${edge.toEntity}`,
              source: edge.fromEntity,
              target: edge.toEntity,
              targetHandle: toColumn,
              sourceHandle: fromColumn,
              type: isEditMode ? edgeType : 'custom',
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
              data: {
                id: `column-${fromColumn}-${toColumn}-edge-${edge.fromEntity}-${edge.toEntity}`,
                source: edge.fromEntity,
                target: edge.toEntity,
                targetHandle: toColumn,
                sourceHandle: fromColumn,
                onEdgeClick,
                isColumnLineage: true,
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
      type: isEditMode ? edgeType : 'custom',
      style: { strokeWidth: '2px' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      data: {
        id: `edge-${edge.fromEntity}-${edge.toEntity}`,
        source: `${edge.fromEntity}`,
        target: `${edge.toEntity}`,
        sourceType: sourceType?.type,
        targetType: targetType?.type,
        onEdgeClick,
        isColumnLineage: false,
      },
    });
  });

  const makeNode = (node: EntityReference) => {
    const type = getNodeType(entityLineage, node.id);
    const cols: { [key: string]: ModifiedColumn } = {};
    columns[node.id]?.forEach((col) => {
      cols[col.fullyQualifiedName || col.name] = {
        ...col,
        type: isEditMode
          ? EntityLineageNodeType.DEFAULT
          : getColumnType(lineageEdgesV1, col.fullyQualifiedName || col.name),
      };
    });
    const currentNode = currentData?.nodes?.find((n) => n.id === node.id);

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: isEditMode ? EntityLineageNodeType.DEFAULT : type,
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
                    loadNodeHandler(node, 'from');
                  }
                }}>
                {!isLeafNode(lineageLeafNodes, node?.id as string, 'from') &&
                !node.id.includes(isNodeLoading.id as string) ? (
                  <FontAwesomeIcon
                    className="tw-text-primary tw-mr-2"
                    icon={faChevronLeft}
                  />
                ) : null}
                {isNodeLoading.state &&
                node.id.includes(isNodeLoading.id as string) ? (
                  <Loader size="small" type="default" />
                ) : null}
              </div>
            )}

            <div>
              {getNodeLabel(node, currentNode?.data?.isExpanded || false)}
            </div>

            {type === EntityLineageNodeType.OUTPUT && (
              <div
                className="tw-pl-2 tw-self-center tw-cursor-pointer "
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(false, {} as SelectedNode);
                  if (node) {
                    loadNodeHandler(node, 'to');
                  }
                }}>
                {!isLeafNode(lineageLeafNodes, node?.id as string, 'to') &&
                !node.id.includes(isNodeLoading.id as string) ? (
                  <FontAwesomeIcon
                    className="tw-text-primary tw-ml-2"
                    icon={faChevronRight}
                  />
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
        isExpanded: currentNode?.data?.isExpanded || false,
        columns: cols,
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
  const currentNode = currentData?.nodes?.find((n) => n.id === mainNode.id)
    ?.data.isExpanded;

  const lineageData = [
    {
      id: `${mainNode.id}`,
      sourcePosition: 'right',
      targetPosition: 'left',
      type: getNodeType(entityLineage, mainNode.id),
      className: `leaf-node ${!isEditMode ? 'core' : ''}`,
      data: {
        label: getNodeLabel(mainNode, currentNode || false),
        isEditMode,
        removeNodeHandler,
        columns: mainCols,
        isExpanded: currentNode || false,
      },
      position: { x: x, y: y },
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
        className="tw-break-words tw-self-center tw-w-60"
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

export const getNoLineageDataPlaceholder = () => {
  return (
    <div className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
      <span>
        Lineage is currently supported for Airflow. To enable lineage collection
        from Airflow, please follow the documentation
      </span>
      <Link
        className="tw-ml-1"
        target="_blank"
        to={{
          pathname:
            'https://docs.open-metadata.org/install/metadata-ingestion/airflow/configure-airflow-lineage',
        }}>
        here.
      </Link>
    </div>
  );
};
export const getDeletedLineagePlaceholder = () => {
  return (
    <div className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
      <span>Lineage data is not available for deleted entities.</span>
    </div>
  );
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const getLayoutedElementsV1 = (
  elements: CustomeElement,
  direction = EntityLineageDirection.LEFT_RIGHT
) => {
  const { node, edge } = elements;
  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  dagreGraph.setGraph({ rankdir: direction });

  node.forEach((el) => {
    dagreGraph.setNode(el.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  edge.forEach((el) => {
    dagreGraph.setEdge(el.source, el.target);
  });

  dagre.layout(dagreGraph);

  const uNode = node.map((el) => {
    const nodeWithPosition = dagreGraph.node(el.id);
    el.targetPosition = isHorizontal ? Position.Left : Position.Top;
    el.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    el.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return el;
  });

  return { node: uNode, edge };
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

  return `Are you sure you want to remove the edge between "${
    source.displayName ? source.displayName : sourceEntity
  } and ${target.displayName ? target.displayName : targetEntity}"?`;
};

export const getUniqueFlowElements = (elements: CustomeFlow[]) => {
  const flag: { [x: string]: boolean } = {};
  const uniqueElements: CustomeFlow[] = [];

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

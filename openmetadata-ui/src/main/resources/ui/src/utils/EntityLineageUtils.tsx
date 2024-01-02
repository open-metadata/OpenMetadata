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

import { CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { AxiosError } from 'axios';
import dagre from 'dagre';
import { t } from 'i18next';
import { isEmpty, isNil, isUndefined, upperCase } from 'lodash';
import { LoadingState } from 'Models';
import React, { Fragment, MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Connection,
  Edge,
  getConnectedEdges,
  getIncomers,
  getOutgoers,
  isNode,
  MarkerType,
  Node,
  Position,
  ReactFlowInstance,
} from 'reactflow';
import { ReactComponent as DashboardIcon } from '../assets/svg/dashboard-grey.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/mlmodal.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/pipeline-grey.svg';
import { ReactComponent as TableIcon } from '../assets/svg/table-grey.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/topic-grey.svg';
import { CustomEdge } from '../components/Entity/EntityLineage/CustomEdge.component';
import CustomNodeV1 from '../components/Entity/EntityLineage/CustomNodeV1.component';
import {
  CustomEdgeData,
  CustomElement,
  CustomFlow,
  EdgeData,
  EdgeTypeEnum,
} from '../components/Entity/EntityLineage/EntityLineage.interface';
import { ExploreSearchIndex } from '../components/Explore/ExplorePage.interface';
import { EdgeDetails } from '../components/Lineage/Lineage.interface';
import Loader from '../components/Loader/Loader';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { INFO_COLOR } from '../constants/constants';
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
import { SearchIndex } from '../enums/search.enum';
import { AddLineage, EntitiesEdge } from '../generated/api/lineage/addLineage';
import { ColumnLineage, LineageDetails } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import { addLineage, deleteLineageEdge } from '../rest/miscAPI';
import {
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
  prepareLabel,
} from './CommonUtils';
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
        <Typography.Text
          className="description-text text-left text-md font-medium w-68"
          data-testid="lineage-entity"
          ellipsis={{ tooltip: true }}>
          {name || prepareLabel(type, fqn, false)}
        </Typography.Text>
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

export const getLayoutedElements = (
  elements: CustomElement,
  direction = EntityLineageDirection.LEFT_RIGHT,
  isExpanded = true
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const { node, edge } = elements;
  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  dagreGraph.setGraph({ rankdir: direction });

  const nodeIds = node.map((item) => item.id);

  node.forEach((el) => {
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

export const getModalBodyText = (selectedEdge: Edge) => {
  const { data } = selectedEdge;
  const { fromEntity, toEntity } = data.edge as EdgeDetails;
  const { isColumnLineage } = data as CustomEdgeData;
  let sourceEntity = '';
  let targetEntity = '';

  const sourceFQN = isColumnLineage ? data?.sourceHandle : fromEntity.fqn;

  const targetFQN = isColumnLineage ? data?.targetHandle : toEntity.fqn;

  const fqnPart = isColumnLineage ? FqnPart.Column : FqnPart.Table;

  if (fromEntity.type === EntityType.TABLE) {
    sourceEntity = getPartialNameFromTableFQN(sourceFQN || '', [fqnPart]);
  } else {
    sourceEntity = getPartialNameFromFQN(sourceFQN || '', ['database']);
  }

  if (toEntity.type === EntityType.TABLE) {
    targetEntity = getPartialNameFromTableFQN(targetFQN || '', [fqnPart]);
  } else {
    targetEntity = getPartialNameFromFQN(targetFQN || '', ['database']);
  }

  return t('message.remove-edge-between-source-and-target', {
    sourceDisplayName: sourceEntity,
    targetDisplayName: targetEntity,
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
    stroke: value ? INFO_COLOR : undefined,
  };
};

export const nodeTypes = {
  output: CustomNodeV1,
  input: CustomNodeV1,
  default: CustomNodeV1,
  'load-more': CustomNodeV1,
};

export const customEdges = { buttonedge: CustomEdge };

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

// Nodes Icons
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

export const getSearchIndexFromNodeType = (entityType: string) => {
  const searchIndexKey = upperCase(entityType).replace(
    ' ',
    '_'
  ) as keyof typeof SearchIndex;

  return SearchIndex[searchIndexKey] as ExploreSearchIndex;
};

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
        const toColumn = e.toColumn ?? '';
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
  const {
    sqlQuery = '',
    columns = [],
    description = '',
    pipeline,
    source,
  } = edge.data?.edge || {};

  return {
    sqlQuery,
    columnsLineage: columns,
    description,
    pipeline,
    source,
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

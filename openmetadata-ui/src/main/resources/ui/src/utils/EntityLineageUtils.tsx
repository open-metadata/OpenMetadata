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
import { graphlib, layout } from '@dagrejs/dagre';
import { AxiosError } from 'axios';
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import { t } from 'i18next';
import {
  cloneDeep,
  isEmpty,
  isEqual,
  isNil,
  isUndefined,
  uniqueId,
  uniqWith,
} from 'lodash';
import { EntityTags, LoadingState } from 'Models';
import React, { MouseEvent as ReactMouseEvent } from 'react';
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
import Loader from '../components/common/Loader/Loader';
import { CustomEdge } from '../components/Entity/EntityLineage/CustomEdge.component';
import CustomNodeV1 from '../components/Entity/EntityLineage/CustomNodeV1.component';
import {
  CustomEdgeData,
  CustomElement,
  EdgeData,
  EdgeTypeEnum,
  EntityReferenceChild,
  NodeIndexMap,
} from '../components/Entity/EntityLineage/EntityLineage.interface';
import LoadMoreNode from '../components/Entity/EntityLineage/LoadMoreNode/LoadMoreNode';
import { EntityChildren } from '../components/Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import {
  EdgeDetails,
  EntityLineageResponse,
  LineageSourceType,
} from '../components/Lineage/Lineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import {
  LINEAGE_EXPORT_HEADERS,
  NODE_HEIGHT,
  NODE_WIDTH,
  ZOOM_TRANSITION_DURATION,
  ZOOM_VALUE,
} from '../constants/Lineage.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
  EntityType,
  FqnPart,
} from '../enums/entity.enum';
import { AddLineage, EntitiesEdge } from '../generated/api/lineage/addLineage';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { SearchIndex as SearchIndexEntity } from '../generated/entity/data/searchIndex';
import { Column, Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { ColumnLineage, LineageDetails } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import { TagSource } from '../generated/type/tagLabel';
import { addLineage, deleteLineageEdge } from '../rest/miscAPI';
import { getPartialNameFromTableFQN, isDeleted } from './CommonUtils';
import { getEntityName, getEntityReferenceFromEntity } from './EntityUtils';
import Fqn from './Fqn';
import { jsonToCSV } from './StringsUtils';
import { showErrorToast } from './ToastUtils';

export const MAX_LINEAGE_LENGTH = 20;

export const encodeLineageHandles = (handle: string) => {
  return btoa(encodeURIComponent(handle));
};

export const decodeLineageHandles = (handle?: string | null) => {
  return handle ? decodeURIComponent(atob(handle)) : handle;
};

export const getColumnSourceTargetHandles = (obj: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}) => {
  const { sourceHandle, targetHandle } = obj;

  return {
    sourceHandle: decodeLineageHandles(sourceHandle),
    targetHandle: decodeLineageHandles(targetHandle),
  };
};

export const onLoad = (reactFlowInstance: ReactFlowInstance) => {
  reactFlowInstance.fitView();
  reactFlowInstance.zoomTo(ZOOM_VALUE);
};

export const centerNodePosition = (
  node: Node,
  reactFlowInstance?: ReactFlowInstance,
  zoomValue?: number
) => {
  const { position, width } = node;
  reactFlowInstance?.setCenter(
    position.x + (width ?? 1 / 2),
    position.y + NODE_HEIGHT / 2,
    {
      zoom: zoomValue ?? ZOOM_VALUE,
      duration: ZOOM_TRANSITION_DURATION,
    }
  );
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
  isExpanded = true,
  expandAllColumns = false,
  columnsHavingLineage: string[] = []
) => {
  const Graph = graphlib.Graph;
  const dagreGraph = new Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  const nodeSet = new Set(elements.node.map((item) => item.id));

  const nodeData = elements.node.map((el) => {
    const { childrenHeight } = getEntityChildrenAndLabel(
      el.data.node,
      expandAllColumns,
      columnsHavingLineage
    );
    const nodeHeight = isExpanded ? childrenHeight + 220 : NODE_HEIGHT;

    dagreGraph.setNode(el.id, {
      width: NODE_WIDTH,
      height: nodeHeight,
    });

    return {
      ...el,
      nodeHeight,
      childrenHeight,
    };
  });

  const edgesRequired = elements.edge.filter(
    (el) => nodeSet.has(el.source) && nodeSet.has(el.target)
  );
  edgesRequired.forEach((el) => dagreGraph.setEdge(el.source, el.target));

  layout(dagreGraph);

  const uNode = nodeData.map((el) => {
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

// Layout options for the elk graph https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-mrtree.html
const layoutOptions = {
  'elk.algorithm': 'mrtree',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.edgeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '100',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
};

const elk = new ELK();

export const getELKLayoutedElements = async (
  nodes: Node[],
  edges: Edge[],
  isExpanded = true,
  expandAllColumns = false,
  columnsHavingLineage: string[] = []
) => {
  const elkNodes: ElkNode[] = nodes.map((node) => {
    const { childrenHeight } = getEntityChildrenAndLabel(
      node.data.node,
      expandAllColumns,
      columnsHavingLineage
    );
    const nodeHeight = isExpanded ? childrenHeight + 220 : NODE_HEIGHT;

    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      width: NODE_WIDTH,
      height: nodeHeight,
    };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: layoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layoutedGraph = await elk.layout(graph);
    const updatedNodes: Node[] = nodes.map((node) => {
      const layoutedNode = (layoutedGraph?.children ?? []).find(
        (elkNode) => elkNode.id === node.id
      );

      return {
        ...node,
        position: { x: layoutedNode?.x ?? 0, y: layoutedNode?.y ?? 0 },
        hidden: false,
      };
    });

    return { nodes: updatedNodes, edges: edges ?? [] };
  } catch (error) {
    return { nodes: [], edges: [] };
  }
};

export const getModalBodyText = (selectedEdge: Edge) => {
  const { data } = selectedEdge;
  const { fromEntity, toEntity } = data.edge as EdgeDetails;
  const { sourceHandle = '', targetHandle = '' } =
    getColumnSourceTargetHandles(selectedEdge);

  const { isColumnLineage } = data as CustomEdgeData;
  let sourceEntity = '';
  let targetEntity = '';

  const sourceFQN = isColumnLineage ? sourceHandle : fromEntity.fqn;
  const targetFQN = isColumnLineage ? targetHandle : toEntity.fqn;
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
      const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(e);
      const id = isIncomer ? targetHandle : sourceHandle;

      return id === selectedColumn;
    })
    .map((e) => {
      const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(e);

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

export const nodeTypes = {
  output: CustomNodeV1,
  input: CustomNodeV1,
  default: CustomNodeV1,
  'load-more': LoadMoreNode,
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

const calculateHeightAndFlattenNode = (
  children: Column[],
  expandAllColumns = false,
  columnsHavingLineage: string[] = []
): { totalHeight: number; flattened: Column[] } => {
  let totalHeight = 0;
  let flattened: Column[] = [];

  children.forEach((child) => {
    if (
      expandAllColumns ||
      columnsHavingLineage.indexOf(child.fullyQualifiedName ?? '') !== -1
    ) {
      totalHeight += 31; // Add height for the current child
    }
    flattened.push(child);

    if (child.children && child.children.length > 0) {
      totalHeight += 8; // Add child padding
      const childResult = calculateHeightAndFlattenNode(
        child.children,
        expandAllColumns,
        columnsHavingLineage
      );
      totalHeight += childResult.totalHeight;
      flattened = flattened.concat(childResult.flattened);
    }
  });

  return { totalHeight, flattened };
};

/**
 * This function returns all the columns as children as well flattened children for subfield columns.
 * It also returns the label for the children and the total height of the children.
 *
 * @param {Node} selectedNode - The node for which to retrieve the downstream nodes and edges.
 * @param {string[]} columnsHavingLineage - All nodes in the lineage.
 * @return {{ nodes: Node[]; edges: Edge[], nodeIds: string[], edgeIds: string[] }} -
 * An object containing the downstream nodes and edges.
 */
export const getEntityChildrenAndLabel = (
  node: SourceType,
  expandAllColumns = false,
  columnsHavingLineage: string[] = []
) => {
  if (!node) {
    return {
      children: [],
      childrenHeading: '',
      childrenHeight: 0,
      childrenFlatten: [],
    };
  }
  const entityMappings: Record<
    string,
    { data: EntityChildren; label: string }
  > = {
    [EntityType.TABLE]: {
      data: (node as Table).columns ?? [],
      label: t('label.column-plural'),
    },
    [EntityType.DASHBOARD]: {
      data: (node as Dashboard).charts ?? [],
      label: t('label.chart-plural'),
    },
    [EntityType.MLMODEL]: {
      data: (node as Mlmodel).mlFeatures ?? [],
      label: t('label.feature-plural'),
    },
    [EntityType.DASHBOARD_DATA_MODEL]: {
      data: (node as Table).columns ?? [],
      label: t('label.column-plural'),
    },
    [EntityType.CONTAINER]: {
      data: (node as Container).dataModel?.columns ?? [],
      label: t('label.column-plural'),
    },
    [EntityType.TOPIC]: {
      data: (node as Topic).messageSchema?.schemaFields ?? [],
      label: t('label.field-plural'),
    },
    [EntityType.API_ENDPOINT]: {
      data: (node as APIEndpoint)?.responseSchema?.schemaFields ?? [],
      label: t('label.field-plural'),
    },
    [EntityType.SEARCH_INDEX]: {
      data: (node as SearchIndexEntity).fields ?? [],
      label: t('label.field-plural'),
    },
  };

  const { data, label } = entityMappings[node.entityType as EntityType] || {
    data: [],
    label: '',
  };

  const { totalHeight, flattened } = calculateHeightAndFlattenNode(
    data as Column[],
    expandAllColumns,
    columnsHavingLineage
  );

  return {
    children: data,
    childrenHeading: label,
    childrenHeight: totalHeight,
    childrenFlatten: flattened,
  };
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
    // Check if the node is not null before adding it to the map
    if (node?.fullyQualifiedName) {
      uniqueNodesMap.set(node.fullyQualifiedName, node);
    }
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

export const positionNodesUsingElk = async (
  nodes: Node[],
  edges: Edge[],
  isColView: boolean,
  expandAllColumns = false,
  columnsHavingLineage: string[] = []
) => {
  const obj = await getELKLayoutedElements(
    nodes,
    edges,
    isColView,
    expandAllColumns,
    columnsHavingLineage
  );

  return obj;
};

export const createNodes = (
  nodesData: EntityReference[],
  edgesData: EdgeDetails[],
  entityFqn: string,
  isExpanded = false
) => {
  const uniqueNodesData = removeDuplicateNodes(nodesData).sort((a, b) =>
    getEntityName(a).localeCompare(getEntityName(b))
  );

  return uniqueNodesData.map((node) => {
    const { childrenHeight } = getEntityChildrenAndLabel(node as SourceType);
    const type =
      node.type === EntityLineageNodeType.LOAD_MORE
        ? node.type
        : getNodeType(edgesData, node.id);

    // we are getting deleted as a string instead of boolean from API so need to handle it like this
    node.deleted = isDeleted(node.deleted);

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: type,
      className: '',
      data: {
        node,
        isRootNode: entityFqn === node.fullyQualifiedName,
      },
      width: NODE_WIDTH,
      height: isExpanded ? childrenHeight + 220 : NODE_HEIGHT,
      position: {
        x: 0,
        y: 0,
      },
    };
  });
};

export const createEdges = (
  nodes: EntityReference[],
  edges: EdgeDetails[],
  entityFqn: string
) => {
  const lineageEdgesV1: Edge[] = [];
  const edgeIds = new Set<string>();
  const columnsHavingLineage = new Set<string>();

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
            columnsHavingLineage.add(fromColumn);
            columnsHavingLineage.add(toColumn);
            const encodedFromColumn = encodeLineageHandles(fromColumn);
            const encodedToColumn = encodeLineageHandles(toColumn);
            const edgeId = `column-${encodedFromColumn}-${encodedToColumn}-edge-${edge.fromEntity.id}-${edge.toEntity.id}`;

            if (!edgeIds.has(edgeId)) {
              edgeIds.add(edgeId);
              lineageEdgesV1.push({
                id: edgeId,
                source: edge.fromEntity.id,
                target: edge.toEntity.id,
                targetHandle: encodedToColumn,
                sourceHandle: encodedFromColumn,
                style: { strokeWidth: '2px' },
                type: 'buttonedge',
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                },
                data: {
                  edge,
                  isColumnLineage: true,
                  targetHandle: encodedToColumn,
                  sourceHandle: encodedFromColumn,
                },
              });
            }
          });
        }
      });
    }

    const edgeId = `edge-${edge.fromEntity.id}-${edge.toEntity.id}`;
    if (!edgeIds.has(edgeId)) {
      edgeIds.add(edgeId);
      lineageEdgesV1.push({
        id: edgeId,
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
          isPipelineRootNode: !isNil(edge.pipeline)
            ? entityFqn === edge.pipeline?.fullyQualifiedName
            : false,
        },
      });
    }
  });

  return {
    edges: lineageEdgesV1,
    columnsHavingLineage: Array.from(columnsHavingLineage),
  };
};

export const getColumnLineageData = (
  columnsData: ColumnLineage[],
  data: Edge
) => {
  const columnsLineage = columnsData?.reduce((col, curr) => {
    const sourceHandle = decodeLineageHandles(data.data?.sourceHandle);
    const targetHandle = decodeLineageHandles(data.data?.targetHandle);

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
        fqn: sourceFqn ?? '',
      },
      toEntity: {
        id: targetId ?? '',
        type: targetType ?? '',
        fqn: targetFqn ?? '',
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
  selectedEdge.edge.lineageDetails = getLineageDetailsObject(edge);
  selectedEdge.edge.lineageDetails.columnsLineage = updatedCols;

  return selectedEdge;
};

export const getUpstreamDownstreamNodesEdges = (
  edges: EdgeDetails[],
  nodes: EntityReference[],
  currentNode: string
) => {
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
      (edge) => edge.fromEntity.fqn === node.fullyQualifiedName
    );
    downstreamEdges.push(...directDownstream);
    directDownstream.forEach((edge) => {
      const toNode = nodes.find(
        (item) => item.fullyQualifiedName === edge.toEntity.fqn
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
      (edge) => edge.toEntity.fqn === node.fullyQualifiedName
    );
    upstreamEdges.push(...directUpstream);
    directUpstream.forEach((edge) => {
      const fromNode = nodes.find(
        (item) => item.fullyQualifiedName === edge.fromEntity.fqn
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
};

export const getLineageChildParents = (
  obj: EntityLineageResponse,
  nodeSet: Set<string>,
  parsedNodes: LineageSourceType[],
  id: string,
  isParent = false,
  index = 0, // page index
  depth = 1 // depth of lineage
) => {
  const edges = isParent ? obj.upstreamEdges || [] : obj.downstreamEdges || [];
  const filtered = edges.filter((edge) => {
    return isParent ? edge.toEntity.id === id : edge.fromEntity.id === id;
  });

  return filtered.reduce((childMap: EntityReferenceChild[], edge, i) => {
    const node = obj.nodes?.find((node) => {
      return isParent
        ? node.id === edge.fromEntity.id
        : node.id === edge.toEntity.id;
    });

    if (node && !nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      parsedNodes.push({
        ...(node as SourceType),
        direction: isParent ? 'upstream' : 'downstream',
        depth: depth,
      });
      const childNodes = getLineageChildParents(
        obj,
        nodeSet,
        parsedNodes,
        node.id,
        isParent,
        i,
        depth + 1
      );
      const lineage: EntityReferenceChild = { ...node, pageIndex: index + i };

      if (isParent) {
        lineage.parents = childNodes;
      } else {
        lineage.children = childNodes;
      }

      childMap.push(lineage);
    }

    return childMap;
  }, []);
};

export const removeDuplicates = (arr: EdgeDetails[] = []) => {
  return uniqWith(arr, isEqual);
};

export const getExportEntity = (entity: LineageSourceType) => {
  const {
    name,
    displayName = '',
    fullyQualifiedName = '',
    entityType = '',
    direction = '',
    owners,
    domain,
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
    domain: domain?.fullyQualifiedName ?? '',
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

export const getChildMap = (obj: EntityLineageResponse, decodedFqn: string) => {
  const nodeSet = new Set<string>();
  nodeSet.add(obj.entity.id);
  const parsedNodes: LineageSourceType[] = [];

  const data = getUpstreamDownstreamNodesEdges(
    obj.edges ?? [],
    obj.nodes ?? [],
    decodedFqn
  );

  const newData = cloneDeep(obj);
  newData.downstreamEdges = removeDuplicates(data.downstreamEdges);
  newData.upstreamEdges = removeDuplicates(data.upstreamEdges);

  const childMap: EntityReferenceChild[] = getLineageChildParents(
    newData,
    nodeSet,
    parsedNodes,
    obj.entity.id,
    false
  );

  const parentsMap: EntityReferenceChild[] = getLineageChildParents(
    newData,
    nodeSet,
    parsedNodes,
    obj.entity.id,
    true
  );

  const map: EntityReferenceChild = {
    ...obj.entity,
    children: childMap,
    parents: parentsMap,
  };

  return {
    map,
    exportResult: getExportData(parsedNodes) ?? '',
  };
};

export const flattenObj = (
  entityObj: EntityLineageResponse,
  childMapObj: EntityReferenceChild,
  id: string,
  nodes: EntityReference[],
  edges: EdgeDetails[],
  pagination_data: Record<string, NodeIndexMap>,
  config: { downwards: boolean; maxLineageLength?: number }
) => {
  const { downwards, maxLineageLength = 50 } = config;

  const children = downwards ? childMapObj.children : childMapObj.parents;
  if (!children) {
    return;
  }
  const startIndex =
    pagination_data[id]?.[downwards ? 'downstream' : 'upstream'][0] ?? 0;
  const hasMoreThanLimit = children.length > startIndex + maxLineageLength;
  const endIndex = startIndex + maxLineageLength;

  children.slice(0, endIndex).forEach((item) => {
    if (item) {
      flattenObj(entityObj, item, item.id, nodes, edges, pagination_data, {
        downwards,
        maxLineageLength,
      });
      nodes.push(item);
    }
  });

  if (hasMoreThanLimit) {
    const newNodeId = `loadmore_${uniqueId('node_')}_${id}_${startIndex}`;
    const childrenLength = children.length - endIndex;

    const newNode = {
      description: 'Demo description',
      displayName: 'Load More',
      name: `load_more_${id}`,
      fullyQualifiedName: `load_more_${id}`,
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
    const newEdge: EdgeDetails = {
      fromEntity: {
        fqn: '',
        id: downwards ? id : newNodeId,
        type: '',
      },
      toEntity: {
        fqn: '',
        id: downwards ? newNodeId : id,
        type: '',
      },
    };
    edges.push(newEdge);
  }
};

export const getPaginatedChildMap = (
  obj: EntityLineageResponse,
  map: EntityReferenceChild | undefined,
  pagination_data: Record<string, NodeIndexMap>,
  maxLineageLength: number
) => {
  const nodes = [];
  const edges: EdgeDetails[] = [];
  nodes.push(obj.entity);
  if (map) {
    flattenObj(obj, map, obj.entity.id, nodes, edges, pagination_data, {
      downwards: true,
      maxLineageLength,
    });
    flattenObj(obj, map, obj.entity.id, nodes, edges, pagination_data, {
      downwards: false,
      maxLineageLength,
    });
  }

  return { nodes, edges };
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

export const parseLineageData: (
  data: any,
  entityFqn: string
) => {
  nodes: EntityReference[];
  edges: EdgeDetails[];
  entity: EntityReference;
} = (data: any, entityFqn: string) => {
  const { nodes, downstreamEdges, upstreamEdges } = data;

  const nodesArray: EntityReference[] = Object.values(
    nodes
  ) as EntityReference[];

  const entity: EntityReference = nodesArray.find(
    (node) => node.fullyQualifiedName === entityFqn
  ) as EntityReference;

  const downstreamEdgesArray: EdgeDetails[] = Object.values(
    downstreamEdges
  ) as EdgeDetails[];
  const upstreamEdgesArray: EdgeDetails[] = Object.values(
    upstreamEdges
  ) as EdgeDetails[];

  return {
    nodes: nodesArray,
    edges: [...downstreamEdgesArray, ...upstreamEdgesArray],
    entity,
  };
};

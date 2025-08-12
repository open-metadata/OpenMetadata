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
import { Typography } from 'antd';
import { ColumnsType } from 'antd/es/table';
import { AxiosError } from 'axios';
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import {
  get,
  isEmpty,
  isEqual,
  isNil,
  isUndefined,
  uniqueId,
  uniqWith,
} from 'lodash';
import { EntityTags, LoadingState } from 'Models';
import { MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Connection,
  Edge,
  getBezierPath,
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
import { ExportViewport } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { CustomEdge } from '../components/Entity/EntityLineage/CustomEdge.component';
import CustomNodeV1 from '../components/Entity/EntityLineage/CustomNodeV1.component';
import {
  CustomEdgeData,
  CustomElement,
  EdgeData,
} from '../components/Entity/EntityLineage/EntityLineage.interface';
import LoadMoreNode from '../components/Entity/EntityLineage/LoadMoreNode/LoadMoreNode';
import { EntityChildren } from '../components/Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import {
  EdgeDetails,
  LineageData,
  LineageEntityReference,
  LineageSourceType,
  NodeData,
} from '../components/Lineage/Lineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import {
  LINEAGE_EXPORT_HEADERS,
  LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS,
  NODE_HEIGHT,
  NODE_WIDTH,
  ZOOM_TRANSITION_DURATION,
  ZOOM_VALUE,
} from '../constants/Lineage.constants';
import { LineagePlatformView } from '../context/LineageProvider/LineageProvider.interface';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
  EntityType,
  FqnPart,
} from '../enums/entity.enum';
import { AddLineage, EntitiesEdge } from '../generated/api/lineage/addLineage';
import { LineageDirection } from '../generated/api/lineage/lineageDirection';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex as SearchIndexEntity } from '../generated/entity/data/searchIndex';
import { Column, Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { ColumnLineage, LineageDetails } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import { TagSource } from '../generated/type/tagLabel';
import { addLineage, deleteLineageEdge } from '../rest/miscAPI';
import entityUtilClassBase from '../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../utils/ServiceUtilClassBase';
import { getPartialNameFromTableFQN, isDeleted } from './CommonUtils';
import { getEntityName, getEntityReferenceFromEntity } from './EntityUtils';
import Fqn from './Fqn';
import { t } from './i18next/LocalUtil';
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
        // layoutedNode contains the total height of the node including the children height
        // Needed to calculate the bounds height of the nodes in the export
        height: layoutedNode?.height ?? node.height,
        hidden: false,
      };
    });

    return { nodes: updatedNodes, edges: edges ?? [] };
  } catch {
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

export const getLoadingStatusValue = (
  defaultState: string | JSX.Element,
  loading: boolean,
  status: LoadingState
) => {
  if (loading) {
    return <Loader className="text-primary" size="small" />;
  } else if (status === 'success') {
    return <CheckOutlined className="text-primary" />;
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

  // Create a Set for O(1) lookups
  const tracedEdgeIds = new Set<string>();

  // Process edges in a single pass
  for (const e of edges) {
    const id = isIncomer ? e.target : e.source;
    if (id === node.id) {
      const targetId = isIncomer ? e.source : e.target;

      // Handle compound IDs (extracting the base node ID)
      const matches = /([\w-^]+)__([\w-]+)/.exec(targetId);
      tracedEdgeIds.add(matches ? matches[1] : targetId);
    }
  }

  // Filter nodes only once
  return nodes.filter((n) => tracedEdgeIds.has(n.id));
};

export const getAllTracedNodes = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  prevTraced = [] as Node[],
  isIncomer: boolean
) => {
  // Create a set to track visited node IDs for O(1) lookups
  const visitedNodeIds = new Set<string>(prevTraced.map((n) => n.id));
  const result: Node[] = [];

  // Use a queue for breadth-first traversal (more efficient than recursion)
  const queue: Node[] = [node];

  while (queue.length > 0) {
    const currentNode = queue.shift()!;

    // Skip the initial node as we only want connected nodes
    if (currentNode !== node) {
      result.push(currentNode);
    }

    // Get all connected nodes in the specified direction
    const connectedNodes = getTracedNode(currentNode, nodes, edges, isIncomer);

    for (const connectedNode of connectedNodes) {
      // Only process nodes we haven't visited yet
      if (!visitedNodeIds.has(connectedNode.id)) {
        visitedNodeIds.add(connectedNode.id);
        queue.push(connectedNode);
      }
    }
  }

  // Update prevTraced by reference (to maintain original API behavior)
  for (const nodeId of visitedNodeIds) {
    if (!prevTraced.some((n) => n.id === nodeId)) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        prevTraced.push(node);
      }
    }
  }

  return result;
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
  // Use a Set for O(1) lookups and uniqueness
  const visitedEdgeIds = new Set<string>(prevTraced);
  const result: string[] = [];

  // Use a queue for breadth-first traversal
  const queue: string[] = [selectedColumn];

  while (queue.length > 0) {
    const currentColumn = queue.shift()!;

    // Skip the initial column
    if (currentColumn !== selectedColumn) {
      result.push(currentColumn);
    }

    // Get directly connected edges
    const connectedEdges = getTracedEdge(currentColumn, edges, isIncomer);

    for (const connectedEdge of connectedEdges) {
      if (!visitedEdgeIds.has(connectedEdge) && connectedEdge) {
        visitedEdgeIds.add(connectedEdge);
        queue.push(connectedEdge);
      }
    }
  }

  // Update prevTraced by reference to maintain API compatibility
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
      data:
        (node as APIEndpoint)?.responseSchema?.schemaFields ??
        (node as APIEndpoint)?.requestSchema?.schemaFields ??
        [],
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
  nodesData: LineageEntityReference[],
  edgesData: EdgeDetails[],
  entityFqn: string,
  incomingMap: Map<string, number>,
  outgoingMap: Map<string, number>,
  isExpanded = false,
  hidden?: boolean
) => {
  const uniqueNodesMap = new Map<string, LineageEntityReference>();
  nodesData.forEach((node) => {
    if (node?.fullyQualifiedName) {
      uniqueNodesMap.set(node.fullyQualifiedName, node);
    }
  });

  // Convert to array and sort once
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
    // Mark deleted nodes
    node.deleted = isDeleted(node.deleted);

    const type =
      node.type === EntityLineageNodeType.LOAD_MORE
        ? node.type
        : getNodeType(edgesData, node.id);

    const nodeHeight = isExpanded
      ? getEntityChildrenAndLabel(node as SourceType).childrenHeight + 220
      : NODE_HEIGHT;

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type,
      className: '',
      data: {
        node,
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

export const createEdgesAndEdgeMaps = (
  nodes: EntityReference[],
  edges: EdgeDetails[],
  entityFqn: string,
  isColumnLayerActive: boolean,
  hidden?: boolean
) => {
  const lineageEdgesV1: Edge[] = [];
  const edgeIds = new Set<string>();
  const columnsHavingLineage = new Set<string>();
  const incomingMap = new Map<string, number>();
  const outgoingMap = new Map<string, number>();

  edges.forEach((edge) => {
    const sourceId = edge.fromEntity.id;
    const targetId = edge.toEntity.id;

    const sourceType = nodes.find((n) => sourceId === n.id);
    const targetType = nodes.find((n) => targetId === n.id);

    if (isUndefined(sourceType) || isUndefined(targetType)) {
      return;
    }

    // Update edge maps for fast lookup
    outgoingMap.set(sourceId, (outgoingMap.get(sourceId) ?? 0) + 1);
    incomingMap.set(targetId, (incomingMap.get(targetId) ?? 0) + 1);

    if (!isUndefined(edge.columns) && isColumnLayerActive) {
      edge.columns?.forEach((e) => {
        const toColumn = e.toColumn ?? '';
        if (toColumn && e.fromColumns?.length) {
          e.fromColumns.forEach((fromColumn) => {
            columnsHavingLineage.add(fromColumn);
            columnsHavingLineage.add(toColumn);

            const encodedFrom = encodeLineageHandles(fromColumn);
            const encodedTo = encodeLineageHandles(toColumn);
            const edgeId = `column-${encodedFrom}-${encodedTo}-edge-${sourceId}-${targetId}`;

            if (!edgeIds.has(edgeId)) {
              edgeIds.add(edgeId);
              lineageEdgesV1.push({
                id: edgeId,
                source: sourceId,
                target: targetId,
                targetHandle: encodedTo,
                sourceHandle: encodedFrom,
                style: { strokeWidth: '2px' },
                type: 'buttonedge',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: {
                  edge,
                  isColumnLineage: true,
                  targetHandle: encodedTo,
                  sourceHandle: encodedFrom,
                  dataTestId: `column-edge-${encodedFrom}-${encodedTo}`,
                },
                ...(hidden && { hidden }),
              });
            }
          });
        }
      });
    }

    const edgeId = `edge-${sourceId}-${targetId}`;
    if (!edgeIds.has(edgeId)) {
      edgeIds.add(edgeId);
      lineageEdgesV1.push({
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
      });
    }
  });

  return {
    edges: lineageEdgesV1,
    columnsHavingLineage: Array.from(columnsHavingLineage),
    incomingMap,
    outgoingMap,
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

      // Removing the Root Node from the Child Nodes here, which comes when a cycle lineage is formed
      // So while collapsing the cycle lineage, we need to prevent the Root Node not to be removed.
      const finalChildNodeRemovingRootNode = childNodes.filter(
        (item) => !item.data.isRootNode
      );

      stack.push(...finalChildNodeRemovingRootNode);
      outgoers.push(...finalChildNodeRemovingRootNode);
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
  selectedEdge.edge.lineageDetails = getLineageDetailsObject(
    edge
  ) as AddLineage['edge']['lineageDetails'];
  (selectedEdge.edge.lineageDetails as LineageDetails).columnsLineage =
    updatedCols;

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

const createLoadMoreNode = (
  parentNode: LineageEntityReference,
  currentCount: number,
  totalCount: number,
  direction: LineageDirection
): LineageEntityReference => {
  const uniqueNodeId = uniqueId('node');
  const newNodeId = `loadmore_${uniqueNodeId}`;

  return {
    id: newNodeId,
    type: EntityLineageNodeType.LOAD_MORE,
    name: `load_more_${uniqueNodeId}_${parentNode.id}`,
    displayName: 'Load More',
    fullyQualifiedName: `load_more_${uniqueNodeId}_${parentNode.id}`,
    pagination_data: {
      index: currentCount,
      parentId: parentNode.id,
      childrenLength: totalCount - currentCount,
    },
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
  node: LineageEntityReference,
  edges: Record<string, EdgeDetails>,
  isDownstream: boolean
): { newNode?: LineageEntityReference; newEdge?: EdgeDetails } => {
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
  nodes: Record<string, NodeData>,
  entityFqn: string
): LineageEntityReference[] => {
  return Object.values(nodes)
    .map((node: NodeData) => ({
      ...node.entity,
      paging: {
        entityUpstreamCount: node.paging?.entityUpstreamCount ?? 0,
        entityDownstreamCount: node.paging?.entityDownstreamCount ?? 0,
      },
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
    }))
    .flat();
};

const processPipelineEdge = (edge: EdgeDetails, pipelineNode: Pipeline) => {
  const pipelineEntityType = get(pipelineNode, 'entityType');

  // Create two edges: fromEntity -> pipeline and pipeline -> toEntity
  const edgeFromToPipeline = {
    fromEntity: edge.fromEntity,
    toEntity: {
      id: pipelineNode.id,
      type: pipelineEntityType,
      fullyQualifiedName: pipelineNode.fullyQualifiedName ?? '',
    },
    extraInfo: edge,
  };

  const edgePipelineToTo = {
    fromEntity: {
      id: pipelineNode.id,
      type: pipelineEntityType,
      fullyQualifiedName: pipelineNode.fullyQualifiedName ?? '',
    },
    toEntity: edge.toEntity,
    extraInfo: edge,
  };

  return [edgeFromToPipeline, edgePipelineToTo];
};

const processEdges = (
  edges: EdgeDetails[],
  nodesArray: LineageEntityReference[]
): EdgeDetails[] => {
  return edges.reduce<EdgeDetails[]>(
    (acc: EdgeDetails[], edge: EdgeDetails) => {
      if (!edge.pipeline) {
        return [...acc, edge];
      }

      // Find if pipeline node exists
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
  nodesArray: LineageEntityReference[],
  downstreamEdges: Record<string, EdgeDetails>,
  upstreamEdges: Record<string, EdgeDetails>
): {
  newNodes: LineageEntityReference[];
  newEdges: EdgeDetails[];
} => {
  const newNodes: LineageEntityReference[] = [];
  const newEdges: EdgeDetails[] = [];

  const eligibleNodes = nodesArray.filter(
    (node) =>
      ![EntityType.PIPELINE, EntityType.STORED_PROCEDURE].includes(
        get(node, 'entityType')
      )
  );

  eligibleNodes.forEach((node) => {
    // Handle downstream pagination
    const downstream = handleNodePagination(node, downstreamEdges, true);
    if (downstream.newNode && downstream.newEdge) {
      newNodes.push(downstream.newNode);
      newEdges.push(downstream.newEdge);
    }

    // Handle upstream pagination
    const upstream = handleNodePagination(node, upstreamEdges, false);
    if (upstream.newNode && upstream.newEdge) {
      newNodes.push(upstream.newNode);
      newEdges.push(upstream.newEdge);
    }
  });

  return { newNodes, newEdges };
};

export const parseLineageData = (
  data: LineageData,
  entityFqn: string, // This contains fqn of node or entity that is being viewed in lineage page
  rootFqn: string // This contains the fqn of the entity that is being viewed in lineage page
): {
  nodes: LineageEntityReference[];
  edges: EdgeDetails[];
  entity: LineageEntityReference;
} => {
  const { nodes, downstreamEdges, upstreamEdges } = data;

  // Process nodes
  const nodesArray = uniqWith(processNodeArray(nodes, rootFqn), isEqual);

  const processedNodes: LineageEntityReference[] = [...nodesArray];

  // Process edges
  const allEdges = [
    ...Object.values(downstreamEdges),
    ...Object.values(upstreamEdges),
  ];
  const processedEdges = processEdges(allEdges, nodesArray);

  // Handle pagination
  const { newNodes, newEdges } = processPagination(
    nodesArray,
    downstreamEdges,
    upstreamEdges
  );

  // Combine all nodes and edges
  const finalNodes = [...processedNodes, ...newNodes];
  const finalEdges = [
    ...(processedEdges as unknown as EdgeDetails[]),
    ...newEdges,
  ];

  // Find the main entity
  const entity = nodesArray.find(
    (node) => node.fullyQualifiedName === entityFqn
  ) as EntityReference;

  return {
    nodes: finalNodes,
    edges: finalEdges,
    entity,
  };
};

interface EdgeAlignmentPathDataProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

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
    // modify the edge path data as per the self connecting edges behavior
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
    edgePath: getEdgePath(edgePath, source, target, edgePathData), // pass the initial data edgePathData, as edge modification will be done based on the initial data
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

export const removeUnconnectedNodes = (
  edgeData: { fromId: string; toId: string },
  nodes: Node[],
  edges: Edge[]
): Node[] => {
  const targetNode = nodes?.find((n) => edgeData.toId === n.id);
  const sourceNode = nodes?.find((n) => edgeData.fromId === n.id);
  let updatedNodes = [...nodes];

  if (targetNode && sourceNode) {
    // Check both incoming and outgoing edges for source node
    const outgoersSourceNode = getOutgoers(sourceNode, nodes, edges);
    const incomersSourceNode = getIncomers(sourceNode, nodes, edges);

    // Check both incoming and outgoing edges for target node
    const outgoersTargetNode = getOutgoers(targetNode, nodes, edges);
    const incomersTargetNode = getIncomers(targetNode, nodes, edges);

    // Remove source node if it has no other connections
    if (outgoersSourceNode.length + incomersSourceNode.length <= 1) {
      updatedNodes = updatedNodes.filter((n) => n.id !== sourceNode.id);
    }

    // Remove target node if it has no other connections
    if (outgoersTargetNode.length + incomersTargetNode.length <= 1) {
      updatedNodes = updatedNodes.filter((n) => n.id !== targetNode.id);
    }
  }

  return updatedNodes;
};

// Helper function to calculate bounds for all nodes
export const getNodesBoundsReactFlow = (nodes: Node[]) => {
  const bounds = {
    xMin: Infinity,
    yMin: Infinity,
    xMax: -Infinity,
    yMax: -Infinity,
  };

  nodes.forEach((node) => {
    const { x, y } = node.position;
    const width = node.width ?? 0;
    const height = node.height ?? 0;

    // Add padding to ensure nodes are fully visible
    const padding = 20;

    bounds.xMin = Math.min(bounds.xMin, x - padding);
    bounds.yMin = Math.min(bounds.yMin, y - padding);
    bounds.xMax = Math.max(bounds.xMax, x + width + padding);
    bounds.yMax = Math.max(bounds.yMax, y + height + padding);
  });

  return bounds;
};

// Helper function to calculate the viewport for the full React Flow Graph
export const getViewportForBoundsReactFlow = (
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number },
  imageWidth: number,
  imageHeight: number,
  scaleFactor = 1
) => {
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;

  // Add extra padding to ensure content is fully visible
  const padding = 20;
  const paddedWidth = width + padding * 2;
  const paddedHeight = height + padding * 2;

  // Scale the image to fit the container while maintaining aspect ratio
  const scale =
    Math.min(
      (imageWidth - padding * 2) / paddedWidth,
      (imageHeight - padding * 2) / paddedHeight
    ) * scaleFactor;

  // Calculate translation to center the flow
  const translateX =
    (imageWidth - paddedWidth * scale) / 2 - bounds.xMin * scale;
  const translateY =
    (imageHeight - paddedHeight * scale) / 2 - bounds.yMin * scale;

  return { x: translateX, y: translateY, zoom: scale };
};

export const getViewportForLineageExport = (
  nodes: Node[],
  documentSelector: string
): ExportViewport => {
  const exportElement = document.querySelector(documentSelector) as HTMLElement;

  const imageWidth = exportElement.scrollWidth;
  const imageHeight = exportElement.scrollHeight;

  const nodesBounds = getNodesBoundsReactFlow(nodes);

  // Calculate the viewport to fit all nodes with padding
  return getViewportForBoundsReactFlow(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.9
  ); // Scale down slightly to ensure padding
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

/**
 * Recursively finds all downstream edges from a given node in a graph.
 * This function traverses the graph depth-first, collecting all edges that flow downstream
 * from the specified node while avoiding cycles by tracking visited nodes.
 *
 * @param {string} nodeId - The ID of the starting node
 * @param {Edge[]} edges - Array of all edges in the graph
 * @param {Set<string>} [visitedNodes=new Set()] - Set of already visited node IDs to prevent cycles
 * @returns {Edge[]} Array of all downstream edges from the starting node
 */
export const getAllDownstreamEdges = (
  nodeId: string,
  edges: Edge[],
  visitedNodes: Set<string> = new Set()
): Edge[] => {
  // If we've already visited this node, return empty array to avoid cycles
  if (visitedNodes.has(nodeId)) {
    return [];
  }

  visitedNodes.add(nodeId);

  // Get direct downstream edges
  const directDownstreamEdges = edges.filter((edge) => edge.source === nodeId);

  // Get target nodes from direct downstream edges
  const targetNodes = directDownstreamEdges.map((edge) => edge.target);

  // Recursively get downstream edges for each target node
  const nestedDownstreamEdges = targetNodes.flatMap((targetNodeId) =>
    getAllDownstreamEdges(targetNodeId, edges, visitedNodes)
  );

  // Combine direct and nested downstream edges
  return [...directDownstreamEdges, ...nestedDownstreamEdges];
};

const buildLineageTableColumns = (headers: string[]): ColumnsType<string> => {
  // Field groups we want to combine
  const FROM_FIELDS = ['fromEntityFQN', 'fromServiceName', 'fromServiceType'];
  const TO_FIELDS = ['toEntityFQN', 'toServiceName', 'toServiceType'];

  const renderCombined = (fqn: string, serviceType: string) => (
    <div className="d-flex items-center gap-2">
      <img
        alt={fqn}
        className="header-icon"
        src={serviceUtilClassBase.getServiceLogo(serviceType)}
      />
      <Typography.Text
        className="text-primary font-semibold"
        ellipsis={{ tooltip: true }}>
        {isEmpty(fqn) ? NO_DATA_PLACEHOLDER : fqn}
      </Typography.Text>
    </div>
  );

  const columns: ColumnsType<string> = [];
  columns.push(
    ...([
      {
        title: t('label.from-entity'),
        dataIndex: 'fromCombined',
        key: 'fromCombined',
        width: 300,
        ellipsis: { showTitle: false },
        render: (_: string, record: Record<string, string>) => (
          <Link
            to={entityUtilClassBase.getEntityLink(
              serviceUtilClassBase.getEntityTypeFromServiceType(
                record.fromServiceType ?? ''
              ),
              record.fromEntityFQN || ''
            )}>
            {renderCombined(record.fromEntityFQN, record.fromServiceType)}
          </Link>
        ),
      },
      {
        title: t('label.to-entity'),
        dataIndex: 'toCombined',
        key: 'toCombined',
        width: 300,
        ellipsis: { showTitle: false },
        render: (_: string, record: Record<string, string>) => (
          <Link
            to={entityUtilClassBase.getEntityLink(
              serviceUtilClassBase.getEntityTypeFromServiceType(
                record.toServiceType ?? ''
              ),
              record.toEntityFQN || ''
            )}>
            {renderCombined(record.toEntityFQN, record.toServiceType)}
          </Link>
        ),
      },
    ] as unknown as ColumnsType<string>[number][])
  );

  // Append remaining header-driven columns
  headers.forEach((header) => {
    if ([...FROM_FIELDS, ...TO_FIELDS].includes(header)) {
      return;
    }

    columns.push({
      title: LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS[header],
      dataIndex: header,
      key: header,
      width: 200,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Typography.Text
          data-testid={`lineage-column-${header}-${text}`}
          ellipsis={{ tooltip: true }}>
          {isEmpty(text) ? NO_DATA_PLACEHOLDER : text}
        </Typography.Text>
      ),
    });
  });

  return columns;
};

export const getLineageTableConfig = (
  csvData: string[][]
): {
  columns: ColumnsType<string>;
  dataSource: Record<string, string>[];
} => {
  if (!csvData || csvData.length < 2) {
    return {
      columns: [],
      dataSource: [],
    };
  }

  const [headers, ...rows] = csvData;

  const dataSource = rows.map((row, index) => {
    const rowData: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      rowData[header] = row[headerIndex] || '';
    });
    rowData.key = index.toString();

    return rowData;
  });

  const columns = buildLineageTableColumns(headers);

  return { columns, dataSource };
};

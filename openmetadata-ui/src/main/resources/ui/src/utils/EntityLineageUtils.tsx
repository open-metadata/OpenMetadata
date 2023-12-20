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
import { isEmpty, isUndefined, upperCase } from 'lodash';
import { LoadingState } from 'Models';
import React, { Fragment, MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Edge, isNode, Node, Position, ReactFlowInstance } from 'reactflow';
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
} from '../components/Entity/EntityLineage/EntityLineage.interface';
import { ExploreSearchIndex } from '../components/Explore/ExplorePage.interface';
import { EdgeDetails } from '../components/Lineage/Lineage.interface';
import Loader from '../components/Loader/Loader';
import { INFO_COLOR } from '../constants/constants';
import {
  EXPANDED_NODE_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  ZOOM_VALUE,
} from '../constants/Lineage.constants';
import {
  EntityLineageDirection,
  EntityType,
  FqnPart,
} from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { AddLineage } from '../generated/api/lineage/addLineage';
import { LineageDetails } from '../generated/type/entityLineage';
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
    selectedEdgeValue?.data.edge;
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

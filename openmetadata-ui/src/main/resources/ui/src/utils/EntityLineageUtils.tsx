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
import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import React, { MouseEvent as ReactMouseEvent } from 'react';
import {
  ArrowHeadType,
  Edge,
  Elements,
  FlowElement,
  isNode,
  Node,
  OnLoadParams,
  Position,
} from 'react-flow-renderer';
import { Link } from 'react-router-dom';
import {
  CustomEdgeData,
  SelectedEdge,
  SelectedNode,
} from '../components/EntityLineage/EntityLineage.interface';
import Loader from '../components/Loader/Loader';
import {
  nodeHeight,
  nodeWidth,
  positionX,
  positionY,
} from '../constants/constants';
import { EntityLineageDirection } from '../enums/entity.enum';
import {
  Edge as LineageEdge,
  EntityLineage,
} from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import { getPartialNameFromFQN } from './CommonUtils';
import { isLeafNode } from './EntityUtils';
import { getEntityLink } from './TableUtils';

export const getHeaderLabel = (
  v = '',
  fqn: string,
  type: string,
  isMainNode: boolean,
  separator = '.'
) => {
  const length = v.split(separator).length;

  return (
    <>
      {isMainNode ? (
        <span
          className="tw-break-words description-text tw-self-center tw-font-medium"
          data-testid="lineage-entity">
          {v.split(separator)[length - 1]}
        </span>
      ) : (
        <span
          className="tw-break-words description-text tw-self-center link-text tw-font-medium"
          data-testid="lineage-entity">
          <Link to={getEntityLink(type, fqn)}>
            {v.split(separator)[length - 1]}
          </Link>
        </span>
      )}
    </>
  );
};

export const onLoad = (reactFlowInstance: OnLoadParams) => {
  reactFlowInstance.fitView();
  reactFlowInstance.zoomTo(1);
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

export const getLineageData = (
  entityLineage: EntityLineage,
  onSelect: (state: boolean, value: SelectedNode) => void,
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void,
  lineageLeafNodes: LeafNodes,
  isNodeLoading: LoadingNodeState,
  getNodeLable: (node: EntityReference) => React.ReactNode,
  isEditMode: boolean,
  edgeType: string,
  onEdgeClick: (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => void
) => {
  const [x, y] = [0, 0];
  const nodes = [
    ...(entityLineage['nodes'] as EntityReference[]),
    entityLineage['entity'],
  ];
  let upstreamEdges: Array<LineageEdge & { isMapped: boolean }> =
    entityLineage['upstreamEdges']?.map((up) => ({ isMapped: false, ...up })) ||
    [];
  let downstreamEdges: Array<LineageEdge & { isMapped: boolean }> =
    entityLineage['downstreamEdges']?.map((down) => ({
      isMapped: false,
      ...down,
    })) || [];
  const mainNode = entityLineage['entity'];

  const UPStreamNodes: Elements = [];
  const DOWNStreamNodes: Elements = [];
  const lineageEdges: Elements = [];

  const makeNode = (
    node: EntityReference,
    pos: LineagePos,
    depth: number,
    posDepth: number
  ) => {
    const [xVal, yVal] = [positionX * 2 * depth, y + positionY * posDepth];

    return {
      id: `${node.id}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: 'default',
      className: 'leaf-node',
      data: {
        label: getNodeLable(node),
        entityType: node.type,
      },
      position: {
        x: pos === 'from' ? -xVal : xVal,
        y: yVal,
      },
    };
  };

  const getNodes = (
    id: string,
    pos: LineagePos,
    depth: number,
    NodesArr: Array<EntityReference & { lDepth: number }> = []
  ): Array<EntityReference & { lDepth: number }> => {
    if (pos === 'to') {
      let upDepth = NodesArr.filter((nd) => nd.lDepth === depth).length;
      const UPNodes: Array<EntityReference> = [];
      const updatedUpStreamEdge = upstreamEdges.map((up) => {
        if (up.toEntity === id) {
          const edg = UPStreamNodes.find((up) => up.id.includes(`node-${id}`));
          const node = nodes?.find((nd) => nd.id === up.fromEntity);
          if (node) {
            UPNodes.push(node);
            UPStreamNodes.push(makeNode(node, 'from', depth, upDepth));
            lineageEdges.push({
              id: `edge-${up.fromEntity}-${id}-${depth}`,
              source: `${node.id}`,
              target: edg ? edg.id : `${id}`,
              type: isEditMode ? edgeType : 'custom',
              arrowHeadType: ArrowHeadType.ArrowClosed,
              data: {
                id: `edge-${up.fromEntity}-${id}-${depth}`,
                source: `${node.id}`,
                target: edg ? edg.id : `${id}`,
                sourceType: node.type,
                targetType: edg?.data?.entityType,
                onEdgeClick,
              },
            });
          }
          upDepth += 1;

          return {
            ...up,
            isMapped: true,
          };
        } else {
          return up;
        }
      });

      upstreamEdges = updatedUpStreamEdge;

      return UPNodes?.map((upNd) => ({ lDepth: depth, ...upNd })) || [];
    } else {
      let downDepth = NodesArr.filter((nd) => nd.lDepth === depth).length;
      const DOWNNodes: Array<EntityReference> = [];
      const updatedDownStreamEdge = downstreamEdges.map((down) => {
        if (down.fromEntity === id) {
          const edg = DOWNStreamNodes.find((down) =>
            down.id.includes(`node-${id}`)
          );
          const node = nodes?.find((nd) => nd.id === down.toEntity);
          if (node) {
            DOWNNodes.push(node);
            DOWNStreamNodes.push(makeNode(node, 'to', depth, downDepth));
            lineageEdges.push({
              id: `edge-${id}-${down.toEntity}`,
              source: edg ? edg.id : `${id}`,
              target: `${node.id}`,
              type: isEditMode ? edgeType : 'custom',
              arrowHeadType: ArrowHeadType.ArrowClosed,
              data: {
                id: `edge-${id}-${down.toEntity}`,
                source: edg ? edg.id : `${id}`,
                target: `${node.id}`,
                sourceType: edg?.data?.entityType,
                targetType: node.type,
                onEdgeClick,
              },
            });
          }
          downDepth += 1;

          return {
            ...down,
            isMapped: true,
          };
        } else {
          return down;
        }
      });

      downstreamEdges = updatedDownStreamEdge;

      return DOWNNodes?.map((downNd) => ({ lDepth: depth, ...downNd })) || [];
    }
  };

  const getUpStreamData = (
    Entity: EntityReference,
    depth = 1,
    upNodesArr: Array<EntityReference & { lDepth: number }> = []
  ) => {
    const upNodes = getNodes(Entity.id, 'to', depth, upNodesArr);
    upNodesArr.push(...upNodes);
    upNodes.forEach((up) => {
      if (
        upstreamEdges.some((upE) => upE.toEntity === up.id && !upE.isMapped)
      ) {
        getUpStreamData(up, depth + 1, upNodesArr);
      }
    });

    return upNodesArr;
  };

  const getDownStreamData = (
    Entity: EntityReference,
    depth = 1,
    downNodesArr: Array<EntityReference & { lDepth: number }> = []
  ) => {
    const downNodes = getNodes(Entity.id, 'from', depth, downNodesArr);
    downNodesArr.push(...downNodes);
    downNodes.forEach((down) => {
      if (
        downstreamEdges.some(
          (downE) => downE.fromEntity === down.id && !downE.isMapped
        )
      ) {
        getDownStreamData(down, depth + 1, downNodesArr);
      }
    });

    return downNodesArr;
  };

  /**
   * Get upstream and downstream of each node and store it in
   * UPStreamNodes
   * DOWNStreamNodes
   */
  nodes?.forEach((node) => {
    getUpStreamData(node);

    getDownStreamData(node);
  });

  const lineageData = [
    {
      id: `${mainNode.id}`,
      sourcePosition: 'right',
      targetPosition: 'left',
      type:
        lineageEdges.find((ed: FlowElement) =>
          (ed as Edge).target.includes(mainNode.id)
        ) || isEditMode
          ? lineageEdges.find((ed: FlowElement) =>
              (ed as Edge).source.includes(mainNode.id)
            ) || isEditMode
            ? 'default'
            : 'output'
          : 'input',
      className: `leaf-node ${!isEditMode ? 'core' : ''}`,
      data: {
        label: getNodeLable(mainNode),
      },
      position: { x: x, y: y },
    },
    ...UPStreamNodes.map((up) => {
      const node = entityLineage?.nodes?.find((d) => up.id.includes(d.id));

      return lineageEdges.find(
        (ed: FlowElement) => (ed as Edge).target === up.id
      )
        ? up
        : {
            ...up,
            type: isEditMode ? 'default' : 'input',
            data: {
              label: (
                <div className="tw-flex">
                  <div
                    className="tw-pr-2 tw-self-center tw-cursor-pointer "
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(false, {} as SelectedNode);
                      if (node) {
                        loadNodeHandler(node, 'from');
                      }
                    }}>
                    {!isLeafNode(
                      lineageLeafNodes,
                      node?.id as string,
                      'from'
                    ) && !up.id.includes(isNodeLoading.id as string) ? (
                      <FontAwesomeIcon
                        className="tw-text-primary tw-mr-2"
                        icon={faChevronLeft}
                      />
                    ) : null}
                    {isNodeLoading.state &&
                    up.id.includes(isNodeLoading.id as string) ? (
                      <Loader size="small" type="default" />
                    ) : null}
                  </div>

                  <div>{up?.data?.label}</div>
                </div>
              ),
            },
          };
    }),
    ...DOWNStreamNodes.map((down) => {
      const node = entityLineage?.nodes?.find((d) => down.id.includes(d.id));

      return lineageEdges.find((ed: FlowElement) =>
        (ed as Edge).source.includes(down.id)
      )
        ? down
        : {
            ...down,
            type: isEditMode ? 'default' : 'output',
            data: {
              label: (
                <div className="tw-flex tw-justify-between">
                  <div>{down?.data?.label}</div>

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
                    !down.id.includes(isNodeLoading.id as string) ? (
                      <FontAwesomeIcon
                        className="tw-text-primary tw-ml-2"
                        icon={faChevronRight}
                      />
                    ) : null}
                    {isNodeLoading.state &&
                    down.id.includes(isNodeLoading.id as string) ? (
                      <Loader size="small" type="default" />
                    ) : null}
                  </div>
                </div>
              ),
            },
          };
    }),
    ...lineageEdges,
  ];

  return lineageData;
};

export const getDataLabel = (
  displayName?: string,
  name = '',
  separator = '.',
  isTextOnly = false,
  type?: string
) => {
  const databaseName = getPartialNameFromFQN(name, ['database']);
  let label = '';
  if (displayName) {
    label = displayName;
  } else {
    const length = name.split(separator).length;
    label = name.split(separator)[length - 1];
  }

  if (isTextOnly) {
    return label;
  }

  return (
    <span
      className="tw-break-words description-text tw-self-center"
      data-testid="lineage-entity">
      {type === 'table'
        ? databaseName
          ? `${databaseName}.${label}`
          : label
        : label}
    </span>
  );
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

export const getLayoutedElements = (
  elements: Elements,
  direction = EntityLineageDirection.LEFT_RIGHT
) => {
  const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
  dagreGraph.setGraph({ rankdir: direction });

  elements.forEach((el) => {
    if (isNode(el)) {
      dagreGraph.setNode(el.id, {
        width: el?.__rf?.width ?? nodeWidth,
        height: el?.__rf?.height ?? nodeHeight,
      });
    } else {
      dagreGraph.setEdge(el.source, el.target);
    }
  });

  dagre.layout(dagreGraph);

  return elements.map((el) => {
    if (isNode(el)) {
      const nodeWithPosition = dagreGraph.node(el.id);
      el.targetPosition = isHorizontal ? Position.Left : Position.Top;
      el.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
      el.position = {
        x:
          nodeWithPosition.x -
          (el?.__rf?.width ?? nodeWidth) / 2 +
          Math.random() / 1000,
        y: nodeWithPosition.y - (el?.__rf?.height ?? nodeHeight) / 2,
      };
    }

    return el;
  });
};

export const getModalBodyText = (selectedEdge: SelectedEdge) => {
  return `Are you sure you want to remove the edge between "${
    selectedEdge.source.displayName
      ? selectedEdge.source.displayName
      : getPartialNameFromFQN(
          selectedEdge.source.name as string,
          selectedEdge.source.type === 'table' ? ['table'] : ['database']
        )
  } and ${
    selectedEdge.target.displayName
      ? selectedEdge.target.displayName
      : getPartialNameFromFQN(
          selectedEdge.target.name as string,
          selectedEdge.target.type === 'table' ? ['table'] : ['database']
        )
  }"?`;
};

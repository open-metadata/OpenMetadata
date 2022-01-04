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

import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import React, { MouseEvent as ReactMouseEvent } from 'react';
import {
  OnLoadParams,
  Edge,
  Elements,
  Position,
  FlowElement,
  ArrowHeadType,
  Node,
} from 'react-flow-renderer';
import { Link } from 'react-router-dom';
import { SelectedNode } from '../components/EntityLineage/EntityLineage.interface';
import Loader from '../components/Loader/Loader';
import { positionX, positionY } from '../constants/constants';
import {
  EntityLineage,
  Edge as LineageEdge,
} from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import { isLeafNode } from './EntityUtils';

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
  getNodeLable: (node: EntityReference) => React.ReactNode
) => {
  const [x, y] = [0, 0];
  const nodes = entityLineage['nodes'];
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
      id: `node-${node.id}-${depth}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: 'default',
      className: 'leaf-node',
      data: {
        label: getNodeLable(node),
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
              source: `node-${node.id}-${depth}`,
              target: edg ? edg.id : `node-${id}-${depth}`,
              type: 'custom',
              arrowHeadType: ArrowHeadType.ArrowClosed,
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
              source: edg ? edg.id : `node-${id}-${depth}`,
              target: `node-${node.id}-${depth}`,
              type: 'custom',
              arrowHeadType: ArrowHeadType.ArrowClosed,
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

  getUpStreamData(mainNode);

  getDownStreamData(mainNode);

  const lineageData = [
    {
      id: `node-${mainNode.id}-1`,
      sourcePosition: 'right',
      targetPosition: 'left',
      type: lineageEdges.find((ed: FlowElement) =>
        (ed as Edge).target.includes(mainNode.id)
      )
        ? lineageEdges.find((ed: FlowElement) =>
            (ed as Edge).source.includes(mainNode.id)
          )
          ? 'default'
          : 'output'
        : 'input',
      className: 'leaf-node core',
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
            type: 'input',
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
                      <i className="fas fa-chevron-left tw-text-primary tw-mr-2" />
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
            type: 'output',
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
                      <i className="fas fa-chevron-right tw-text-primary tw-ml-2" />
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

export const getDataLabel = (v = '', separator = '.', isTextOnly = false) => {
  const length = v.split(separator).length;
  if (isTextOnly) {
    return v.split(separator)[length - 1];
  }

  return (
    <span
      className="tw-break-words description-text tw-self-center"
      data-testid="lineage-entity">
      {v.split(separator)[length - 1]}
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

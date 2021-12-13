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

import { AxiosResponse } from 'axios';
import { isEmpty } from 'lodash';
import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import React, {
  FunctionComponent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import ReactFlow, {
  addEdge,
  ArrowHeadType,
  Connection,
  Controls,
  Edge,
  Elements,
  FlowElement,
  Node,
  OnLoadParams,
  Position,
  ReactFlowProvider,
  removeElements,
} from 'react-flow-renderer';
import { Link } from 'react-router-dom';
import { getTableDetails } from '../../axiosAPIs/tableAPI';
import { Column } from '../../generated/entity/data/table';
import {
  Edge as LineageEdge,
  EntityLineage,
} from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import useToastContext from '../../hooks/useToastContext';
import { isLeafNode } from '../../utils/EntityUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import EntityInfoDrawer from '../EntityInfoDrawer/EntityInfoDrawer.component';
import Loader from '../Loader/Loader';
import CustomNode from './CustomNode.component';
import { EntityLineageProp, SelectedNode } from './EntityLineage.interface';
const onLoad = (reactFlowInstance: OnLoadParams) => {
  reactFlowInstance.fitView();
  reactFlowInstance.zoomTo(1);
};
/* eslint-disable-next-line */
const onNodeMouseEnter = (_event: ReactMouseEvent, _node: Node | Edge) => {
  return;
};
/* eslint-disable-next-line */
const onNodeMouseMove = (_event: ReactMouseEvent, _node: Node | Edge) => {
  return;
};
/* eslint-disable-next-line */
const onNodeMouseLeave = (_event: ReactMouseEvent, _node: Node | Edge) => {
  return;
};
/* eslint-disable-next-line */
const onNodeContextMenu = (_event: ReactMouseEvent, _node: Node | Edge) => {
  _event.preventDefault();
};

const dragHandle = (event: ReactMouseEvent) => {
  event.stopPropagation();
};

const getDataLabel = (v = '', separator = '.', isTextOnly = false) => {
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

const getNoLineageDataPlaceholder = () => {
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

const positionX = 150;
const positionY = 60;

const getLineageData = (
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

const Entitylineage: FunctionComponent<EntityLineageProp> = ({
  entityLineage,
  loadNodeHandler,
  lineageLeafNodes,
  isNodeLoading,
}: EntityLineageProp) => {
  const showToast = useToastContext();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(
    {} as SelectedNode
  );
  const expandButton = useRef<HTMLButtonElement | null>(null);
  const [expandNode, setExpandNode] = useState<EntityReference | undefined>(
    undefined
  );

  const [tableColumns, setTableColumns] = useState<Column[]>([] as Column[]);

  const selectNodeHandler = (state: boolean, value: SelectedNode) => {
    setIsDrawerOpen(state);
    setSelectedNode(value);
  };

  const getNodeLable = (node: EntityReference) => {
    return (
      <>
        {node.type === 'table' ? (
          <button
            className="tw-absolute tw--top-4 tw--left-5 tw-cursor-pointer tw-z-9999"
            onClick={(e) => {
              expandButton.current = expandButton.current
                ? null
                : e.currentTarget;
              setExpandNode(expandNode ? undefined : node);
              setIsDrawerOpen(false);
            }}>
            <SVGIcons
              alt="plus"
              icon={expandNode?.id === node.id ? 'icon-minus' : 'icon-plus'}
              width="16px"
            />
          </button>
        ) : null}
        <p className="tw-flex">
          <span className="tw-mr-2">{getEntityIcon(node.type)}</span>
          {getDataLabel(node.name as string)}
        </p>
      </>
    );
  };

  const setElementsHandle = () => {
    return getLineageData(
      entityLineage,
      selectNodeHandler,
      loadNodeHandler,
      lineageLeafNodes,
      isNodeLoading,
      getNodeLable
    ) as Elements;
  };

  const [elements, setElements] = useState<Elements>(setElementsHandle());
  const closeDrawer = (value: boolean) => {
    setIsDrawerOpen(value);

    setElements((prevElements) => {
      return prevElements.map((el) => {
        if (el.id === selectedNode.id) {
          return { ...el, className: 'leaf-node' };
        } else {
          return el;
        }
      });
    });
  };
  const onElementsRemove = (elementsToRemove: Elements) =>
    setElements((els) => removeElements(elementsToRemove, els));
  const onConnect = (params: Edge | Connection) =>
    setElements((els) => addEdge(params, els));

  const onElementClick = (el: FlowElement) => {
    const node = [
      ...(entityLineage.nodes as Array<EntityReference>),
      entityLineage.entity,
    ].find((n) => el.id.includes(n.id));
    if (!expandButton.current) {
      selectNodeHandler(true, {
        name: node?.name as string,
        id: el.id,
        type: node?.type as string,
      });
      setElements((prevElements) => {
        return prevElements.map((preEl) => {
          if (preEl.id === el.id) {
            return { ...preEl, className: `${preEl.className} selected-node` };
          } else {
            return { ...preEl, className: 'leaf-node' };
          }
        });
      });
    } else {
      expandButton.current = null;
    }
  };

  const onNodeExpand = (tableColumns?: Column[]) => {
    const elements = setElementsHandle();
    setElements(
      elements.map((preEl) => {
        if (preEl.id.includes(expandNode?.id as string)) {
          return {
            ...preEl,
            className: `${preEl.className} selected-node`,
            data: { ...preEl.data, columns: tableColumns },
          };
        } else {
          return { ...preEl, className: 'leaf-node' };
        }
      })
    );
  };

  const getTableColumns = (expandNode?: EntityReference) => {
    if (expandNode) {
      getTableDetails(expandNode.id, ['columns'])
        .then((res: AxiosResponse) => {
          const { columns } = res.data;
          setTableColumns(columns);
        })
        .catch(() => {
          showToast({
            variant: 'error',
            body: `Error while fetching ${getDataLabel(
              expandNode.name,
              '.',
              true
            )} columns`,
          });
        });
    }
  };

  useEffect(() => {
    setElements(setElementsHandle());
    setExpandNode(undefined);
    setTableColumns([]);
  }, [entityLineage, isNodeLoading]);

  useEffect(() => {
    onNodeExpand();
    getTableColumns(expandNode);
  }, [expandNode]);

  useEffect(() => {
    if (!isEmpty(selectedNode)) {
      setExpandNode(undefined);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (tableColumns.length) {
      onNodeExpand(tableColumns);
    }
  }, [tableColumns]);

  return (
    <div className="tw-relative tw-h-full tw--ml-4">
      <div className="tw-w-full tw-h-full">
        {(entityLineage?.downstreamEdges ?? []).length > 0 ||
        (entityLineage?.upstreamEdges ?? []).length > 0 ? (
          <ReactFlowProvider>
            <ReactFlow
              panOnScroll
              elements={elements as Elements}
              nodesConnectable={false}
              nodeTypes={{
                output: CustomNode,
                input: CustomNode,
                default: CustomNode,
              }}
              onConnect={onConnect}
              onElementClick={(_e, el) => onElementClick(el)}
              onElementsRemove={onElementsRemove}
              onLoad={onLoad}
              onNodeContextMenu={onNodeContextMenu}
              onNodeDrag={dragHandle}
              onNodeDragStart={dragHandle}
              onNodeDragStop={dragHandle}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onNodeMouseMove={onNodeMouseMove}>
              <Controls
                className="tw-top-1 tw-left-1 tw-bottom-full tw-ml-4 tw-mt-4"
                showInteractive={false}
              />
            </ReactFlow>
          </ReactFlowProvider>
        ) : (
          getNoLineageDataPlaceholder()
        )}
      </div>
      <EntityInfoDrawer
        isMainNode={selectedNode.name === entityLineage.entity.name}
        selectedNode={selectedNode}
        show={isDrawerOpen}
        onCancel={closeDrawer}
      />
    </div>
  );
};

export default Entitylineage;

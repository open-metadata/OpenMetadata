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

import { Modal } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  isEmpty,
  isNil,
  isUndefined,
  lowerCase,
  uniqueId,
  upperCase,
} from 'lodash';
import { LoadingState } from 'Models';
import React, {
  DragEvent,
  Fragment,
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  getConnectedEdges,
  isNode,
  Node,
  ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import { getTableDetails } from '../../axiosAPIs/tableAPI';
import { ELEMENT_DELETE_STATE } from '../../constants/Lineage.constants';
import {
  AddLineage,
  ColumnLineage,
} from '../../generated/api/lineage/addLineage';
import { Column } from '../../generated/entity/data/table';
import {
  EntityLineage,
  LineageDetails,
} from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { withLoader } from '../../hoc/withLoader';
import {
  createNewEdge,
  dragHandle,
  findUpstreamDownStreamEdge,
  getColumnType,
  getDataLabel,
  getDeletedLineagePlaceholder,
  getEdgeType,
  getLayoutedElements,
  getLineageData,
  getModalBodyText,
  getNodeRemoveButton,
  getRemovedNodeData,
  getSelectedEdgeArr,
  getUniqueFlowElements,
  getUpdatedEdge,
  getUpdatedUpstreamDownStreamEdgeArr,
  getUpStreamDownStreamColumnLineageArr,
  LoadingStatus,
  onLoad,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
} from '../../utils/EntityLineageUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import EntityInfoDrawer from '../EntityInfoDrawer/EntityInfoDrawer.component';
import Loader from '../Loader/Loader';
import CustomControlElements from './CustomControlElements.component';
import { CustomEdge } from './CustomEdge.component';
import CustomNode from './CustomNode.component';
import {
  CustomEdgeData,
  CustomElement,
  EdgeData,
  EdgeTypeEnum,
  ElementLoadingState,
  EntityLineageProp,
  ModifiedColumn,
  SelectedEdge,
  SelectedNode,
} from './EntityLineage.interface';
import EntityLineageSidebar from './EntityLineageSidebar.component';
import NodeSuggestions from './NodeSuggestions.component';

const EntityLineageComponent: FunctionComponent<EntityLineageProp> = ({
  entityLineage,
  loadNodeHandler,
  lineageLeafNodes,
  isNodeLoading,
  isLoading,
  deleted,
  addLineageHandler,
  removeLineageHandler,
  entityLineageHandler,
  hasEditAccess,
}: EntityLineageProp) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(
    {} as SelectedNode
  );
  const expandButton = useRef<HTMLButtonElement | null>(null);
  const [isEditMode, setEditMode] = useState<boolean>(false);
  const tableColumnsRef = useRef<{ [key: string]: Column[] }>(
    {} as { [key: string]: Column[] }
  );
  const [newAddedNode, setNewAddedNode] = useState<Node>({} as Node);
  const [selectedEntity, setSelectedEntity] = useState<EntityReference>(
    {} as EntityReference
  );
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge>(
    {} as SelectedEdge
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<LoadingState>('initial');
  const [deletionState, setDeletionState] = useState<{
    loading: boolean;
    status: ElementLoadingState;
  }>(ELEMENT_DELETE_STATE);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /**
   * this state will maintain the updated state and
   * it will be sent back to parent when the user came out from edit mode to view mode
   */
  const [updatedLineageData, setUpdatedLineageData] =
    useState<EntityLineage>(entityLineage);

  /**
   * Custom Node Type Object
   */
  const nodeTypes = useMemo(
    () => ({
      output: CustomNode,
      input: CustomNode,
      default: CustomNode,
    }),
    []
  );
  const customEdges = useMemo(() => ({ buttonedge: CustomEdge }), []);

  /**
   * take state and value to set selected node
   * @param state
   * @param value
   */
  const selectNodeHandler = (state: boolean, value: SelectedNode) => {
    setIsDrawerOpen(state);
    setSelectedNode(value);
  };

  const resetSelectedData = () => {
    setNewAddedNode({} as Node);
    setSelectedEntity({} as EntityReference);
  };

  /**
   *
   * @param node
   * @returns label for given node
   */
  const getNodeLabel = (node: EntityReference, isExpanded = false) => {
    return (
      <Fragment>
        {node.type === 'table' ? (
          <button
            className="tw-absolute tw--top-3.5 tw--left-2 tw-cursor-pointer tw-z-9999"
            onClick={(e) => {
              expandButton.current = expandButton.current
                ? null
                : e.currentTarget;
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              handleNodeExpand(!isExpanded, node);
              setIsDrawerOpen(false);
            }}>
            <SVGIcons
              alt="plus"
              icon={isExpanded ? 'icon-minus' : 'icon-plus'}
              width="16px"
            />
          </button>
        ) : null}
        <p className="tw-flex tw-m-0 tw-py-3">
          <span className="tw-mr-2">{getEntityIcon(node.type)}</span>
          {getDataLabel(
            node.displayName,
            node.fullyQualifiedName,
            false,
            node.type
          )}
        </p>
      </Fragment>
    );
  };

  /**
   *
   * @param data selected edge
   * @param confirmDelete confirmation state for deleting selected edge
   */
  const removeEdgeHandler = (data: SelectedEdge, confirmDelete: boolean) => {
    if (confirmDelete) {
      const edgeData: EdgeData = {
        fromEntity: data.source.type,
        fromId: data.source.id,
        toEntity: data.target.type,
        toId: data.target.id,
      };
      removeLineageHandler(edgeData);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setEdges((es) => {
        return es.filter(
          (e) => e.source !== data.source.id && e.target !== data.target.id
        );
      });
      const newDownStreamEdges = getSelectedEdgeArr(
        updatedLineageData.downstreamEdges || [],
        edgeData
      );
      const newUpStreamEdges = getSelectedEdgeArr(
        updatedLineageData.upstreamEdges || [],
        edgeData
      );

      resetSelectedData();
      setUpdatedLineageData({
        ...updatedLineageData,
        downstreamEdges: newDownStreamEdges,
        upstreamEdges: newUpStreamEdges,
      });
      setConfirmDelete(false);
    }
  };

  const removeColumnEdge = (data: SelectedEdge, confirmDelete: boolean) => {
    if (confirmDelete) {
      const upStreamEdge = findUpstreamDownStreamEdge(
        updatedLineageData.upstreamEdges,
        data
      );

      const downStreamEdge = findUpstreamDownStreamEdge(
        updatedLineageData.downstreamEdges,
        data
      );

      const selectedEdge: AddLineage = {
        edge: {
          fromEntity: {
            id: data.source.id,
            type: data.source.type,
          },
          toEntity: {
            id: data.target.id,
            type: data.target.type,
          },
        },
      };
      let lineageDetails: LineageDetails | undefined;

      if (!isUndefined(upStreamEdge) && upStreamEdge.lineageDetails) {
        lineageDetails = getUpStreamDownStreamColumnLineageArr(
          upStreamEdge.lineageDetails,
          data
        );
        setUpdatedLineageData({
          ...updatedLineageData,
          upstreamEdges: getUpdatedUpstreamDownStreamEdgeArr(
            updatedLineageData.upstreamEdges || [],
            data,
            lineageDetails
          ),
        });
      } else if (
        !isUndefined(downStreamEdge) &&
        downStreamEdge.lineageDetails
      ) {
        lineageDetails = getUpStreamDownStreamColumnLineageArr(
          downStreamEdge.lineageDetails,
          data
        );
        setUpdatedLineageData({
          ...updatedLineageData,
          downstreamEdges: getUpdatedUpstreamDownStreamEdgeArr(
            updatedLineageData.downstreamEdges || [],
            data,
            lineageDetails
          ),
        });
      }
      selectedEdge.edge.lineageDetails = lineageDetails;
      setEdges((pre) => {
        return pre.filter(
          (e) =>
            !(
              e.sourceHandle === data.data?.sourceHandle &&
              e.targetHandle === data.data?.targetHandle
            )
        );
      });
      addLineageHandler(selectedEdge);
      resetSelectedData();
      setConfirmDelete(false);
    }
  };

  /**
   * take edge data and set it as selected edge
   * @param evt
   * @param data
   */
  const onEdgeClick = (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => {
    setShowDeleteModal(true);
    evt.stopPropagation();
    setSelectedEdge(() => {
      const allNode = [
        ...(updatedLineageData.nodes || []),
        updatedLineageData.entity,
      ];

      return {
        ...getRemovedNodeData(
          allNode,
          data,
          updatedLineageData.entity,
          selectedEntity
        ),
        data,
      };
    });
  };

  const removeNodeHandler = useCallback(
    (node: Node) => {
      // Get edges connected to selected node
      const edgesToRemove = getConnectedEdges([node], edges);

      edgesToRemove.forEach((edge) => {
        removeEdgeHandler(
          getRemovedNodeData(
            updatedLineageData.nodes || [],
            edge,
            updatedLineageData.entity,
            selectedEntity
          ),
          true
        );
      });

      setNodes(
        (previousNodes) =>
          getUniqueFlowElements(
            previousNodes.filter((previousNode) => previousNode.id !== node.id)
          ) as Node[]
      );
      setNewAddedNode({} as Node);
    },
    [nodes, updatedLineageData]
  );

  const setElementsHandle = (data: EntityLineage) => {
    if (!isEmpty(data)) {
      const currentData = {
        nodes: [...(nodes || [])],
        edges: [...(edges || [])],
      };
      const graphElements = getLineageData(
        data,
        selectNodeHandler,
        loadNodeHandler,
        lineageLeafNodes,
        isNodeLoading,
        getNodeLabel,
        isEditMode,
        'buttonedge',
        onEdgeClick,
        removeNodeHandler,
        tableColumnsRef.current,
        currentData
      ) as CustomElement;

      const uniqueElements: CustomElement = {
        node: getUniqueFlowElements(graphElements.node) as Node[],
        edge: getUniqueFlowElements(graphElements.edge) as Edge[],
      };
      const { node, edge } = getLayoutedElements(uniqueElements);
      setNodes(node);
      setEdges(edge);

      setConfirmDelete(false);
    }
  };

  /**
   * take boolean value as input and reset selected node
   * @param value
   */
  const closeDrawer = (value: boolean) => {
    setIsDrawerOpen(value);
    setNodes((prevElements) => {
      return prevElements.map((prevElement) => {
        if (prevElement.id === selectedNode.id) {
          const className =
            prevElement.id.includes(updatedLineageData.entity?.id) &&
            !isEditMode
              ? 'leaf-node core'
              : 'leaf-node';

          return {
            ...prevElement,
            className,
          };
        } else {
          return prevElement;
        }
      });
    });
    setSelectedNode({} as SelectedNode);
  };

  const getSourceOrTargetNode = (queryStr: string) => {
    return queryStr.includes(updatedLineageData.entity?.id)
      ? updatedLineageData.entity
      : selectedEntity;
  };

  const getUpdatedNodes = (entityLineage: EntityLineage) => {
    return !isEmpty(selectedEntity)
      ? [...(entityLineage.nodes || []), selectedEntity]
      : entityLineage.nodes;
  };

  /**
   * take edge or connection to add new element in the graph
   * @param params
   */
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const { target, source, sourceHandle, targetHandle } = params;

      if (target === source) return;

      const columnConnection = !isNil(sourceHandle) && !isNil(targetHandle);

      setStatus('waiting');
      setLoading(true);

      const edgeType = getEdgeType(updatedLineageData, params);
      const nodes = [
        ...(updatedLineageData.nodes as EntityReference[]),
        updatedLineageData.entity,
      ];

      let targetNode = nodes?.find((n) => target?.includes(n.id));

      let sourceNode = nodes?.find((n) => source?.includes(n.id));

      if (isUndefined(targetNode) && sourceNode?.id !== selectedEntity?.id) {
        targetNode = getSourceOrTargetNode(target || '');
      }
      if (isUndefined(sourceNode) && targetNode?.id !== selectedEntity?.id) {
        sourceNode = getSourceOrTargetNode(source || '');
      }

      if (!isUndefined(sourceNode) && !isUndefined(targetNode)) {
        const newEdge: AddLineage = {
          edge: {
            fromEntity: {
              id: sourceNode.id,
              type: sourceNode.type,
            },
            toEntity: {
              id: targetNode.id,
              type: targetNode.type,
            },
          },
        };

        if (columnConnection) {
          const allEdge = [
            ...(updatedLineageData.downstreamEdges || []),
            ...(updatedLineageData.upstreamEdges || []),
          ];
          const currentEdge = allEdge.find(
            (edge) => edge.fromEntity === source && edge.toEntity === target
          )?.lineageDetails;

          if (isUndefined(currentEdge)) {
            newEdge.edge.lineageDetails = {
              sqlQuery: '',
              columnsLineage: [
                {
                  fromColumns: [sourceHandle || ''],
                  toColumn: targetHandle || '',
                },
              ],
            };
          } else {
            const updatedColumnsLineage: ColumnLineage[] =
              currentEdge.columnsLineage?.map((lineage) => {
                if (lineage.toColumn === targetHandle) {
                  return {
                    ...lineage,
                    fromColumns: [
                      ...(lineage.fromColumns || []),
                      sourceHandle || '',
                    ],
                  };
                }

                return lineage;
              }) || [];
            if (
              !updatedColumnsLineage.find(
                (lineage) => lineage.toColumn === targetHandle
              )
            ) {
              updatedColumnsLineage.push({
                fromColumns: [sourceHandle || ''],
                toColumn: targetHandle || '',
              });
            }
            newEdge.edge.lineageDetails = {
              sqlQuery: currentEdge.sqlQuery || '',
              columnsLineage: updatedColumnsLineage,
            };
          }

          setEdges((previousEdges) => {
            const newEdgeData = createNewEdge(
              params,
              isEditMode,
              sourceNode?.type || '',
              targetNode?.type || '',
              true,
              onEdgeClick
            );

            return getUniqueFlowElements(
              addEdge(newEdgeData, previousEdges)
            ) as Edge[];
          });
        }

        setEdges((previousEdges) => {
          const newEdgeData = createNewEdge(
            params,
            isEditMode,
            sourceNode?.type || '',
            targetNode?.type || '',
            false,
            onEdgeClick
          );

          return getUniqueFlowElements(
            addEdge(newEdgeData, previousEdges)
          ) as Edge[];
        });

        const updatedStreamEdges = (
          pre: EntityLineage['downstreamEdges'],
          type: EdgeTypeEnum
        ) => {
          if (edgeType !== type) {
            return pre;
          }

          const isExist = pre?.find(
            (e) => e.fromEntity === source && e.toEntity === target
          );

          if (!isUndefined(isExist)) {
            return getUpdatedEdge(
              pre || [],
              params,
              newEdge.edge.lineageDetails
            );
          }

          return [
            ...(pre || []),
            {
              fromEntity: sourceNode?.id as string,
              toEntity: targetNode?.id as string,
              lineageDetails: newEdge.edge.lineageDetails,
            },
          ];
        };

        setTimeout(() => {
          addLineageHandler(newEdge)
            .then(() => {
              setStatus('success');
              setLoading(false);
              setUpdatedLineageData((pre) => {
                const newData = {
                  ...pre,
                  nodes: getUpdatedNodes(pre),
                  downstreamEdges: updatedStreamEdges(
                    pre.downstreamEdges,
                    EdgeTypeEnum.DOWN_STREAM
                  ),
                  upstreamEdges: updatedStreamEdges(
                    pre.upstreamEdges,
                    EdgeTypeEnum.UP_STREAM
                  ),
                };

                return newData;
              });
              setTimeout(() => {
                setStatus('initial');
              }, 100);
              resetSelectedData();
            })
            .catch(() => {
              setStatus('initial');
              setLoading(false);
            });
        }, 500);
      }
    },
    [selectedNode, updatedLineageData, selectedEntity]
  );

  /**
   * take element and perform onClick logic
   * @param el
   */
  const onNodeClick = (el: Node) => {
    if (isNode(el)) {
      const node = [
        ...(updatedLineageData.nodes as Array<EntityReference>),
        updatedLineageData.entity,
      ].find((n) => el.id.includes(n.id));

      if (!expandButton.current) {
        selectNodeHandler(true, {
          name: node?.name as string,
          fqn: node?.fullyQualifiedName as string,
          id: el.id,
          displayName: node?.displayName,
          type: node?.type as string,
          entityId: node?.id as string,
        });
      } else {
        expandButton.current = null;
      }
    }
  };

  //   ToDo: remove below code once design flow finalized for column expand and colaps

  const updateColumnsToNode = (columns: Column[], id: string) => {
    setNodes((node) => {
      const updatedNode = node.map((n) => {
        if (n.id === id) {
          const cols: { [key: string]: ModifiedColumn } = {};
          columns.forEach((col) => {
            cols[col.fullyQualifiedName || col.name] = {
              ...col,
              type: isEditMode
                ? 'default'
                : getColumnType(edges, col.fullyQualifiedName || col.name),
            };
          });
          n.data.columns = cols;
        }

        return n;
      });

      return updatedNode;
    });
  };

  /**
   * take node and get the columns for that node
   * @param expandNode
   */
  const getTableColumns = (expandNode?: EntityReference) => {
    if (expandNode) {
      getTableDetails(expandNode.id, ['columns'])
        .then((res) => {
          const tableId = expandNode.id;
          const { columns } = res;
          tableColumnsRef.current[tableId] = columns;
          updateColumnsToNode(columns, tableId);
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            `Error while fetching ${getDataLabel(
              expandNode.displayName,
              expandNode.name,
              true
            )} columns`
          );
        });
    }
  };

  const handleNodeExpand = (isExpanded: boolean, node: EntityReference) => {
    if (isExpanded) {
      setNodes((prevState) => {
        const newNodes = prevState.map((n) => {
          if (n.id === node.id) {
            const nodeId = node.id;
            n.data.label = getNodeLabel(node, true);
            n.data.isExpanded = true;
            if (isUndefined(tableColumnsRef.current[nodeId])) {
              getTableColumns(node);
            } else {
              const cols: { [key: string]: ModifiedColumn } = {};
              tableColumnsRef.current[nodeId]?.forEach((col) => {
                cols[col.fullyQualifiedName || col.name] = {
                  ...col,
                  type: isEditMode
                    ? 'default'
                    : getColumnType(edges, col.fullyQualifiedName || col.name),
                };
              });
              n.data.columns = cols;
            }
          }

          return n;
        });

        return newNodes;
      });
    } else {
      setNodes((prevState) => {
        const newNodes = prevState.map((n) => {
          if (n.id === node.id) {
            n.data.label = getNodeLabel(node);
            n.data.isExpanded = false;
            n.data.columns = undefined;
          }

          return n;
        });

        return newNodes;
      });
    }
  };

  /**
   * handle node drag event
   * @param event
   */
  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  /**
   * handle node drop event
   * @param event
   */
  const onDrop = (event: DragEvent) => {
    event.preventDefault();

    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');
    if (type.trim()) {
      const position = reactFlowInstance?.project({
        x: event.clientX - (reactFlowBounds?.left ?? 0),
        y: event.clientY - (reactFlowBounds?.top ?? 0),
      });
      const [label, nodeType] = type.split('-');
      const newNode = {
        id: uniqueId(),
        nodeType,
        position,
        className: 'leaf-node',
        connectable: false,
        selectable: false,
        type: 'default',
        data: {
          label: (
            <div className="tw-relative">
              {getNodeRemoveButton(() => {
                removeNodeHandler(newNode as Node);
              })}
              <div className="tw-flex">
                <SVGIcons
                  alt="entity-icon"
                  className="tw-mr-2"
                  icon={`${lowerCase(label)}-grey`}
                  width="16px"
                />
                <NodeSuggestions
                  entityType={upperCase(label)}
                  onSelectHandler={setSelectedEntity}
                />
              </div>
            </div>
          ),
          removeNodeHandler,
          isEditMode,
          isNewNode: true,
        },
      };
      setNewAddedNode(newNode as Node);

      setNodes(
        (es) => getUniqueFlowElements(es.concat(newNode as Node)) as Node[]
      );
    }
  };

  /**
   * After dropping node to graph user will search and select entity
   * and this method will take care of changing node information based on selected entity.
   */
  const onEntitySelect = () => {
    if (!isEmpty(selectedEntity)) {
      const isExistingNode = nodes.some((n) => n.id === selectedEntity.id);
      if (isExistingNode) {
        setNodes((es) =>
          es
            .map((n) =>
              n.id.includes(selectedEntity.id)
                ? {
                    ...n,
                    selectable: true,
                    className: `${n.className} selected`,
                  }
                : n
            )
            .filter((es) => es.id !== newAddedNode.id)
        );
        resetSelectedData();
      } else {
        setNodes((es) => {
          return es.map((el) => {
            if (el.id === newAddedNode.id) {
              return {
                ...el,
                connectable: true,
                selectable: true,
                id: selectedEntity.id,
                data: {
                  ...el.data,
                  removeNodeHandler,
                  isEditMode,
                  label: (
                    <Fragment>
                      {getNodeLabel(selectedEntity)}
                      {getNodeRemoveButton(() => {
                        removeNodeHandler({
                          ...el,
                          id: selectedEntity.id,
                        } as Node);
                      })}
                    </Fragment>
                  ),
                },
              };
            } else {
              return el;
            }
          });
        });
      }
    }
  };

  /**
   * This method will handle the delete edge modal confirmation
   */
  const onRemove = () => {
    setDeletionState({ ...ELEMENT_DELETE_STATE, loading: true });
    setTimeout(() => {
      setDeletionState({ ...ELEMENT_DELETE_STATE, status: 'success' });
      setTimeout(() => {
        setShowDeleteModal(false);
        setConfirmDelete(true);
        setDeletionState((pre) => ({ ...pre, status: 'initial' }));
      }, 500);
    }, 500);
  };

  const handleCustomControlClick = () => {
    setEditMode((pre) => !pre && !deleted);
    resetSelectedData();
    setIsDrawerOpen(false);
  };

  /**
   * Handle updated linegae nodes
   * Change newly added node label based on entity:EntityReference
   */
  const handleUpdatedLineageNode = () => {
    const uNodes = updatedLineageData.nodes;
    const newlyAddedNodeElement = nodes.find((el) => el?.data?.isNewNode);
    const newlyAddedNode = uNodes?.find(
      (node) => node.id === newlyAddedNodeElement?.id
    );

    setNodes((els) => {
      return (els || []).map((el) => {
        if (el.id === newlyAddedNode?.id) {
          return {
            ...el,
            data: { ...el.data, label: getNodeLabel(newlyAddedNode) },
          };
        } else {
          return el;
        }
      });
    });
  };

  useEffect(() => {
    if (!deleted && !isEmpty(updatedLineageData)) {
      setElementsHandle(updatedLineageData);
    }
  }, [isNodeLoading, isEditMode]);

  useEffect(() => {
    const newNodes = updatedLineageData.nodes?.filter(
      (n) =>
        !isUndefined(
          updatedLineageData.downstreamEdges?.find((d) => d.toEntity === n.id)
        ) ||
        !isUndefined(
          updatedLineageData.upstreamEdges?.find((u) => u.fromEntity === n.id)
        )
    );
    entityLineageHandler({ ...updatedLineageData, nodes: newNodes });
  }, [isEditMode]);

  useEffect(() => {
    handleUpdatedLineageNode();
  }, [updatedLineageData]);

  useEffect(() => {
    onEntitySelect();
  }, [selectedEntity]);

  useEffect(() => {
    if (selectedEdge.data?.isColumnLineage) {
      removeColumnEdge(selectedEdge, confirmDelete);
    } else {
      removeEdgeHandler(selectedEdge, confirmDelete);
    }
  }, [selectedEdge, confirmDelete]);

  useEffect(() => {
    if (
      !isEmpty(entityLineage) &&
      !isUndefined(entityLineage.entity) &&
      !deleted
    ) {
      setUpdatedLineageData(entityLineage);
      setElementsHandle(entityLineage);
    }
  }, [entityLineage]);

  if (isLoading || (nodes.length === 0 && !deleted)) {
    return <Loader />;
  }

  if (deleted) {
    return getDeletedLineagePlaceholder();
  }

  return (
    <div
      className={classNames('tw-relative tw-h-full tw--ml-4 tw--mr-7 tw--mt-4')}
      data-testid="lineage-container">
      <div className="tw-w-full tw-h-full" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            data-testid="react-flow-component"
            edgeTypes={customEdges}
            edges={edges}
            maxZoom={2}
            minZoom={0.5}
            nodeTypes={nodeTypes}
            nodes={nodes}
            nodesConnectable={isEditMode}
            selectNodesOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnScroll={false}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onEdgesChange={onEdgesChange}
            onInit={(reactFlowInstance: ReactFlowInstance) => {
              onLoad(reactFlowInstance, nodes.length);
              setReactFlowInstance(reactFlowInstance);
            }}
            onNodeClick={(_e, node) => onNodeClick(node)}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDrag={dragHandle}
            onNodeDragStart={dragHandle}
            onNodeDragStop={dragHandle}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeMouseMove={onNodeMouseMove}
            onNodesChange={onNodesChange}>
            <CustomControlElements
              deleted={deleted}
              hasEditAccess={hasEditAccess}
              isEditMode={isEditMode}
              loading={loading}
              status={status}
              onClick={handleCustomControlClick}
            />
            {isEditMode && (
              <Background gap={12} size={1} variant={BackgroundVariant.Lines} />
            )}
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      {(!isEmpty(selectedNode) || !isEditMode) && (
        <EntityInfoDrawer
          isMainNode={selectedNode.name === updatedLineageData.entity?.name}
          selectedNode={selectedNode}
          show={isDrawerOpen && !isEditMode}
          onCancel={closeDrawer}
        />
      )}
      <EntityLineageSidebar newAddedNode={newAddedNode} show={isEditMode} />
      {showDeleteModal && (
        <Modal
          okText={LoadingStatus(
            'Confirm',
            deletionState.loading,
            deletionState.status
          )}
          title="Remove lineage edge"
          visible={showDeleteModal}
          onCancel={() => {
            setShowDeleteModal(false);
          }}
          onOk={onRemove}>
          {getModalBodyText(selectedEdge)}
        </Modal>
      )}
    </div>
  );
};

export default withLoader<EntityLineageProp>(EntityLineageComponent);

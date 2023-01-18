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

import { Modal } from 'antd';
import { AxiosError } from 'axios';
import {
  debounce,
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
import { searchData } from 'rest/miscAPI';
import { getTableDetails } from 'rest/tableAPI';
import { PAGE_SIZE } from '../../constants/constants';
import {
  ELEMENT_DELETE_STATE,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  ZOOM_TRANSITION_DURATION,
  ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
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
import jsonData from '../../jsons/en';
import { getEntityName } from '../../utils/CommonUtils';
import {
  createNewEdge,
  dragHandle,
  findUpstreamDownStreamEdge,
  getAllTracedColumnEdge,
  getAllTracedNodes,
  getClassifiedEdge,
  getColumnType,
  getDataLabel,
  getDeletedLineagePlaceholder,
  getEdgeStyle,
  getEdgeType,
  getLayoutedElements,
  getLineageData,
  getLoadingStatusValue,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getNodeRemoveButton,
  getRemovedNodeData,
  getSelectedEdgeArr,
  getUniqueFlowElements,
  getUpdatedEdge,
  getUpdatedEdgeWithPipeline,
  getUpdatedUpstreamDownStreamEdgeArr,
  getUpStreamDownStreamColumnLineageArr,
  isColumnLineageTraced,
  isTracedEdge,
  onLoad,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
} from '../../utils/EntityLineageUtils';
import { getEntityReferenceFromPipeline } from '../../utils/PipelineServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import EdgeInfoDrawer from '../EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../EntityInfoDrawer/EntityInfoDrawer.component';
import Loader from '../Loader/Loader';
import AddPipeLineModal from './AddPipeLineModal';
import CustomControlsComponent from './CustomControls.component';
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
import './entityLineage.style.less';
import EntityLineageSidebar from './EntityLineageSidebar.component';
import LineageNodeLabel from './LineageNodeLabel';
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
  onFullScreenClick,
  hasEditAccess,
  onExitFullScreenViewClick,
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
  const [expandAllColumns, setExpandAllColumns] = useState(false);
  const [status, setStatus] = useState<LoadingState>('initial');
  const [deletionState, setDeletionState] = useState<{
    loading: boolean;
    status: ElementLoadingState;
  }>(ELEMENT_DELETE_STATE);
  const [zoomValue, setZoomValue] = useState(ZOOM_VALUE);
  const [showAddPipelineModal, setShowAddPipelineModal] =
    useState<boolean>(false);
  const [pipelineSearchValue, setPipelineSearchValue] = useState<string>('');
  const [pipelineOptions, setPipelineOptions] = useState<EntityReference[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<
    string | undefined
  >();
  const [isTracingActive, setIsTracingActive] = useState(false);
  const [selectedEdgeInfo, setSelectedEdgeInfo] = useState<Edge>();

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

  const handleNodeSelection = (node: Node) => {
    const selectedNode = [
      ...(updatedLineageData.nodes || []),
      updatedLineageData.entity,
    ].find((n) => node.id.includes(n.id));

    if (!expandButton.current) {
      selectNodeHandler(true, {
        name: selectedNode?.name as string,
        fqn: selectedNode?.fullyQualifiedName as string,
        id: node.id,
        displayName: selectedNode?.displayName,
        type: selectedNode?.type as string,
        entityId: selectedNode?.id as string,
      });
    } else {
      expandButton.current = null;
    }
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
      setEdges((prevEdges) => {
        return prevEdges.filter((edge) => {
          const isRemovedEdge =
            edge.source === data.source.id && edge.target === data.target.id;

          return !isRemovedEdge;
        });
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

  const handleColumnClick = (column: string) => {
    const { columnEdge } = getClassifiedEdge(edges);
    const { incomingColumnEdges, outGoingColumnEdges, connectedColumnEdges } =
      getAllTracedColumnEdge(column, columnEdge);

    setNodes((prevNodes) => {
      return prevNodes.map((prevNode) => {
        const nodeTraced = prevNode.data.columns[column];
        prevNode.data = {
          ...prevNode.data,
          selected: !isUndefined(nodeTraced),
          isTraced: !isUndefined(nodeTraced),
          selectedColumns: connectedColumnEdges,
        };
        if (!isUndefined(nodeTraced)) {
          handleNodeSelection(prevNode);
        }

        return prevNode;
      });
    });
    setIsTracingActive(true);

    setEdges((prevEdges) => {
      return prevEdges.map((edge) => {
        const isTraced = isColumnLineageTraced(
          column,
          edge,
          incomingColumnEdges,
          outGoingColumnEdges
        );
        edge.style = {
          ...edge.style,
          ...getEdgeStyle(isTraced),
        };

        return edge;
      });
    });
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

  const addPipelineClick = (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => {
    setShowAddPipelineModal(true);
    evt.stopPropagation();
    if (!isUndefined(data.pipeline)) {
      setSelectedPipelineId(data.pipeline.id);
      setPipelineOptions([data.pipeline]);
    }

    setSelectedEdge({
      id: data.id,
      source: {} as EntityReference,
      target: {} as EntityReference,
      data,
    });
  };

  const handleRemoveEdgeClick = (evt: React.MouseEvent<HTMLButtonElement>) => {
    setShowAddPipelineModal(false);
    if (selectedEdge.data) {
      onEdgeClick(evt, selectedEdge.data);
    }
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
      const graphElements = getLineageData(
        data,
        selectNodeHandler,
        loadNodeHandler,
        lineageLeafNodes,
        isNodeLoading,
        isEditMode,
        'buttonedge',
        onEdgeClick,
        removeNodeHandler,
        tableColumnsRef.current,
        addPipelineClick,
        handleColumnClick,
        expandAllColumns
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
  const closeDrawer = () => {
    setIsDrawerOpen(false);
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

      if (target === source) {
        return;
      }

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
              ...currentEdge,
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
              onEdgeClick,
              addPipelineClick
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
            onEdgeClick,
            addPipelineClick
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

  const handlePipelineSelection = (value: string) => {
    setSelectedPipelineId(value);
  };

  const handleModalCancel = () => {
    setSelectedPipelineId(undefined);
    setShowAddPipelineModal(false);
    setSelectedEdge({} as SelectedEdge);
    setPipelineOptions([]);
  };

  const onPipelineSelectionClear = () => {
    setSelectedPipelineId(undefined);
    setPipelineSearchValue('');
  };

  const handleModalSave = () => {
    if (selectedEdge.data) {
      setStatus('waiting');
      setLoading(true);
      const { source, target } = selectedEdge.data;
      const allEdge = [
        ...(updatedLineageData.upstreamEdges || []),
        ...(updatedLineageData.downstreamEdges || []),
      ];

      const selectedEdgeValue = allEdge.find(
        (ed) => ed.fromEntity === source && ed.toEntity === target
      );

      const pipelineDetail = pipelineOptions.find(
        (d) => d.id === selectedPipelineId
      );

      const { newEdge, updatedLineageDetails } = getNewLineageConnectionDetails(
        selectedEdgeValue,
        selectedPipelineId,
        selectedEdge.data
      );

      addLineageHandler(newEdge)
        .then(() => {
          setStatus('success');
          setLoading(false);
          setUpdatedLineageData((pre) => {
            if (selectedEdge.data) {
              const newData = {
                ...pre,
                downstreamEdges: getUpdatedEdgeWithPipeline(
                  pre.downstreamEdges,
                  updatedLineageDetails,
                  selectedEdge.data,
                  pipelineDetail
                ),
                upstreamEdges: getUpdatedEdgeWithPipeline(
                  pre.upstreamEdges,
                  updatedLineageDetails,
                  selectedEdge.data,
                  pipelineDetail
                ),
              };

              return newData;
            }

            return pre;
          });
          setEdges((pre) => {
            return pre.map((edge) => {
              if (edge.id === selectedEdge.id) {
                return {
                  ...edge,
                  animated: true,
                  data: {
                    ...edge.data,
                    label: getEntityName(pipelineDetail),
                    pipeline: updatedLineageDetails.pipeline,
                  },
                };
              }

              return edge;
            });
          });
          setTimeout(() => {
            setStatus('initial');
          }, 100);
          setNewAddedNode({} as Node);
          setSelectedEntity({} as EntityReference);
        })
        .catch(() => {
          setStatus('initial');
          setLoading(false);
        })
        .finally(() => {
          handleModalCancel();
        });
    }
  };

  const handleLineageTracing = (selectedNode: Node) => {
    const { normalEdge } = getClassifiedEdge(edges);
    const incomingNode = getAllTracedNodes(
      selectedNode,
      nodes,
      normalEdge,
      [],
      true
    );
    const outgoingNode = getAllTracedNodes(
      selectedNode,
      nodes,
      normalEdge,
      [],
      false
    );
    const incomerIds = incomingNode.map((incomer) => incomer.id);
    const outgoerIds = outgoingNode.map((outGoer) => outGoer.id);
    setIsTracingActive(true);

    setEdges((prevEdges) => {
      return prevEdges.map((edge) => {
        const isStrokeNeeded = isTracedEdge(
          selectedNode,
          edge,
          incomerIds,
          outgoerIds
        );
        edge.style = {
          ...edge.style,
          ...getEdgeStyle(isStrokeNeeded),
        };

        return edge;
      });
    });

    setNodes((prevNodes) => {
      return prevNodes.map((prevNode) => {
        const highlight =
          prevNode.id === selectedNode.id ||
          incomerIds.includes(prevNode.id) ||
          outgoerIds.includes(prevNode.id);

        prevNode.data = {
          ...prevNode.data,
          isTraced: highlight,
          selected: prevNode.id === selectedNode.id,
          selectedColumns: [],
        };

        return prevNode;
      });
    });
  };

  /**
   * take element and perform onClick logic
   * @param node
   */
  const onNodeClick = (node: Node) => {
    if (isNode(node)) {
      setSelectedEdgeInfo(undefined);
      setIsDrawerOpen(false);
      handleLineageTracing(node);
      handleNodeSelection(node);
    }
  };
  const onPaneClick = () => {
    if (isTracingActive) {
      setEdges((prevEdges) => {
        return prevEdges.map((edge) => {
          edge.style = {
            ...edge.style,
            opacity: undefined,
            stroke: undefined,
            strokeWidth: undefined,
          };

          return edge;
        });
      });

      setNodes((prevNodes) => {
        return prevNodes.map((prevNode) => {
          prevNode.data = {
            ...prevNode.data,
            isTraced: false,
            selectedColumns: [],
            selected: false,
          };

          return prevNode;
        });
      });
      setIsTracingActive(false);
      setIsDrawerOpen(false);
    }
  };

  const updateColumnsToNode = (columns: Column[], id: string) => {
    setNodes((prevNodes) => {
      const updatedNode = prevNodes.map((node) => {
        if (node.id === id) {
          const cols: { [key: string]: ModifiedColumn } = {};
          columns.forEach((col) => {
            cols[col.fullyQualifiedName || col.name] = {
              ...col,
              type: isEditMode
                ? 'default'
                : getColumnType(edges, col.fullyQualifiedName || col.name),
            };
          });
          node.data.columns = cols;
        }

        return node;
      });

      return updatedNode;
    });
  };

  /**
   * take node and get the columns for that node
   * @param expandNode
   */
  const getTableColumns = async (expandNode?: EntityReference) => {
    if (expandNode) {
      try {
        const res = await getTableDetails(expandNode.id, ['columns']);
        const tableId = expandNode.id;
        const { columns } = res;
        tableColumnsRef.current[tableId] = columns;
        updateColumnsToNode(columns, tableId);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          `Error while fetching ${getDataLabel(
            expandNode.displayName,
            expandNode.name,
            true
          )} columns`
        );
      }
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
                      <LineageNodeLabel node={selectedEntity} />
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

  const handleEditLineageClick = () => {
    setEditMode((pre) => !pre && !deleted);
    resetSelectedData();
    setIsDrawerOpen(false);
  };

  const handleEdgeClick = (
    _e: React.MouseEvent<Element, MouseEvent>,
    edge: Edge
  ) => {
    setSelectedEdgeInfo(edge);
    setIsDrawerOpen(true);
  };

  const toggleColumnView = (value: boolean) => {
    setExpandAllColumns(value);
    setEdges((prevEdges) => {
      return prevEdges.map((edge) => {
        edge.data.isExpanded = value;

        return edge;
      });
    });
    setNodes((prevNodes) => {
      const updatedNode = prevNodes.map((node) => {
        node.data.isExpanded = value;

        return node;
      });
      const { edge, node } = getLayoutedElements({
        node: updatedNode,
        edge: edges,
      });
      setEdges(edge);

      return node;
    });

    setTimeout(() => {
      reactFlowInstance?.fitView();
    }, 100);
  };

  const handleExpandColumnClick = () => {
    if (expandAllColumns) {
      toggleColumnView(false);
    } else {
      const allTableNodes = [
        updatedLineageData.entity,
        ...(updatedLineageData.nodes || []),
      ].filter(
        (node) =>
          node.type === EntityType.TABLE &&
          isUndefined(tableColumnsRef.current[node.id])
      );

      allTableNodes.length &&
        allTableNodes.map(async (node) => await getTableColumns(node));
      toggleColumnView(true);
    }
  };

  const getSearchResults = async (value = '*') => {
    try {
      const data = await searchData(
        value,
        1,
        PAGE_SIZE,
        '',
        '',
        '',
        SearchIndex.PIPELINE
      );
      setPipelineOptions(
        data.data.hits.hits.map((hit) =>
          getEntityReferenceFromPipeline(hit._source)
        )
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-suggestions-error']
      );
    }
  };

  const handleOptionSelect = (value?: string) => {
    if (value) {
      const selectedNode = nodes.find((node) => node.id === value);

      if (selectedNode) {
        const { position } = selectedNode;
        onNodeClick(selectedNode);
        // moving selected node in center
        reactFlowInstance &&
          reactFlowInstance.setCenter(position.x, position.y, {
            duration: ZOOM_TRANSITION_DURATION,
            zoom: MIN_ZOOM_VALUE,
          });
      } else {
        onPaneClick();
      }
    }
  };

  /**
   * Handle updated lineage nodes
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
            data: {
              ...el.data,
              label: <LineageNodeLabel node={newlyAddedNode} />,
            },
          };
        } else {
          return el;
        }
      });
    });
  };

  const handleZoomLevel = debounce((value: number) => {
    setZoomValue(value);
  }, 150);

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

  useEffect(() => {
    if (pipelineSearchValue) {
      getSearchResults(pipelineSearchValue);
    }
  }, [pipelineSearchValue]);

  if (isLoading || (nodes.length === 0 && !deleted)) {
    return <Loader />;
  }

  if (deleted) {
    return getDeletedLineagePlaceholder();
  }

  return (
    <div className="relative h-full" data-testid="lineage-container">
      <div className="w-full h-full" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            className="custom-react-flow"
            data-testid="react-flow-component"
            edgeTypes={customEdges}
            edges={edges}
            maxZoom={MAX_ZOOM_VALUE}
            minZoom={MIN_ZOOM_VALUE}
            nodeTypes={nodeTypes}
            nodes={nodes}
            nodesConnectable={isEditMode}
            selectNodesOnDrag={false}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onEdgeClick={handleEdgeClick}
            onEdgesChange={onEdgesChange}
            onInit={(reactFlowInstance: ReactFlowInstance) => {
              onLoad(reactFlowInstance);
              setReactFlowInstance(reactFlowInstance);
            }}
            onMove={(_e, viewPort) => handleZoomLevel(viewPort.zoom)}
            onNodeClick={(_e, node) => onNodeClick(node)}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDrag={dragHandle}
            onNodeDragStart={dragHandle}
            onNodeDragStop={dragHandle}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeMouseMove={onNodeMouseMove}
            onNodesChange={onNodesChange}
            onPaneClick={onPaneClick}>
            <CustomControlsComponent
              className="absolute top-1 right-1 bottom-full"
              deleted={deleted}
              fitViewParams={{
                minZoom: MIN_ZOOM_VALUE,
                maxZoom: MAX_ZOOM_VALUE,
              }}
              handleFullScreenViewClick={onFullScreenClick}
              hasEditAccess={hasEditAccess}
              isColumnsExpanded={expandAllColumns}
              isEditMode={isEditMode}
              lineageData={updatedLineageData}
              loading={loading}
              status={status}
              zoomValue={zoomValue}
              onEditLinageClick={handleEditLineageClick}
              onExitFullScreenViewClick={onExitFullScreenViewClick}
              onExpandColumnClick={handleExpandColumnClick}
              onOptionSelect={handleOptionSelect}
            />
            {isEditMode && (
              <Background gap={12} size={1} variant={BackgroundVariant.Lines} />
            )}
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      {isDrawerOpen &&
        !isEditMode &&
        (selectedEdgeInfo ? (
          <EdgeInfoDrawer
            edge={selectedEdgeInfo}
            nodes={nodes}
            visible={isDrawerOpen}
            onClose={() => {
              setIsDrawerOpen(false);
              setSelectedEdgeInfo(undefined);
            }}
          />
        ) : (
          <EntityInfoDrawer
            isMainNode={selectedNode.name === updatedLineageData.entity?.name}
            selectedNode={selectedNode}
            show={isDrawerOpen}
            onCancel={closeDrawer}
          />
        ))}
      <EntityLineageSidebar newAddedNode={newAddedNode} show={isEditMode} />
      {showDeleteModal && (
        <Modal
          okText={getLoadingStatusValue(
            'Confirm',
            deletionState.loading,
            deletionState.status
          )}
          open={showDeleteModal}
          title="Remove lineage edge"
          onCancel={() => {
            setShowDeleteModal(false);
          }}
          onOk={onRemove}>
          {getModalBodyText(selectedEdge)}
        </Modal>
      )}

      <AddPipeLineModal
        pipelineOptions={pipelineOptions}
        pipelineSearchValue={pipelineSearchValue}
        selectedPipelineId={selectedPipelineId}
        showAddPipelineModal={showAddPipelineModal}
        onClear={onPipelineSelectionClear}
        onModalCancel={handleModalCancel}
        onRemoveEdgeClick={handleRemoveEdgeClick}
        onSave={handleModalSave}
        onSearch={(value) => setPipelineSearchValue(value)}
        onSelect={handlePipelineSelection}
      />
    </div>
  );
};

export default withLoader<EntityLineageProp>(EntityLineageComponent);

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

import { Button, Card, Modal } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { debounce, isEmpty, isNil, isUndefined, union, uniqueId } from 'lodash';
import { LoadingState } from 'Models';
import Qs from 'qs';
import React, {
  DragEvent,
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import ReactFlow, {
  addEdge,
  Background,
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
import { PAGE_SIZE } from '../../../constants/constants';
import {
  ELEMENT_DELETE_STATE,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  ZOOM_TRANSITION_DURATION,
  ZOOM_VALUE,
} from '../../../constants/Lineage.constants';
import { mockDatasetData } from '../../../constants/mockTourData.constants';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { AddLineage } from '../../../generated/api/lineage/addLineage';
import { Column } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import {
  ColumnLineage,
  EntityLineage,
  LineageDetails,
} from '../../../generated/type/entityLineage';
import { withLoader } from '../../../hoc/withLoader';
import { getDataModelDetails } from '../../../rest/dataModelsAPI';
import { getLineageByFQN, updateLineageEdge } from '../../../rest/lineageAPI';
import { searchData } from '../../../rest/miscAPI';
import { getTableDetails } from '../../../rest/tableAPI';
import {
  addLineageHandler,
  createNewEdge,
  customEdges,
  dragHandle,
  findNodeById,
  findUpstreamDownStreamEdge,
  getAllTracedColumnEdge,
  getAllTracedNodes,
  getChildMap,
  getClassifiedEdge,
  getColumnType,
  getDeletedLineagePlaceholder,
  getEdgeStyle,
  getEdgeType,
  getLayoutedElements,
  getLineageData,
  getLoadingStatusValue,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getNewNodes,
  getPaginatedChildMap,
  getRemovedNodeData,
  getSelectedEdgeArr,
  getUniqueFlowElements,
  getUpdatedEdge,
  getUpdatedEdgeWithPipeline,
  getUpdatedUpstreamDownStreamEdgeArr,
  getUpStreamDownStreamColumnLineageArr,
  isColumnLineageTraced,
  isTracedEdge,
  nodeTypes,
  onLoad,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
  removeLineageHandler,
  updateEdgesWithLineageDetails,
} from '../../../utils/EntityLineageUtils';
import {
  getEntityBreadcrumbs,
  getEntityLineage,
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../Loader/Loader';
import { useTourProvider } from '../../TourProvider/TourProvider';
import EdgeInfoDrawer from '../EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../EntityInfoDrawer/EntityInfoDrawer.component';
import AddPipeLineModal from './AppPipelineModel/AddPipeLineModal';
import CustomControlsComponent from './CustomControls.component';
import './entity-lineage.style.less';
import {
  CustomEdgeData,
  CustomElement,
  EdgeData,
  EdgeTypeEnum,
  ElementLoadingState,
  EntityLineageProp,
  EntityReferenceChild,
  LeafNodes,
  LineageConfig,
  LineagePos,
  LoadingNodeState,
  ModifiedColumn,
  NodeIndexMap,
  SelectedEdge,
  SelectedNode,
} from './EntityLineage.interface';
import EntityLineageSidebar from './EntityLineageSidebar.component';
import NodeSuggestions from './NodeSuggestions.component';

const EntityLineageComponent: FunctionComponent<EntityLineageProp> = ({
  deleted,
  hasEditAccess,
  entityType,
  entity,
}: EntityLineageProp) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isTourOpen } = useTourProvider();
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
  const [showAddEdgeModal, setShowAddEdgeModal] = useState<boolean>(false);
  const [edgeSearchValue, setEdgeSearchValue] = useState<string>('');
  const [edgeOptions, setEdgeOptions] = useState<EntityReference[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>();
  const [isTracingActive, setIsTracingActive] = useState(false);
  const [selectedEdgeInfo, setSelectedEdgeInfo] = useState<Edge>();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const edgesRef = useRef<Edge[]>([]);
  const [paginationData, setPaginationData] = useState({});
  const [entityLineage, setEntityLineage] = useState<EntityLineage>();
  const [updatedLineageData, setUpdatedLineageData] = useState<EntityLineage>();
  const [childMap, setChildMap] = useState<EntityReferenceChild>();
  const [isLineageLoading, setIsLineageLoading] = useState(false);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [lineageConfig, setLineageConfig] = useState<LineageConfig>({
    upstreamDepth: 1,
    downstreamDepth: 1,
    nodesPerLayer: 50,
  });

  const { fqn: entityFQN } = useParams<{ fqn: string }>();
  const queryParams = new URLSearchParams(location.search);

  const isFullScreen = queryParams.get('fullscreen') === 'true';

  const history = useHistory();

  const onFullScreenClick = useCallback(() => {
    history.push({
      search: Qs.stringify({ fullscreen: true }),
    });
  }, [entityType, entityFQN]);

  const breadcrumbs = useMemo(
    () =>
      entity
        ? [
            ...getEntityBreadcrumbs(entity, entityType),
            {
              name: t('label.lineage'),
              url: '',
              activeTitle: true,
            },
          ]
        : [],
    [entity]
  );

  const fetchLineageData = useCallback(
    async (config: LineageConfig) => {
      if (isTourOpen) {
        setPaginationData({});
        setEntityLineage(mockDatasetData.entityLineage);
        setUpdatedLineageData(mockDatasetData.entityLineage);
      } else {
        setIsLineageLoading(true);
        try {
          const res = await getLineageByFQN(
            entityFQN,
            entityType,
            config.upstreamDepth,
            config.downstreamDepth
          );
          if (res) {
            setPaginationData({});
            setEntityLineage(res);
            setUpdatedLineageData(res);
          } else {
            showErrorToast(
              t('server.entity-fetch-error', {
                entity: t('label.lineage-data-lowercase'),
              })
            );
          }
        } catch (err) {
          showErrorToast(
            err as AxiosError,
            t('server.entity-fetch-error', {
              entity: t('label.lineage-data-lowercase'),
            })
          );
        } finally {
          setIsLineageLoading(false);
        }
      }
    },
    [entityFQN, entityType]
  );

  const loadNodeHandler = useCallback(
    async (node: EntityReference, pos: LineagePos) => {
      setNodeLoading((prev) => ({ ...prev, id: node.id, state: true }));
      try {
        const res = await getLineageByFQN(
          node.fullyQualifiedName ?? '',
          node.type,
          lineageConfig.upstreamDepth,
          lineageConfig.downstreamDepth
        );
        if (res && entityLineage) {
          setNodeLoading((prev) => ({ ...prev, id: node.id, state: false }));
          setLeafNode(res, pos);
          const newLineageData = getEntityLineage(entityLineage, res, pos);
          setEntityLineage(newLineageData);
          setUpdatedLineageData(newLineageData);
        }
      } catch (err) {
        setNodeLoading((prev) => ({ ...prev, id: node.id, state: false }));
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.lineage-node-lowercase'),
          })
        );
      }
    },
    [entityLineage, lineageConfig, setNodeLoading]
  );

  const setLeafNode = useCallback(
    (val: EntityLineage, pos: LineagePos) => {
      if (pos === 'to' && val.downstreamEdges?.length === 0) {
        setLeafNodes((prev) => ({
          ...prev,
          downStreamNode: [...(prev.downStreamNode ?? []), val.entity.id],
        }));
      }
      if (pos === 'from' && val.upstreamEdges?.length === 0) {
        setLeafNodes((prev) => ({
          ...prev,
          upStreamNode: [...(prev.upStreamNode ?? []), val.entity.id],
        }));
      }
    },
    [setLeafNodes]
  );

  const onExitFullScreenViewClick = useCallback(() => {
    history.push({
      search: '',
    });
  }, [entityType, entityFQN, history]);

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

  const selectLoadMoreNode = (node: Node) => {
    const { pagination_data, edgeType } = node.data.node;
    setPaginationData(
      (prevState: {
        [key: string]: { upstream: number[]; downstream: number[] };
      }) => {
        const { parentId, index } = pagination_data;
        const updatedParentData = prevState[parentId] || {
          upstream: [],
          downstream: [],
        };
        const updatedIndexList =
          edgeType === EdgeTypeEnum.DOWN_STREAM
            ? {
                upstream: updatedParentData.upstream,
                downstream: [index],
              }
            : {
                upstream: [index],
                downstream: updatedParentData.downstream,
              };

        const retnObj = {
          ...prevState,
          [parentId]: updatedIndexList,
        };
        if (updatedLineageData) {
          initLineageChildMaps(updatedLineageData, childMap, retnObj);
        }

        return retnObj;
      }
    );
  };

  const handleNodeSelection = (node: Node) => {
    if (node.type === EntityLineageNodeType.LOAD_MORE) {
      selectLoadMoreNode(node);
    } else {
      const selectedNode = node.data.node;
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
    }
  };

  const handleModalCancel = () => {
    setSelectedEdgeId(undefined);
    setShowAddEdgeModal(false);
    setSelectedEdge({} as SelectedEdge);
    setEdgeOptions([]);
  };

  /**
   *
   * @param data selected edge
   * @param confirmDelete confirmation state for deleting selected edge
   */
  const removeEdgeHandler = (
    { source, target }: SelectedEdge,
    confirmDelete: boolean
  ) => {
    if (confirmDelete && updatedLineageData) {
      const edgeData: EdgeData = {
        fromEntity: source.type,
        fromId: source.id,
        toEntity: target.type,
        toId: target.id,
      };
      removeLineageHandler(edgeData);
      setEdges((prevEdges) => {
        return prevEdges.filter((edge) => {
          const isRemovedEdge =
            edge.source === source.id && edge.target === target.id;

          return !isRemovedEdge;
        });
      });
      const newDownStreamEdges = getSelectedEdgeArr(
        updatedLineageData?.downstreamEdges || [],
        edgeData
      );
      const newUpStreamEdges = getSelectedEdgeArr(
        updatedLineageData?.upstreamEdges || [],
        edgeData
      );

      setUpdatedLineageData({
        ...updatedLineageData,
        downstreamEdges: newDownStreamEdges,
        upstreamEdges: newUpStreamEdges,
      });

      resetSelectedData();
      setConfirmDelete(false);
      handleModalCancel();
    }
  };

  const removeColumnEdge = (data: SelectedEdge, confirmDelete: boolean) => {
    if (confirmDelete && updatedLineageData) {
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
    const { columnEdge } = getClassifiedEdge(edgesRef.current);
    const { incomingColumnEdges, outGoingColumnEdges, connectedColumnEdges } =
      getAllTracedColumnEdge(column, columnEdge);

    setNodes((prevNodes) => {
      return prevNodes.map((prevNode) => {
        const { columns } = prevNode.data;
        const nodeTraced = columns && columns[column];

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
    if (!updatedLineageData) {
      return;
    }
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
    setShowAddEdgeModal(true);
    evt.stopPropagation();
    if (!isUndefined(data.pipeline)) {
      setSelectedEdgeId(data.pipeline.id);
      setEdgeOptions([data.pipeline]);
    }

    setSelectedEdge({
      id: data.id,
      source: {} as EntityReference,
      target: {} as EntityReference,
      data,
    });
  };

  const handleRemoveEdgeClick = (evt: React.MouseEvent<HTMLButtonElement>) => {
    setShowAddEdgeModal(false);
    if (selectedEdge.data) {
      onEdgeClick(evt, selectedEdge.data);
    }
  };

  const removeNodeHandler = useCallback(
    (node: Node) => {
      if (!updatedLineageData) {
        return;
      }
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
      delete tableColumnsRef.current[node.id];
    },
    [nodes, updatedLineageData]
  );

  const getColumnsForNode = async (type: string, id: string) => {
    const fields = ['columns'];

    if (type === EntityType.DASHBOARD_DATA_MODEL) {
      return await getDataModelDetails(id, fields);
    }

    return await getTableDetails(id, fields);
  };

  /**
   * take node and get the columns for that node
   * @param expandNode
   */
  const getTableColumns = async (expandNode?: EntityReference) => {
    if (expandNode) {
      try {
        const res = await getColumnsForNode(expandNode.type, expandNode.id);
        const nodeId = expandNode.id;
        const { columns } = res;
        tableColumnsRef.current[nodeId] = columns;
        updateColumnsToNode(columns, nodeId);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityName: expandNode.displayName ?? expandNode.name,
            entityType: t('label.column-plural'),
          })
        );
      }
    }
  };

  const handleNodeExpand = (isExpanded: boolean, node: EntityReference) => {
    if (isExpanded) {
      setNodes((prevState) => {
        const newNodes = prevState.map((prevNode) => {
          if (prevNode.id === node.id) {
            const nodeId = node.id;
            prevNode.data.isExpanded = true;
            if (isUndefined(tableColumnsRef.current[nodeId])) {
              getTableColumns(node);
            } else {
              const cols: { [key: string]: ModifiedColumn } = {};
              tableColumnsRef.current[nodeId]?.forEach((col) => {
                cols[col.fullyQualifiedName || col.name] = {
                  ...col,
                  type: isEditMode
                    ? EntityLineageNodeType.DEFAULT
                    : getColumnType(
                        edgesRef.current,
                        col.fullyQualifiedName || col.name
                      ),
                };
              });
              prevNode.data.columns = cols;
            }
          }

          return prevNode;
        });

        return newNodes;
      });
    } else {
      setNodes((prevState) => {
        const newNodes = prevState.map((n) => {
          if (n.id === node.id) {
            n.data.isExpanded = false;
            n.data.columns = undefined;
          }

          return n;
        });

        return newNodes;
      });
    }
  };

  const setElementsHandle = (data: EntityLineage, activeNodeId?: string) => {
    if (!isEmpty(data)) {
      const graphElements = getLineageData(
        data,
        selectNodeHandler,
        loadNodeHandler,
        leafNodes,
        isNodeLoading,
        isEditMode,
        'buttonedge',
        onEdgeClick,
        removeNodeHandler,
        tableColumnsRef.current,
        addPipelineClick,
        handleColumnClick,
        expandAllColumns,
        handleNodeExpand
      ) as CustomElement;

      const uniqueElements: CustomElement = {
        node: getUniqueFlowElements(graphElements.node) as Node[],
        edge: getUniqueFlowElements(graphElements.edge) as Edge[],
      };
      const { node, edge } = getLayoutedElements(uniqueElements);
      setNodes(node);
      setEdges(edge);

      setConfirmDelete(false);
      if (activeNodeId) {
        const activeNode = node.find((item) => item.id === activeNodeId);
        if (activeNode) {
          selectNode(activeNode);
        }
      }
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
    return updatedLineageData &&
      queryStr.includes(updatedLineageData.entity?.id)
      ? updatedLineageData.entity
      : selectedEntity;
  };

  const getUpdatedNodes = (entityLineage: EntityLineage) => {
    return entityLineage && !isEmpty(selectedEntity)
      ? [...(entityLineage.nodes || []), selectedEntity]
      : entityLineage.nodes;
  };

  /**
   * take edge or connection to add new element in the graph
   * @param params
   */
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      if (!updatedLineageData) {
        return;
      }
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
              if (!updatedLineageData) {
                return;
              }
              setStatus('success');
              setLoading(false);
              setUpdatedLineageData((pre) => {
                if (!pre) {
                  return;
                }
                const newData = {
                  ...pre,
                  nodes: getUpdatedNodes(pre),
                  downstreamEdges: updatedStreamEdges(
                    pre?.downstreamEdges,
                    EdgeTypeEnum.DOWN_STREAM
                  ),
                  upstreamEdges: updatedStreamEdges(
                    pre?.upstreamEdges,
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

  const handleEdgeSelection = (value: string) => {
    setSelectedEdgeId(value);
  };

  const handleModalSave = () => {
    if (selectedEdge.data && updatedLineageData) {
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

      const edgeDetails = edgeOptions.find((d) => d.id === selectedEdgeId);

      const { newEdge, updatedLineageDetails } = getNewLineageConnectionDetails(
        selectedEdgeValue,
        selectedEdgeId,
        selectedEdge.data,
        (edgeDetails?.type as EntityType) ?? EntityType.PIPELINE,
        edgeDetails
      );

      addLineageHandler(newEdge)
        .then(() => {
          setStatus('success');
          setLoading(false);
          setUpdatedLineageData((pre) => {
            if (selectedEdge.data && pre) {
              const newData = {
                ...pre,
                downstreamEdges: getUpdatedEdgeWithPipeline(
                  pre.downstreamEdges,
                  updatedLineageDetails,
                  selectedEdge.data,
                  edgeDetails
                ),
                upstreamEdges: getUpdatedEdgeWithPipeline(
                  pre.upstreamEdges,
                  updatedLineageDetails,
                  selectedEdge.data,
                  edgeDetails
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
                    label: getEntityName(edgeDetails),
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
                : getColumnType(
                    edgesRef.current,
                    col.fullyQualifiedName || col.name
                  ),
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
   * handle node drag event
   * @param event
   */
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

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
        className: '',
        connectable: false,
        selectable: false,
        type: 'default',
        data: {
          label: (
            <div className="relative">
              <Button
                className="lineage-node-remove-btn bg-body-hover"
                icon={
                  <SVGIcons
                    alt="times-circle"
                    icon="icon-times-circle"
                    width="16px"
                  />
                }
                type="link"
                onClick={() => removeNodeHandler(newNode as Node)}
              />

              <NodeSuggestions
                entityType={label}
                onSelectHandler={setSelectedEntity}
              />
            </div>
          ),
          removeNodeHandler,
          onNodeExpand: handleNodeExpand,
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
                  node: selectedEntity,
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
  const onRemove = useCallback(() => {
    setDeletionState({ ...ELEMENT_DELETE_STATE, loading: true });
    setTimeout(() => {
      setDeletionState({ ...ELEMENT_DELETE_STATE, status: 'success' });
      setTimeout(() => {
        setShowDeleteModal(false);
        setConfirmDelete(true);
        setDeletionState((pre) => ({ ...pre, status: 'initial' }));
      }, 500);
    }, 500);
  }, []);

  const handleEditLineageClick = useCallback(() => {
    setEditMode((pre) => !pre && !deleted);
    resetSelectedData();
    setIsDrawerOpen(false);
  }, [deleted]);

  const handleEdgeClick = useCallback(
    (_e: React.MouseEvent<Element, MouseEvent>, edge: Edge) => {
      setSelectedEdgeInfo(edge);
      setIsDrawerOpen(true);
    },
    []
  );

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
  };

  const handleExpandColumnClick = () => {
    if (!updatedLineageData) {
      return;
    }
    if (expandAllColumns) {
      toggleColumnView(false);
    } else {
      const allTableNodes = nodes
        .map((item) => item.data.node)
        .filter(
          (node) =>
            [EntityType.TABLE, EntityType.DASHBOARD_DATA_MODEL].includes(
              node.type as EntityType
            ) && isUndefined(tableColumnsRef.current[node.id])
        );

      allTableNodes.length &&
        allTableNodes.map(async (node) => await getTableColumns(node));
      toggleColumnView(true);
    }
  };

  const getSearchResults = async (value = '*') => {
    try {
      const data = await searchData(value, 1, PAGE_SIZE, '', '', '', [
        SearchIndex.PIPELINE,
        SearchIndex.STORED_PROCEDURE,
      ]);

      const selectedPipeline = selectedEdge.data?.pipeline;

      const edgeOptions = data.data.hits.hits.map((hit) =>
        getEntityReferenceFromEntity(
          hit._source,
          hit._source.entityType as EntityType
        )
      );

      const optionContainItem = edgeOptions.find(
        (item) => item.id === selectedEdgeId
      );

      setEdgeOptions([
        ...(selectedPipeline &&
        isEmpty(optionContainItem) &&
        isEmpty(edgeSearchValue) &&
        selectedPipeline.id === selectedEdgeId
          ? [selectedPipeline]
          : []),
        ...edgeOptions,
      ]);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    }
  };

  const handleLineageConfigUpdate = useCallback((config: LineageConfig) => {
    setLineageConfig(config);
    fetchLineageData(config);
  }, []);
  const selectNode = (node: Node) => {
    const { position } = node;
    onNodeClick(node);
    // moving selected node in center
    reactFlowInstance &&
      reactFlowInstance.setCenter(position.x, position.y, {
        duration: ZOOM_TRANSITION_DURATION,
        zoom: zoomValue,
      });
  };

  const handleOptionSelect = (value?: string) => {
    if (value) {
      const selectedNode = nodes.find((node) => node.id === value);

      if (selectedNode) {
        selectNode(selectedNode);
      } else {
        const path = findNodeById(value, childMap?.children, []) || [];
        const lastNode = path[path?.length - 1];
        if (updatedLineageData) {
          const { nodes, edges } = getPaginatedChildMap(
            updatedLineageData,
            childMap,
            paginationData,
            lineageConfig.nodesPerLayer
          );
          const newNodes = union(nodes, path);
          setElementsHandle(
            {
              ...updatedLineageData,
              nodes: newNodes,
              downstreamEdges: [
                ...(updatedLineageData.downstreamEdges || []),
                ...edges,
              ],
            },
            lastNode.id
          );
        }
      }
    }
  };

  const onEdgeDescriptionUpdate = useCallback(
    async (updatedEdgeDetails: AddLineage) => {
      try {
        await updateLineageEdge(updatedEdgeDetails);
        if (selectedEdgeInfo) {
          const updatedSelectedEdgeInfo = {
            ...selectedEdgeInfo,
            data: {
              ...selectedEdgeInfo.data,
              edge: {
                ...selectedEdgeInfo.data.edge,
                lineageDetails: updatedEdgeDetails.edge.lineageDetails,
              },
            },
          };

          const updatedEdges = edges.map((edge) =>
            edge.id === selectedEdgeInfo.id ? updatedSelectedEdgeInfo : edge
          );

          setEdges(updatedEdges);
          setSelectedEdgeInfo(updatedSelectedEdgeInfo);

          setUpdatedLineageData((pre) => {
            if (!pre) {
              return;
            }

            const newData = {
              ...pre,
              downstreamEdges: updateEdgesWithLineageDetails(
                pre.downstreamEdges ?? [],
                updatedEdgeDetails
              ),
              upstreamEdges: updateEdgesWithLineageDetails(
                pre.upstreamEdges ?? [],
                updatedEdgeDetails
              ),
            };

            return newData;
          });
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [edges, selectedEdgeInfo, updatedLineageData, setUpdatedLineageData]
  );

  /**
   * Handle updated lineage nodes
   * Change newly added node label based on entity:EntityReference
   */
  const handleUpdatedLineageNode = () => {
    const uNodes = updatedLineageData?.nodes;
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

  const initLineageChildMaps = (
    lineageData: EntityLineage,
    childMapObj: EntityReferenceChild | undefined,
    paginationObj: Record<string, NodeIndexMap>
  ) => {
    if (lineageData && childMapObj) {
      const { nodes: newNodes, edges } = getPaginatedChildMap(
        lineageData,
        childMapObj,
        paginationObj,
        lineageConfig.nodesPerLayer
      );
      setElementsHandle({
        ...lineageData,
        nodes: newNodes,
        downstreamEdges: [...(lineageData.downstreamEdges || []), ...edges],
      });
    }
  };

  useEffect(() => {
    if (!entity?.deleted) {
      fetchLineageData(lineageConfig);
    }
  }, [entity?.deleted]);

  useEffect(() => {
    if (!entityLineage) {
      return;
    }
    if (
      !isEmpty(entityLineage) &&
      !isUndefined(entityLineage.entity) &&
      !deleted
    ) {
      const childMapObj: EntityReferenceChild = getChildMap(entityLineage);
      setChildMap(childMapObj);
      initLineageChildMaps(entityLineage, childMapObj, paginationData);
    }
  }, [entityLineage]);

  useEffect(() => {
    if (!updatedLineageData) {
      return;
    }
    setEntityLineage({
      ...updatedLineageData,
      nodes: getNewNodes(updatedLineageData),
    });
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
    if (showAddEdgeModal) {
      getSearchResults(edgeSearchValue);
    }
  }, [edgeSearchValue, showAddEdgeModal]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  if (isLineageLoading || (nodes.length === 0 && !deleted)) {
    return <Loader />;
  }

  if (deleted) {
    return getDeletedLineagePlaceholder();
  }

  return (
    <Card
      className={classNames('lineage-card card-body-full w-auto border-none', {
        'full-screen-lineage': isFullScreen,
      })}
      data-testid="lineage-details"
      id="lineageDetails">
      {isFullScreen && (
        <TitleBreadcrumb className="p-md" titleLinks={breadcrumbs} />
      )}
      <div className="relative h-full" data-testid="lineage-container">
        <div className="w-full h-full" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              onlyRenderVisibleElements
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
              onNodeClick={(_e, node) => {
                onNodeClick(node);
                _e.stopPropagation();
              }}
              onNodeContextMenu={onNodeContextMenu}
              onNodeDrag={dragHandle}
              onNodeDragStart={dragHandle}
              onNodeDragStop={dragHandle}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onNodeMouseMove={onNodeMouseMove}
              onNodesChange={onNodesChange}
              onPaneClick={onPaneClick}>
              {updatedLineageData && (
                <CustomControlsComponent
                  className="absolute top-1 right-1 bottom-full p-md"
                  deleted={deleted}
                  fitViewParams={{
                    minZoom: MIN_ZOOM_VALUE,
                    maxZoom: MAX_ZOOM_VALUE,
                  }}
                  handleFullScreenViewClick={
                    !isFullScreen ? onFullScreenClick : undefined
                  }
                  hasEditAccess={hasEditAccess}
                  isColumnsExpanded={expandAllColumns}
                  isEditMode={isEditMode}
                  lineageConfig={lineageConfig}
                  lineageData={updatedLineageData}
                  loading={loading}
                  status={status}
                  zoomValue={zoomValue}
                  onEditLinageClick={handleEditLineageClick}
                  onExitFullScreenViewClick={
                    isFullScreen ? onExitFullScreenViewClick : undefined
                  }
                  onExpandColumnClick={handleExpandColumnClick}
                  onLineageConfigUpdate={handleLineageConfigUpdate}
                  onOptionSelect={handleOptionSelect}
                />
              )}
              <Background gap={12} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        {isDrawerOpen &&
          !isEditMode &&
          (selectedEdgeInfo ? (
            <EdgeInfoDrawer
              edge={selectedEdgeInfo}
              hasEditAccess={hasEditAccess}
              nodes={nodes}
              visible={isDrawerOpen}
              onClose={() => {
                setIsDrawerOpen(false);
                setSelectedEdgeInfo(undefined);
              }}
              onEdgeDescriptionUpdate={onEdgeDescriptionUpdate}
            />
          ) : (
            <EntityInfoDrawer
              isMainNode={
                selectedNode.name === updatedLineageData?.entity?.name
              }
              selectedNode={selectedNode}
              show={isDrawerOpen}
              onCancel={closeDrawer}
            />
          ))}
        <EntityLineageSidebar newAddedNode={newAddedNode} show={isEditMode} />
        {showDeleteModal && (
          <Modal
            maskClosable={false}
            okText={getLoadingStatusValue(
              t('label.confirm'),
              deletionState.loading,
              deletionState.status
            )}
            open={showDeleteModal}
            title={t('message.remove-lineage-edge')}
            onCancel={() => {
              setShowDeleteModal(false);
            }}
            onOk={onRemove}>
            {getModalBodyText(selectedEdge)}
          </Modal>
        )}

        <AddPipeLineModal
          edgeOptions={edgeOptions}
          edgeSearchValue={edgeSearchValue}
          selectedEdgeId={selectedEdgeId}
          showAddEdgeModal={showAddEdgeModal}
          onModalCancel={handleModalCancel}
          onRemoveEdgeClick={handleRemoveEdgeClick}
          onSave={handleModalSave}
          onSearch={(value) => setEdgeSearchValue(value)}
          onSelect={handleEdgeSelection}
        />
      </div>
    </Card>
  );
};

export default withLoader<EntityLineageProp>(EntityLineageComponent);

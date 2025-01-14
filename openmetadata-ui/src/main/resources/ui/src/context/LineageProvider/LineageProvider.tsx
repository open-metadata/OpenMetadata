/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Modal } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  isEmpty,
  isEqual,
  isUndefined,
  uniq,
  uniqueId,
  uniqWith,
} from 'lodash';
import { LoadingState } from 'Models';
import QueryString from 'qs';
import React, {
  createContext,
  DragEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Connection,
  Edge,
  getConnectedEdges,
  Node,
  NodeProps,
  ReactFlowInstance,
  useEdgesState,
  useKeyPress,
  useNodesState,
} from 'reactflow';
import { ReactComponent as IconTimesCircle } from '../../assets/svg/ic-times-circle.svg';
import { useEntityExportModalProvider } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import EdgeInfoDrawer from '../../components/Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../../components/Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import AddPipeLineModal from '../../components/Entity/EntityLineage/AppPipelineModel/AddPipeLineModal';
import {
  EdgeData,
  EdgeTypeEnum,
  ElementLoadingState,
  EntityReferenceChild,
  LineageConfig,
  NodeIndexMap,
} from '../../components/Entity/EntityLineage/EntityLineage.interface';
import EntityLineageSidebar from '../../components/Entity/EntityLineage/EntityLineageSidebar.component';
import NodeSuggestions from '../../components/Entity/EntityLineage/NodeSuggestions.component';
import {
  EdgeDetails,
  EntityLineageResponse,
} from '../../components/Lineage/Lineage.interface';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import {
  ELEMENT_DELETE_STATE,
  ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { EntityLineageNodeType, EntityType } from '../../enums/entity.enum';
import { AddLineage } from '../../generated/api/lineage/addLineage';
import { LineageSettings } from '../../generated/configuration/lineageSettings';
import { LineageLayer } from '../../generated/settings/settings';
import {
  ColumnLineage,
  EntityReference,
  LineageDetails,
} from '../../generated/type/entityLineage';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../hooks/useFqn';
import {
  exportLineageAsync,
  getDataQualityLineage,
  getLineageDataByFQN,
  updateLineageEdge,
} from '../../rest/lineageAPI';
import {
  addLineageHandler,
  centerNodePosition,
  createEdges,
  createNewEdge,
  createNodes,
  decodeLineageHandles,
  getAllTracedColumnEdge,
  getAllTracedNodes,
  getChildMap,
  getClassifiedEdge,
  getConnectedNodesEdges,
  getELKLayoutedElements,
  getLineageEdge,
  getLineageEdgeForAPI,
  getLoadingStatusValue,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getPaginatedChildMap,
  getUpdatedColumnsFromEdge,
  getUpstreamDownstreamNodesEdges,
  onLoad,
  positionNodesUsingElk,
  removeLineageHandler,
} from '../../utils/EntityLineageUtils';
import { getEntityReferenceFromEntity } from '../../utils/EntityUtils';
import tableClassBase from '../../utils/TableClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { useTourProvider } from '../TourProvider/TourProvider';
import {
  LineageContextType,
  LineageProviderProps,
  UpstreamDownstreamData,
} from './LineageProvider.interface';

export const LineageContext = createContext({} as LineageContextType);

const LineageProvider = ({ children }: LineageProviderProps) => {
  const { t } = useTranslation();
  const { fqn: decodedFqn } = useFqn();
  const location = useCustomLocation();
  const { isTourOpen, isTourPage } = useTourProvider();
  const { appPreferences } = useApplicationStore();
  const defaultLineageConfig = appPreferences?.lineageConfig as LineageSettings;
  const isLineageSettingsLoaded = !isUndefined(defaultLineageConfig);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SourceType>(
    {} as SourceType
  );
  const [activeLayer, setActiveLayer] = useState<LineageLayer[]>([]);
  const [activeNode, setActiveNode] = useState<Node>();
  const [expandAllColumns, setExpandAllColumns] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [showAddEdgeModal, setShowAddEdgeModal] = useState<boolean>(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge>();
  const [entityLineage, setEntityLineage] = useState<EntityLineageResponse>({
    nodes: [],
    edges: [],
    entity: {} as EntityReference,
  });
  const [dataQualityLineage, setDataQualityLineage] =
    useState<EntityLineageResponse>();
  const [updatedEntityLineage, setUpdatedEntityLineage] =
    useState<EntityLineageResponse | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [upstreamDownstreamData, setUpstreamDownstreamData] =
    useState<UpstreamDownstreamData>({
      downstreamEdges: [],
      upstreamEdges: [],
      downstreamNodes: [],
      upstreamNodes: [],
    });
  const [deletionState, setDeletionState] = useState<{
    loading: boolean;
    status: ElementLoadingState;
  }>(ELEMENT_DELETE_STATE);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [init, setInit] = useState(false);
  const [zoomValue, setZoomValue] = useState(ZOOM_VALUE);
  const [tracedNodes, setTracedNodes] = useState<string[]>([]);
  const [columnsHavingLineage, setColumnsHavingLineage] = useState<string[]>(
    []
  );
  const [tracedColumns, setTracedColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<LoadingState>('initial');
  const [newAddedNode, setNewAddedNode] = useState<Node>({} as Node);
  const [lineageConfig, setLineageConfig] = useState<LineageConfig>({
    upstreamDepth: 3,
    downstreamDepth: 3,
    nodesPerLayer: 50,
  });
  const [queryFilter, setQueryFilter] = useState<string>('');
  const [entityType, setEntityType] = useState('');
  const queryParams = new URLSearchParams(location.search);
  const isFullScreen = queryParams.get('fullscreen') === 'true';
  const deletePressed = useKeyPress('Delete');
  const backspacePressed = useKeyPress('Backspace');
  const [childMap, setChildMap] = useState<EntityReferenceChild>();
  const [paginationData, setPaginationData] = useState({});
  const { showModal } = useEntityExportModalProvider();

  const lineageLayer = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.layers as LineageLayer[] | undefined;
  }, [location.search]);

  const initLineageChildMaps = useCallback(
    (
      lineageData: EntityLineageResponse,
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

        setEntityLineage({
          ...entityLineage,
          nodes: newNodes,
          edges: [...(entityLineage.edges ?? []), ...edges],
        });
      }
    },
    [entityLineage]
  );

  const fetchDataQualityLineage = async (
    fqn: string,
    config?: LineageConfig
  ) => {
    if (isTourOpen || !tableClassBase.getAlertEnableStatus()) {
      return;
    }
    try {
      const dqLineageResp = await getDataQualityLineage(
        fqn,
        config,
        queryFilter
      );
      setDataQualityLineage(dqLineageResp);
    } catch (error) {
      setDataQualityLineage(undefined);
    }
  };

  const fetchLineageData = useCallback(
    async (fqn: string, entityType: string, config?: LineageConfig) => {
      if (isTourOpen) {
        return;
      }

      setLoading(true);
      setInit(false);

      try {
        const res = await getLineageDataByFQN(
          fqn,
          entityType,
          config,
          queryFilter
        );
        if (res) {
          const { nodes = [], entity } = res;
          const allNodes = uniqWith(
            [...nodes, entity].filter(Boolean),
            isEqual
          );

          if (
            entityType !== EntityType.PIPELINE &&
            entityType !== EntityType.STORED_PROCEDURE
          ) {
            const { map: childMapObj } = getChildMap(
              { ...res, nodes: allNodes },
              decodedFqn
            );
            setChildMap(childMapObj);
            const { nodes: newNodes, edges: newEdges } = getPaginatedChildMap(
              {
                ...res,
                nodes: allNodes,
              },
              childMapObj,
              {},
              config?.nodesPerLayer ?? 50
            );

            setEntityLineage({
              ...res,
              nodes: newNodes,
              edges: [...(res.edges ?? []), ...newEdges],
            });
          } else {
            setEntityLineage({
              ...res,
              nodes: allNodes,
            });
          }
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
        setInit(true);
        setLoading(false);
      }
    },
    [paginationData, queryFilter]
  );

  const exportLineageData = useCallback(
    async (_: string) => {
      return exportLineageAsync(
        decodedFqn,
        entityType,
        lineageConfig,
        queryFilter
      );
    },
    [entityType, decodedFqn, lineageConfig, queryFilter]
  );

  const onExportClick = useCallback(() => {
    if (decodedFqn) {
      showModal({
        name: decodedFqn,
        onExport: exportLineageData,
      });
    }
  }, [entityType, decodedFqn, lineageConfig, queryFilter]);

  const loadChildNodesHandler = useCallback(
    async (node: SourceType, direction: EdgeTypeEnum) => {
      try {
        const res = await getLineageDataByFQN(
          node.fullyQualifiedName ?? '',
          node.entityType ?? '',
          {
            upstreamDepth: direction === EdgeTypeEnum.UP_STREAM ? 1 : 0,
            downstreamDepth: direction === EdgeTypeEnum.DOWN_STREAM ? 1 : 0,
            nodesPerLayer: lineageConfig.nodesPerLayer,
          }, // load only one level of child nodes
          queryFilter
        );

        const activeNode = nodes.find((n) => n.id === node.id);
        if (activeNode) {
          setActiveNode(activeNode);
        }

        const allNodes = uniqWith(
          [...(entityLineage?.nodes ?? []), ...(res.nodes ?? []), res.entity],
          isEqual
        );
        const allEdges = uniqWith(
          [...(entityLineage?.edges ?? []), ...(res.edges ?? [])],
          isEqual
        );

        setEntityLineage((prev) => {
          return {
            ...prev,
            nodes: allNodes,
            edges: allEdges,
          };
        });
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.lineage-data-lowercase'),
          })
        );
      }
    },
    [nodes, edges, lineageConfig, entityLineage, setEntityLineage, queryFilter]
  );

  const handleLineageTracing = useCallback(
    (selectedNode: Node) => {
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
      const connectedNodeIds = [...outgoerIds, ...incomerIds, selectedNode.id];
      setTracedNodes(connectedNodeIds);
      setTracedColumns([]);
    },
    [nodes, edges]
  );

  const onUpdateLayerView = useCallback((layers: LineageLayer[]) => {
    setActiveLayer(layers);
  }, []);

  const updateEntityType = useCallback((entityType: EntityType) => {
    setEntityType(entityType);
  }, []);

  const onColumnClick = useCallback(
    (column: string) => {
      setSelectedColumn(column);
      const { columnEdge } = getClassifiedEdge(edges);
      const { connectedColumnEdges } = getAllTracedColumnEdge(
        column,
        columnEdge
      );

      setTracedColumns(connectedColumnEdges);
      setTracedNodes([]);
      setSelectedEdge(undefined);
      setIsDrawerOpen(false);
    },
    [nodes, edges]
  );

  const removeEdgeHandler = async (
    edge: Edge,
    confirmDelete: boolean
  ): Promise<void> => {
    if (!confirmDelete || !entityLineage) {
      return;
    }

    const { data } = edge;

    const edgeData: EdgeData = {
      fromEntity: data.edge.fromEntity.type,
      fromId: data.edge.fromEntity.id,
      toEntity: data.edge.toEntity.type,
      toId: data.edge.toEntity.id,
    };

    await removeLineageHandler(edgeData);

    const filteredEdges = (entityLineage.edges ?? []).filter(
      (item) =>
        !(
          item.fromEntity.id === edgeData.fromId &&
          item.toEntity.id === edgeData.toId
        )
    );

    setEdges((prev) => {
      return prev.filter(
        (item) =>
          !(item.source === edgeData.fromId && item.target === edgeData.toId)
      );
    });

    // On deleting of edge storing the result in a separate state.
    // This state variable is applied to main entityLineage state variable when the edit operation is
    // closed. This is done to perform the redrawing of the lineage graph on exit of edit mode.
    setUpdatedEntityLineage(() => {
      return {
        ...entityLineage,
        edges: filteredEdges,
      };
    });
  };

  const removeColumnEdge = async (edge: Edge, confirmDelete: boolean) => {
    if (!confirmDelete || !entityLineage) {
      return;
    }

    const { data } = edge;
    const selectedEdge = createNewEdge(edge);
    const updatedCols = selectedEdge.edge.lineageDetails?.columnsLineage ?? [];
    await addLineageHandler(selectedEdge);

    const updatedEdgeWithColumns = (entityLineage.edges ?? []).map((obj) => {
      if (
        obj.fromEntity.id === data.edge.fromEntity.id &&
        obj.toEntity.id === data.edge.toEntity.id
      ) {
        return {
          ...obj,
          columns: updatedCols,
        };
      }

      return obj;
    });

    setEntityLineage((prev) => {
      return {
        ...prev,
        edges: updatedEdgeWithColumns,
      };
    });

    setShowDeleteModal(false);
  };

  const removeNodeHandler = useCallback(
    async (node: Node | NodeProps) => {
      if (!entityLineage) {
        return;
      }
      // Filter column edges, as main edge will automatically remove column
      // edge on delete
      const nodeEdges = edges.filter(
        (item) => item?.data?.isColumnLineage === false
      );

      const edgesToRemove = getConnectedEdges([node as Node], nodeEdges);

      const filteredEdges: EdgeDetails[] = [];

      await Promise.all(
        edgesToRemove.map(async (edge) => {
          const { data } = edge;
          const edgeData: EdgeData = {
            fromEntity: data.edge.fromEntity.type,
            fromId: data.edge.fromEntity.id,
            toEntity: data.edge.toEntity.type,
            toId: data.edge.toEntity.id,
          };

          await removeLineageHandler(edgeData);

          filteredEdges.push(
            ...(entityLineage.edges ?? []).filter(
              (item) =>
                !(
                  item.fromEntity.id === edgeData.fromId &&
                  item.toEntity.id === edgeData.toId
                )
            )
          );

          setEdges((prev) => {
            return prev.filter(
              (item) =>
                !(
                  item.source === edgeData.fromId &&
                  item.target === edgeData.toId
                )
            );
          });
        })
      );

      const updatedNodes = (entityLineage.nodes ?? []).filter(
        (previousNode) => previousNode.id !== node.id
      );

      setNodes((prev) => {
        return prev.filter((previousNode) => previousNode.id !== node.id);
      });

      setUpdatedEntityLineage(() => {
        return {
          ...entityLineage,
          edges: filteredEdges,
          nodes: updatedNodes,
        };
      });

      setNewAddedNode({} as Node);
    },
    [nodes, entityLineage]
  );

  const onNodeDrop = (event: DragEvent, reactFlowBounds: DOMRect) => {
    event.preventDefault();
    const entityType = event.dataTransfer.getData('application/reactflow');
    if (entityType) {
      const position = reactFlowInstance?.project({
        x: event.clientX - (reactFlowBounds?.left ?? 0),
        y: event.clientY - (reactFlowBounds?.top ?? 0),
      });
      const nodeId = uniqueId();
      const newNode = {
        id: nodeId,
        nodeType: EntityLineageNodeType.DEFAULT,
        position,
        className: '',
        connectable: false,
        selectable: false,
        type: EntityLineageNodeType.DEFAULT,
        data: {
          label: (
            <div className="relative">
              <Button
                className="lineage-node-remove-btn bg-body-hover"
                data-testid="lineage-node-remove-btn"
                icon={
                  <Icon
                    alt="times-circle"
                    className="align-middle"
                    component={IconTimesCircle}
                    style={{ fontSize: '30px' }}
                  />
                }
                type="link"
                onClick={() => {
                  removeNodeHandler(newNode as Node);
                }}
              />

              <NodeSuggestions
                entityType={entityType}
                onSelectHandler={(value) => onEntitySelect(value, nodeId)}
              />
            </div>
          ),
          isEditMode,
          isNewNode: true,
        },
      };
      setNodes([...nodes, newNode as Node]);
      setNewAddedNode(newNode as Node);
    }
  };

  const onQueryFilterUpdate = useCallback((query: string) => {
    setQueryFilter(query);
  }, []);

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
        if (entityLineage) {
          initLineageChildMaps(entityLineage, childMap, retnObj);
        }

        return retnObj;
      }
    );
  };

  const onNodeClick = useCallback(
    (node: Node) => {
      if (!node) {
        return;
      }

      if (node.type === EntityLineageNodeType.LOAD_MORE) {
        selectLoadMoreNode(node);
      } else {
        setSelectedEdge(undefined);
        setActiveNode(node);
        setSelectedNode(node.data.node as SourceType);
        setIsDrawerOpen(true);
        handleLineageTracing(node);
      }
    },
    [handleLineageTracing]
  );

  const onPaneClick = useCallback(() => {
    setIsDrawerOpen(false);
    setTracedNodes([]);
    setTracedColumns([]);
    setActiveNode(undefined);
    setSelectedNode({} as SourceType);
  }, []);

  const onEdgeClick = useCallback((edge: Edge) => {
    setSelectedEdge(edge);
    setActiveNode(undefined);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(true);
    setTracedNodes([]);
    setTracedColumns([]);
  }, []);

  const onLineageEditClick = useCallback(() => {
    setIsEditMode((pre) => !pre);
    setActiveNode(undefined);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(false);
  }, []);

  const onInitReactFlow = (reactFlowInstance: ReactFlowInstance) => {
    setReactFlowInstance(reactFlowInstance);
  };

  const onLineageConfigUpdate = useCallback((config) => {
    setLineageConfig(config);
  }, []);

  const onDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const onZoomUpdate = useCallback((value) => {
    setZoomValue(value);
  }, []);

  const toggleColumnView = useCallback(() => {
    const updatedVal = !expandAllColumns;
    setExpandAllColumns(updatedVal);
  }, [expandAllColumns, edges]);

  const onRemove = useCallback(async () => {
    try {
      setDeletionState({ ...ELEMENT_DELETE_STATE, loading: true });

      if (selectedEdge?.data?.isColumnLineage) {
        await removeColumnEdge(selectedEdge, true);
      } else {
        await removeEdgeHandler(selectedEdge as Edge, true);
      }

      setShowDeleteModal(false);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setDeletionState((pre) => ({
        ...pre,
        status: 'initial',
        loading: false,
      }));
    }
  }, [selectedEdge, setShowDeleteModal]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const { target, source, sourceHandle, targetHandle } = params;

      if (target === source) {
        return;
      }

      const columnConnection =
        source !== sourceHandle && target !== targetHandle;

      // Decode the source and target handle. This contains column's fqn.
      // This is further used in the Lineage API for creating the column level lineage.
      if (columnConnection) {
        params.sourceHandle = decodeLineageHandles(params.sourceHandle);
        params.targetHandle = decodeLineageHandles(params.targetHandle);
      }

      setStatus('waiting');
      setLoading(true);

      const targetNode = nodes?.find((n) => target === n.id);
      const sourceNode = nodes?.find((n) => source === n.id);

      if (!isUndefined(sourceNode) && !isUndefined(targetNode)) {
        const currentEdge = (entityLineage.edges ?? []).find(
          (edge) => edge.fromEntity.id === source && edge.toEntity.id === target
        );

        const newEdgeWithFqn = getLineageEdge(
          sourceNode.data.node,
          targetNode.data.node
        );

        const newEdgeWithoutFqn = getLineageEdgeForAPI(
          sourceNode.data.node,
          targetNode.data.node
        );

        let updatedColumns: ColumnLineage[] = [];

        if (columnConnection && currentEdge) {
          updatedColumns = getUpdatedColumnsFromEdge(params, currentEdge);

          const lineageDetails: LineageDetails = {
            pipeline: currentEdge.pipeline
              ? getEntityReferenceFromEntity(
                  currentEdge.pipeline,
                  currentEdge.pipelineEntityType ?? EntityType.PIPELINE
                )
              : undefined,
            columnsLineage: [],
            description: currentEdge?.description ?? '',
            sqlQuery: currentEdge?.sqlQuery,
          };
          lineageDetails.columnsLineage = updatedColumns;
          newEdgeWithoutFqn.edge.lineageDetails = lineageDetails;
        }

        addLineageHandler(newEdgeWithoutFqn)
          .then(() => {
            if (!entityLineage) {
              return;
            }
            setStatus('success');
            setLoading(false);

            const allNodes = [
              ...(entityLineage.nodes ?? []),
              sourceNode?.data.node as EntityReference,
              targetNode?.data.node as EntityReference,
            ];

            const allEdges = isUndefined(currentEdge)
              ? [...(entityLineage.edges ?? []), newEdgeWithFqn.edge]
              : entityLineage.edges ?? [];

            if (currentEdge && columnConnection) {
              currentEdge.columns = updatedColumns; // update current edge with new columns
            }

            setNewAddedNode({} as Node);

            setEntityLineage((pre) => {
              const newData = {
                ...pre,
                nodes: uniqWith(
                  [...(pre.entity ? [pre.entity] : []), ...allNodes],
                  isEqual
                ),
                edges: uniqWith(allEdges, isEqual),
              };

              return newData;
            });
          })
          .catch((err) => {
            showErrorToast(err);
          })
          .finally(() => {
            setStatus('initial');
            setLoading(false);
          });
      }
    },
    [selectedNode, entityLineage, nodes, edges]
  );

  const onAddPipelineClick = useCallback(() => {
    setShowAddEdgeModal(true);
  }, []);

  const handleModalCancel = useCallback(() => {
    setShowAddEdgeModal(false);
    setSelectedEdge({} as Edge);
  }, []);

  const onEntitySelect = (selectedEntity: EntityReference, nodeId: string) => {
    const isExistingNode = nodes.some(
      (n) =>
        n.data.node.fullyQualifiedName === selectedEntity.fullyQualifiedName
    );
    if (isExistingNode) {
      setNodes((es) =>
        es
          .map((n) =>
            n.id.includes(nodeId)
              ? {
                  ...n,
                  selectable: true,
                  className: `${n.className} selected`,
                }
              : n
          )
          .filter((es) => es.id !== nodeId)
      );
      setNewAddedNode({} as Node);
    } else {
      setNodes((es) => {
        return es.map((el) => {
          if (el.id === nodeId) {
            return {
              ...el,
              connectable: true,
              selectable: true,
              id: selectedEntity.id,
              data: {
                saved: false,
                node: selectedEntity,
              },
            };
          } else {
            return el;
          }
        });
      });
    }
  };

  const onAddPipelineModalSave = useCallback(
    async (pipelineData?: EntityReference) => {
      if (!selectedEdge || !entityLineage) {
        return;
      }

      setStatus('waiting');
      setLoading(true);

      const { source, target } = selectedEdge;
      const existingEdge = (entityLineage.edges ?? []).find(
        (ed) => ed.fromEntity.id === source && ed.toEntity.id === target
      );

      let edgeIndex = -1;
      if (existingEdge) {
        edgeIndex = (entityLineage.edges ?? []).indexOf(existingEdge);

        if (pipelineData) {
          existingEdge.pipeline = pipelineData;
          existingEdge.pipelineEntityType = pipelineData.type as
            | EntityType.PIPELINE
            | EntityType.STORED_PROCEDURE;
        }
      }

      const { newEdge } = getNewLineageConnectionDetails(
        selectedEdge,
        pipelineData
      );

      try {
        await addLineageHandler(newEdge);

        setStatus('success');
        setLoading(false);

        setEntityLineage((pre) => {
          if (!selectedEdge.data || !pre) {
            return pre;
          }

          const newEdges = [...(pre.edges ?? [])];

          if (newEdges[edgeIndex]) {
            newEdges[edgeIndex] = existingEdge as EdgeDetails;
          }

          return {
            ...pre,
            edges: newEdges,
          };
        });
      } catch (error) {
        setLoading(false);
      } finally {
        setStatus('initial');
        handleModalCancel();
      }
    },
    [selectedEdge, entityLineage]
  );

  const onEdgeDetailsUpdate = useCallback(
    async (updatedEdgeDetails: AddLineage) => {
      const { description, sqlQuery } =
        updatedEdgeDetails.edge.lineageDetails ?? {};

      try {
        await updateLineageEdge(updatedEdgeDetails);
        const updatedEdges = (entityLineage.edges ?? []).map((edge) => {
          if (
            edge.fromEntity.id === updatedEdgeDetails.edge.fromEntity.id &&
            edge.toEntity.id === updatedEdgeDetails.edge.toEntity.id
          ) {
            return {
              ...edge,
              description,
              sqlQuery,
            };
          }

          return edge;
        });
        setEntityLineage((prev) => {
          return {
            ...prev,
            edges: updatedEdges,
          };
        });
        setSelectedEdge((pre) => {
          if (!pre) {
            return pre;
          }

          return {
            ...pre,
            data: {
              ...pre?.data,
              edge: {
                ...pre?.data?.edge,
                description,
                sqlQuery,
              },
            },
          };
        });
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [edges, entityLineage, selectedEdge]
  );

  const onColumnEdgeRemove = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const onNodeCollapse = useCallback(
    (node: Node | NodeProps, direction: EdgeTypeEnum) => {
      const { nodeFqn, edges: connectedEdges } = getConnectedNodesEdges(
        node as Node,
        nodes,
        edges,
        direction
      );

      setActiveNode(node as Node);

      const updatedNodes = (entityLineage.nodes ?? []).filter(
        (item) => !nodeFqn.includes(item.fullyQualifiedName ?? '')
      );
      const updatedEdges = (entityLineage.edges ?? []).filter((val) => {
        return !connectedEdges.some(
          (connectedEdge) => connectedEdge.data.edge === val
        );
      });

      setEntityLineage((pre) => {
        return {
          ...pre,
          nodes: updatedNodes,
          edges: updatedEdges,
        };
      });
    },
    [nodes, edges, entityLineage]
  );

  const selectNode = (node: Node) => {
    centerNodePosition(node, reactFlowInstance, zoomValue);
  };

  const repositionLayout = useCallback(
    async (activateNode = false) => {
      if (nodes.length === 0 || !reactFlowInstance) {
        return;
      }

      const isColView = activeLayer.includes(LineageLayer.ColumnLevelLineage);
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        await getELKLayoutedElements(
          nodes,
          edges,
          isColView,
          isEditMode || expandAllColumns,
          columnsHavingLineage
        );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      const rootNode = layoutedNodes.find((n) => n.data.isRootNode);
      if (!rootNode) {
        if (activateNode && reactFlowInstance) {
          onLoad(reactFlowInstance); // Call fitview in case of pipeline
        }

        return;
      }

      // Center the root node in the view
      centerNodePosition(rootNode, reactFlowInstance, zoomValue);
      if (activateNode) {
        onNodeClick(rootNode);
      }
    },
    [
      zoomValue,
      reactFlowInstance,
      activeLayer,
      nodes,
      edges,
      onNodeClick,
      columnsHavingLineage,
      expandAllColumns,
      isEditMode,
    ]
  );

  const redrawLineage = useCallback(
    async (lineageData: EntityLineageResponse) => {
      const allNodes = uniqWith(
        [
          ...(lineageData.nodes ?? []),
          ...(lineageData.entity ? [lineageData.entity] : []),
        ],
        isEqual
      );

      const updatedNodes = createNodes(
        allNodes,
        lineageData.edges ?? [],
        decodedFqn,
        activeLayer.includes(LineageLayer.ColumnLevelLineage)
      );
      const { edges: updatedEdges, columnsHavingLineage } = createEdges(
        allNodes,
        lineageData.edges ?? [],
        decodedFqn
      );

      if (reactFlowInstance && reactFlowInstance.viewportInitialized) {
        const positionedNodesEdges = await positionNodesUsingElk(
          updatedNodes,
          updatedEdges,
          activeLayer.includes(LineageLayer.ColumnLevelLineage),
          isEditMode || expandAllColumns,
          columnsHavingLineage
        );
        setNodes(positionedNodesEdges.nodes);
        setEdges(positionedNodesEdges.edges);
        const rootNode = positionedNodesEdges.nodes.find(
          (n) => n.data.isRootNode
        );
        if (rootNode) {
          centerNodePosition(rootNode, reactFlowInstance, zoomValue);
        }
      } else {
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }

      setColumnsHavingLineage(columnsHavingLineage);

      // Get upstream downstream nodes and edges data
      const data = getUpstreamDownstreamNodesEdges(
        lineageData.edges ?? [],
        lineageData.nodes ?? [],
        decodedFqn
      );
      setUpstreamDownstreamData(data);

      if (activeNode && !isEditMode) {
        selectNode(activeNode);
      }
    },
    [
      decodedFqn,
      activeNode,
      activeLayer,
      isEditMode,
      reactFlowInstance,
      zoomValue,
    ]
  );

  useEffect(() => {
    if (defaultLineageConfig) {
      setLineageConfig({
        upstreamDepth: defaultLineageConfig.upstreamDepth,
        downstreamDepth: defaultLineageConfig.downstreamDepth,
        nodesPerLayer: 50,
      });

      setActiveLayer(
        defaultLineageConfig.lineageLayer === LineageLayer.EntityLineage
          ? []
          : [defaultLineageConfig.lineageLayer]
      );
    }
  }, [defaultLineageConfig]);

  useEffect(() => {
    if (decodedFqn && entityType && isLineageSettingsLoaded) {
      fetchLineageData(decodedFqn, entityType, lineageConfig);
    }
  }, [
    lineageConfig,
    decodedFqn,
    queryFilter,
    entityType,
    isLineageSettingsLoaded,
  ]);

  useEffect(() => {
    if (!loading) {
      if (isEmpty(newAddedNode)) {
        redrawLineage(entityLineage);
      }
    }
  }, [entityLineage, loading]);

  useEffect(() => {
    if (!isEditMode && updatedEntityLineage !== null) {
      // On exit of edit mode, use updatedEntityLineage and update data.
      const { downstreamEdges, upstreamEdges } =
        getUpstreamDownstreamNodesEdges(
          updatedEntityLineage.edges ?? [],
          updatedEntityLineage.nodes ?? [],
          decodedFqn
        );

      const updatedNodes =
        updatedEntityLineage.nodes?.filter(
          (n) =>
            !isUndefined(
              downstreamEdges?.find((d) => d.toEntity.id === n.id)
            ) ||
            !isUndefined(upstreamEdges?.find((u) => u.fromEntity.id === n.id))
        ) ?? [];

      setEntityLineage({
        ...updatedEntityLineage,
        nodes: updatedNodes as EntityReference[],
      });
    }
  }, [isEditMode, updatedEntityLineage, decodedFqn]);

  useEffect(() => {
    if (isEditMode) {
      setUpdatedEntityLineage(null);
      if (deletePressed || backspacePressed) {
        if (activeNode) {
          removeNodeHandler(activeNode);
        } else if (selectedEdge) {
          removeEdgeHandler(selectedEdge, true);
        }
      }
    }
  }, [isEditMode, deletePressed, backspacePressed, activeNode, selectedEdge]);

  useEffect(() => {
    repositionLayout();
  }, [activeLayer, expandAllColumns, isEditMode]);

  useEffect(() => {
    if (reactFlowInstance?.viewportInitialized) {
      repositionLayout(true); // Activate the root node
    }
  }, [reactFlowInstance?.viewportInitialized]);

  const activityFeedContextValues = useMemo(() => {
    return {
      isDrawerOpen,
      loading,
      isEditMode,
      nodes,
      edges,
      reactFlowInstance,
      entityLineage,
      lineageConfig,
      selectedNode,
      selectedColumn,
      zoomValue,
      status,
      tracedNodes,
      tracedColumns,
      upstreamDownstreamData,
      init,
      activeLayer,
      columnsHavingLineage,
      expandAllColumns,
      toggleColumnView,
      onInitReactFlow,
      onPaneClick,
      onConnect,
      onNodeDrop,
      onNodeCollapse,
      onColumnClick,
      onNodesChange,
      onEdgesChange,
      onQueryFilterUpdate,
      onZoomUpdate,
      updateEntityType,
      onDrawerClose,
      loadChildNodesHandler,
      fetchLineageData,
      removeNodeHandler,
      onNodeClick,
      onEdgeClick,
      onColumnEdgeRemove,
      onLineageConfigUpdate,
      onLineageEditClick,
      onAddPipelineClick,
      onUpdateLayerView,
      onExportClick,
      dataQualityLineage,
    };
  }, [
    dataQualityLineage,
    isDrawerOpen,
    loading,
    isEditMode,
    nodes,
    edges,
    entityLineage,
    reactFlowInstance,
    lineageConfig,
    selectedNode,
    selectedColumn,
    zoomValue,
    status,
    tracedNodes,
    tracedColumns,
    upstreamDownstreamData,
    init,
    activeLayer,
    columnsHavingLineage,
    expandAllColumns,
    toggleColumnView,
    onInitReactFlow,
    onPaneClick,
    onConnect,
    onNodeDrop,
    onNodeCollapse,
    onColumnClick,
    onQueryFilterUpdate,
    onNodesChange,
    onEdgesChange,
    onZoomUpdate,
    onDrawerClose,
    updateEntityType,
    loadChildNodesHandler,
    fetchLineageData,
    removeNodeHandler,
    onNodeClick,
    onEdgeClick,
    onColumnEdgeRemove,
    onLineageConfigUpdate,
    onLineageEditClick,
    onAddPipelineClick,
    onUpdateLayerView,
    onExportClick,
  ]);

  useEffect(() => {
    if (isTourOpen || isTourPage) {
      setPaginationData({});
      setInit(true);
      setLoading(false);
      setEntityLineage(
        mockDatasetData.entityLineage as unknown as EntityLineageResponse
      );
    }
  }, [isTourOpen, isTourPage]);

  useEffect(() => {
    if (lineageLayer) {
      setActiveLayer((pre) => uniq([...lineageLayer, ...pre]));
    }
  }, [lineageLayer]);

  useEffect(() => {
    if (activeLayer.includes(LineageLayer.DataObservability)) {
      fetchDataQualityLineage(decodedFqn, lineageConfig);
    }
  }, [activeLayer, decodedFqn, lineageConfig]);

  return (
    <LineageContext.Provider value={activityFeedContextValues}>
      <div
        className={classNames({
          'full-screen-lineage': isFullScreen,
        })}>
        {children}
        <EntityLineageSidebar newAddedNode={newAddedNode} show={isEditMode} />

        {isDrawerOpen &&
          !isEditMode &&
          (selectedEdge ? (
            <EdgeInfoDrawer
              hasEditAccess
              edge={selectedEdge} // handle this access
              nodes={nodes}
              visible={isDrawerOpen}
              onClose={() => {
                setIsDrawerOpen(false);
                setSelectedEdge(undefined);
              }}
              onEdgeDetailsUpdate={onEdgeDetailsUpdate}
            />
          ) : (
            <EntityInfoDrawer
              selectedNode={selectedNode}
              show={isDrawerOpen}
              onCancel={() => setIsDrawerOpen(false)}
            />
          ))}

        {showDeleteModal && (
          <Modal
            data-testid="delete-edge-confirmation-modal"
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
            {getModalBodyText(selectedEdge as Edge)}
          </Modal>
        )}
        {showAddEdgeModal && (
          <AddPipeLineModal
            loading={loading}
            selectedEdge={selectedEdge}
            showAddEdgeModal={showAddEdgeModal}
            onModalCancel={handleModalCancel}
            onRemoveEdgeClick={() => {
              setShowDeleteModal(true);
              setShowAddEdgeModal(false);
            }}
            onSave={onAddPipelineModalSave}
          />
        )}
      </div>
    </LineageContext.Provider>
  );
};

export const useLineageProvider = () => useContext(LineageContext);

export default LineageProvider;

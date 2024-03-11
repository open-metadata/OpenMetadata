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
import { isEqual, isUndefined, uniqueId, uniqWith } from 'lodash';
import { LoadingState } from 'Models';
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
  useNodesState,
} from 'reactflow';
import { ReactComponent as IconTimesCircle } from '../../assets/svg/ic-times-circle.svg';
import EdgeInfoDrawer from '../../components/Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../../components/Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import AddPipeLineModal from '../../components/Entity/EntityLineage/AppPipelineModel/AddPipeLineModal';
import {
  EdgeData,
  EdgeTypeEnum,
  ElementLoadingState,
  LineageConfig,
} from '../../components/Entity/EntityLineage/EntityLineage.interface';
import EntityLineageSidebar from '../../components/Entity/EntityLineage/EntityLineageSidebar.component';
import NodeSuggestions from '../../components/Entity/EntityLineage/NodeSuggestions.component';
import {
  EdgeDetails,
  EntityLineageReponse,
} from '../../components/Lineage/Lineage.interface';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import {
  ELEMENT_DELETE_STATE,
  ZOOM_TRANSITION_DURATION,
  ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
  EntityType,
} from '../../enums/entity.enum';
import { AddLineage } from '../../generated/api/lineage/addLineage';
import { PipelineStatus } from '../../generated/entity/data/pipeline';
import {
  EntityReference,
  LineageDetails,
} from '../../generated/type/entityLineage';
import { useFqn } from '../../hooks/useFqn';
import { getLineageDataByFQN, updateLineageEdge } from '../../rest/lineageAPI';
import { getPipelineStatus } from '../../rest/pipelineAPI';
import { getEpochMillisForPastDays } from '../../utils/date-time/DateTimeUtils';
import {
  addLineageHandler,
  createEdges,
  createNewEdge,
  createNodes,
  getAllTracedColumnEdge,
  getAllTracedNodes,
  getClassifiedEdge,
  getConnectedNodesEdges,
  getLayoutedElements,
  getLineageEdge,
  getLineageEdgeForAPI,
  getLoadingStatusValue,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getUpdatedColumnsFromEdge,
  getUpstreamDownstreamNodesEdges,
  onLoad,
  removeLineageHandler,
} from '../../utils/EntityLineageUtils';
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
  const { isTourOpen, isTourPage } = useTourProvider();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SourceType>(
    {} as SourceType
  );
  const [activeNode, setActiveNode] = useState<Node>();
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [showAddEdgeModal, setShowAddEdgeModal] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [expandAllColumns, setExpandAllColumns] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge>();
  const [entityLineage, setEntityLineage] = useState<EntityLineageReponse>({
    nodes: [],
    edges: [],
    entity: {} as EntityReference,
  });
  const [updatedEntityLineage, setUpdatedEntityLineage] =
    useState<EntityLineageReponse | null>(null);
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
  const [tracedColumns, setTracedColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<LoadingState>('initial');
  const [newAddedNode, setNewAddedNode] = useState<Node>({} as Node);
  const [lineageConfig, setLineageConfig] = useState<LineageConfig>({
    upstreamDepth: 3,
    downstreamDepth: 3,
    nodesPerLayer: 50,
  });
  const [queryFilter, setQueryFilter] = useState<string>('');
  const [pipelineStatus, setPipelineStatus] = useState<
    Record<string, PipelineStatus>
  >({});
  const [entityType, setEntityType] = useState('');
  const queryParams = new URLSearchParams(location.search);
  const isFullScreen = queryParams.get('fullscreen') === 'true';

  const fetchLineageData = async (
    fqn: string,
    entityType: string,
    config?: LineageConfig
  ) => {
    if (isTourOpen) {
      return;
    } else {
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
          const allNodes = uniqWith(
            [...(res.nodes ?? []), ...(res.entity ? [res.entity] : [])],
            isEqual
          );
          setEntityLineage({
            ...res,
            nodes: allNodes,
          });
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
    }
  };

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

  const fetchPipelineStatus = useCallback(async (pipelineFQN: string) => {
    try {
      const currentTime = Date.now();
      // past 1 day
      const startDay = getEpochMillisForPastDays(1);
      const response = await getPipelineStatus(pipelineFQN, {
        startTs: startDay,
        endTs: currentTime,
      });
      setPipelineStatus((prev) => {
        return {
          ...prev,
          [pipelineFQN]: response.data[0],
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.fetch-pipeline-status-error')
      );
    }
  }, []);

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

  const onNodeClick = useCallback(
    (node: Node) => {
      if (node) {
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
  }, []);

  const onLineageEditClick = useCallback(() => {
    setIsEditMode((pre) => !pre);
    setActiveNode(undefined);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(false);
  }, []);

  const onInitReactFlow = (reactFlowInstance: ReactFlowInstance) => {
    setTimeout(() => {
      onLoad(reactFlowInstance);
    }, 0);

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
    setNodes((prevNodes) => {
      const updatedNode = prevNodes.map((node) => {
        const nodeId = node.data.node.id;

        // Update the expandedNodes state based on the toggle value
        if (updatedVal && !expandedNodes.includes(nodeId)) {
          setExpandedNodes((prevExpandedNodes) => [
            ...prevExpandedNodes,
            nodeId,
          ]);
        } else if (!updatedVal) {
          setExpandedNodes((prevExpandedNodes) =>
            prevExpandedNodes.filter((id) => id !== nodeId)
          );
        }

        return node;
      });

      const { edge, node } = getLayoutedElements(
        {
          node: updatedNode,
          edge: edges,
        },
        EntityLineageDirection.LEFT_RIGHT,
        updatedVal
      );

      setEdges(edge);

      return node;
    });
  }, [expandAllColumns, expandedNodes, edges]);

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

        if (columnConnection && currentEdge) {
          const updatedColumns = getUpdatedColumnsFromEdge(params, currentEdge);

          const lineageDetails: LineageDetails = {
            pipeline: currentEdge.pipeline,
            columnsLineage: [],
            description: currentEdge?.description ?? '',
            sqlQuery: currentEdge?.sqlQuery,
          };
          lineageDetails.columnsLineage = updatedColumns;
          newEdgeWithoutFqn.edge.lineageDetails = lineageDetails;
          currentEdge.columns = updatedColumns; // update current edge with new columns
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

            setEntityLineage((pre) => {
              const newData = {
                ...pre,
                nodes: uniqWith([pre.entity, ...allNodes], isEqual),
                edges: uniqWith(allEdges, isEqual),
              };

              return newData;
            });

            setNewAddedNode({} as Node);
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
    const { position } = node;
    // moving selected node in center
    reactFlowInstance?.setCenter(position.x, position.y, {
      duration: ZOOM_TRANSITION_DURATION,
      zoom: zoomValue,
    });
  };

  const redrawLineage = useCallback(
    (lineageData: EntityLineageReponse) => {
      const allNodes = uniqWith(
        [...(lineageData.nodes ?? []), lineageData.entity],
        isEqual
      );
      const updatedNodes = createNodes(
        allNodes,
        lineageData.edges ?? [],
        decodedFqn
      );
      const updatedEdges = createEdges(
        allNodes,
        lineageData.edges ?? [],
        decodedFqn
      );
      setNodes(updatedNodes);
      setEdges(updatedEdges);

      // Get upstream downstream nodes and edges data
      const data = getUpstreamDownstreamNodesEdges(
        lineageData.edges ?? [],
        lineageData.nodes ?? [],
        decodedFqn
      );
      setUpstreamDownstreamData(data);

      if (activeNode) {
        selectNode(activeNode);
      }
    },
    [decodedFqn, activeNode]
  );

  useEffect(() => {
    if (decodedFqn && entityType) {
      fetchLineageData(decodedFqn, entityType, lineageConfig);
    }
  }, [lineageConfig, decodedFqn, queryFilter, entityType]);

  useEffect(() => {
    if (!loading) {
      redrawLineage(entityLineage);
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
    }
  }, [isEditMode]);

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
      expandedNodes,
      tracedNodes,
      tracedColumns,
      expandAllColumns,
      pipelineStatus,
      upstreamDownstreamData,
      init,
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
      toggleColumnView,
      loadChildNodesHandler,
      fetchLineageData,
      fetchPipelineStatus,
      removeNodeHandler,
      onNodeClick,
      onEdgeClick,
      onColumnEdgeRemove,
      onLineageConfigUpdate,
      onLineageEditClick,
      onAddPipelineClick,
    };
  }, [
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
    expandedNodes,
    tracedNodes,
    tracedColumns,
    expandAllColumns,
    pipelineStatus,
    upstreamDownstreamData,
    init,
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
    fetchPipelineStatus,
    toggleColumnView,
    removeNodeHandler,
    onNodeClick,
    onEdgeClick,
    onColumnEdgeRemove,
    onLineageConfigUpdate,
    onLineageEditClick,
    onAddPipelineClick,
  ]);

  useEffect(() => {
    if (isTourOpen || isTourPage) {
      setInit(true);
      setLoading(false);
      setEntityLineage(
        mockDatasetData.entityLineage as unknown as EntityLineageReponse
      );
    }
  }, [isTourOpen, isTourPage]);

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

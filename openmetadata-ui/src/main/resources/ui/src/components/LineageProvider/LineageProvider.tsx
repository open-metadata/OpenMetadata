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
import { Button, Modal } from 'antd';
import { AxiosError } from 'axios';
import { isEqual, isUndefined, uniqueId, uniqWith } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  createContext,
  DragEvent,
  ReactNode,
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
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import {
  ELEMENT_DELETE_STATE,
  ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
} from '../../enums/entity.enum';
import { AddLineage } from '../../generated/api/lineage/addLineage';
import {
  ColumnLineage,
  EntityReference,
} from '../../generated/type/entityLineage';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import {
  addLineageHandler,
  getAllTracedColumnEdge,
  getAllTracedNodes,
  getClassifiedEdge,
  getLayoutedElements,
  getLoadingStatusValue,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getUniqueFlowElements,
  onLoad,
  removeLineageHandler,
} from '../../utils/EntityLineageUtils';
import {
  createEdges,
  createNodes,
  getColumnLineageData,
  getConnectedNodesEdges,
  getLineageDetailsObject,
  getLineageEdge,
  getLineageEdgeForAPI,
} from '../../utils/LineageV1Utils';
import SVGIcons from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import EdgeInfoDrawer from '../Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import AddPipeLineModal from '../Entity/EntityLineage/AppPipelineModel/AddPipeLineModal';
import {
  EdgeData,
  EdgeTypeEnum,
  ElementLoadingState,
  LineageConfig,
} from '../Entity/EntityLineage/EntityLineage.interface';
import EntityLineageSidebar from '../Entity/EntityLineage/EntityLineageSidebar.component';
import NodeSuggestions from '../Entity/EntityLineage/NodeSuggestions.component';
import {
  EdgeDetails,
  EntityLineageReponse,
} from '../Lineage/Lineage.interface';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { useTourProvider } from '../TourProvider/TourProvider';

interface LineageProviderProps {
  children: ReactNode;
}

export const LineageContext = createContext({} as any);

const LineageProvider = ({ children }: LineageProviderProps) => {
  const { t } = useTranslation();
  const { isTourOpen } = useTourProvider();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SourceType>(
    {} as SourceType
  );
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
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deletionState, setDeletionState] = useState<{
    loading: boolean;
    status: ElementLoadingState;
  }>(ELEMENT_DELETE_STATE);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [zoomValue, setZoomValue] = useState(ZOOM_VALUE);
  const [tracedNodes, setTracedNodes] = useState<string[]>([]);
  const [tracedColumns, setTracedColumns] = useState<string[]>([]);
  const [entityFqn, setEntityFqn] = useState('');
  const [status, setStatus] = useState<LoadingState>('initial');
  const [newAddedNode, setNewAddedNode] = useState<Node>({} as Node);
  const [lineageConfig, setLineageConfig] = useState<LineageConfig>({
    upstreamDepth: 1,
    downstreamDepth: 1,
    nodesPerLayer: 50,
  });
  const [queryFilter, setQueryFilter] = useState<string>('');

  const fetchLineageData = async (fqn: string, config?: LineageConfig) => {
    if (isTourOpen) {
      setEntityLineage(mockDatasetData.entityLineage);
    } else {
      setLoading(true);
      try {
        const res = await getLineageDataByFQN(fqn, config, queryFilter);
        if (res) {
          setEntityLineage(res);
          const allNodes = [res.entity, ...(res.nodes ?? [])];
          const updatedNodes = createNodes(allNodes, res.edges ?? []);
          const updatedEdges = createEdges(allNodes, res.edges ?? []);

          setNodes(updatedNodes);
          setEdges(updatedEdges);
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
        setLoading(false);
      }
    }
  };

  const loadChildNodesHandler = useCallback(
    async (node: EntityReference, direction: EdgeTypeEnum) => {
      try {
        const res = await getLineageDataByFQN(
          node.fullyQualifiedName ?? '',
          {
            upstreamDepth: direction === EdgeTypeEnum.UP_STREAM ? 1 : 0,
            downstreamDepth: direction === EdgeTypeEnum.DOWN_STREAM ? 1 : 0,
            nodesPerLayer: lineageConfig.nodesPerLayer,
          }, // load only one level of child nodes
          queryFilter
        );

        const allNodes = uniqWith(
          [...(entityLineage?.nodes ?? []), ...(res.nodes ?? [])],
          isEqual
        );
        const allEdges = uniqWith(
          [...(entityLineage?.edges ?? []), ...(res.edges ?? [])],
          isEqual
        );

        const newNodes = createNodes(allNodes, allEdges);
        const newEdges = createEdges(allNodes, allEdges);

        setEntityLineage((prev) => {
          return {
            ...prev,
            nodes: allNodes,
            edges: allEdges,
          };
        });

        setNodes(newNodes);
        setEdges(newEdges);
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
    if (confirmDelete && entityLineage) {
      const { data } = edge;
      const edgeData: EdgeData = {
        fromEntity: data.edge.fromEntity.type,
        fromId: data.edge.fromEntity.id,
        toEntity: data.edge.toEntity.type,
        toId: data.edge.toEntity.id,
      };

      await removeLineageHandler(edgeData);

      const updatedEdges = entityLineage.edges?.filter(
        (item) =>
          !(
            item.fromEntity.id === edgeData.fromId &&
            item.toEntity.id === edgeData.toId
          )
      );

      setEntityLineage((prev) => {
        return {
          ...prev,
          edges: updatedEdges,
        };
      });

      const newNodes = createNodes(
        entityLineage.nodes ?? [],
        updatedEdges ?? []
      );
      const newEdges = createEdges(
        entityLineage.nodes ?? [],
        updatedEdges ?? []
      );

      setNodes(newNodes);
      setEdges(newEdges);
    }
  };

  const removeColumnEdge = async (edge: Edge, confirmDelete: boolean) => {
    if (confirmDelete && entityLineage) {
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
      selectedEdge.edge.lineageDetails = getLineageDetailsObject(edge);
      selectedEdge.edge.lineageDetails.columnsLineage = updatedCols;

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

      const updatedEdges = createEdges(
        entityLineage.nodes ?? [],
        updatedEdgeWithColumns
      );

      setEdges(updatedEdges);

      setShowDeleteModal(false);
    }
  };

  const removeNodeHandler = useCallback(
    (node: Node) => {
      if (!entityLineage) {
        return;
      }
      // Get edges connected to selected node
      const edgesToRemove = getConnectedEdges([node], edges);
      edgesToRemove.forEach((edge) => {
        removeEdgeHandler(edge, true);
      });

      setNodes(
        (previousNodes) =>
          getUniqueFlowElements(
            previousNodes.filter((previousNode) => previousNode.id !== node.id)
          ) as Node[]
      );
      setNewAddedNode({} as Node);
    },
    [nodes, entityLineage]
  );

  const onNodeDrop = (event: DragEvent, reactFlowBounds: DOMRect) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (type.trim()) {
      const position = reactFlowInstance?.project({
        x: event.clientX - (reactFlowBounds?.left ?? 0),
        y: event.clientY - (reactFlowBounds?.top ?? 0),
      });
      const [label, nodeType] = type.split('-');
      const nodeId = uniqueId();
      const newNode = {
        id: nodeId,
        nodeType,
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
                icon={
                  <SVGIcons
                    alt="times-circle"
                    icon="icon-times-circle"
                    width="16px"
                  />
                }
                type="link"
                onClick={() => {
                  removeNodeHandler(newNode as Node);
                }}
              />

              <NodeSuggestions
                entityType={label}
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
    setSelectedNode({} as SourceType);
  }, []);

  const onEdgeClick = useCallback((edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(true);
  }, []);

  const onLineageEditClick = useCallback(() => {
    setIsEditMode((pre) => !pre);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(false);
  }, []);

  const onInitReactFlow = (reactFlowInstance: ReactFlowInstance) => {
    setTimeout(() => {
      onLoad(reactFlowInstance);
    }, 500);

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

  const onEntityFqnUpdate = useCallback((value) => {
    setEntityFqn(value);
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

        if (columnConnection) {
          if (!isUndefined(currentEdge)) {
            const updatedColumns: ColumnLineage[] =
              currentEdge.columns?.map((lineage) => {
                if (lineage.toColumn === targetHandle) {
                  return {
                    ...lineage,
                    fromColumns: [
                      ...(lineage.fromColumns ?? []),
                      sourceHandle ?? '',
                    ],
                  };
                }

                return lineage;
              }) ?? [];

            if (
              !updatedColumns.find(
                (lineage) => lineage.toColumn === targetHandle
              )
            ) {
              updatedColumns.push({
                fromColumns: [sourceHandle ?? ''],
                toColumn: targetHandle ?? '',
              });
            }

            if (newEdgeWithoutFqn.edge.lineageDetails) {
              newEdgeWithoutFqn.edge.lineageDetails.columnsLineage =
                updatedColumns;
            }
            currentEdge.columns = updatedColumns; // update current edge with new columns
          }
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

            const updatedNodes = createNodes(
              allNodes as EntityReference[],
              allEdges
            );
            const updatedEdges = createEdges(
              allNodes as EntityReference[],
              allEdges
            );

            setEntityLineage((pre) => {
              const newData = {
                ...pre,
                nodes: uniqWith([pre.entity, ...allNodes], isEqual),
                edges: uniqWith(allEdges, isEqual),
              };

              return newData;
            });

            setNodes(updatedNodes);
            setEdges(updatedEdges);
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

      const { source, target } = selectedEdge.data;
      const existingEdge = (entityLineage.edges ?? []).find(
        (ed) => ed.fromEntity === source && ed.toEntity === target
      );

      let edgeIndex = -1;
      if (existingEdge) {
        edgeIndex = (entityLineage.edges ?? []).indexOf(existingEdge);

        if (pipelineData) {
          existingEdge.pipeline = pipelineData;
        }
      }

      const { newEdge, updatedLineageDetails } = getNewLineageConnectionDetails(
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

          const newData = {
            ...pre,
            edges: newEdges,
          };

          return newData;
        });

        setEdges((pre) =>
          pre.map((edge) => {
            if (edge.id === selectedEdge.id) {
              return {
                ...edge,
                animated: true,
                data: {
                  edge: {
                    ...edge.data.edge,
                    pipeline: updatedLineageDetails.pipeline,
                  },
                },
              };
            }

            return edge;
          })
        );
      } catch (error) {
        setLoading(false);
      } finally {
        setStatus('initial');
        handleModalCancel();
      }
    },
    [selectedEdge, entityLineage]
  );

  const onColumnEdgeRemove = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const onNodeCollapse = useCallback(
    (node: Node, direction: EdgeTypeEnum) => {
      const { nodeFqn, edges: connectedEdges } = getConnectedNodesEdges(
        node,
        nodes,
        edges,
        direction
      );

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

      const allNodes = createNodes(updatedNodes, updatedEdges);
      const allEdges = createEdges(updatedNodes, updatedEdges);
      setNodes(allNodes);
      setEdges(allEdges);
    },
    [nodes, edges, entityLineage]
  );

  useEffect(() => {
    if (entityFqn) {
      fetchLineageData(entityFqn, lineageConfig);
    }
  }, [lineageConfig, entityFqn, queryFilter]);

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
      onDrawerClose,
      toggleColumnView,
      loadChildNodesHandler,
      fetchLineageData,
      onEntityFqnUpdate,
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
    loadChildNodesHandler,
    fetchLineageData,
    onEntityFqnUpdate,
    toggleColumnView,
    removeNodeHandler,
    onNodeClick,
    onEdgeClick,
    onColumnEdgeRemove,
    onLineageConfigUpdate,
    onLineageEditClick,
    onAddPipelineClick,
  ]);

  return (
    <LineageContext.Provider value={activityFeedContextValues}>
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
          />
        ) : (
          <EntityInfoDrawer
            isMainNode={false}
            selectedNode={selectedNode}
            show={isDrawerOpen}
            onCancel={() => setIsDrawerOpen(false)}
          />
        ))}

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
    </LineageContext.Provider>
  );
};

export const useLineageProvider = () => useContext(LineageContext);

export default LineageProvider;

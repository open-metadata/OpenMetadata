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
import { Button } from 'antd';
import { AxiosError } from 'axios';
import { isEqual, isNil, isUndefined, uniqueId, uniqWith } from 'lodash';
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
import { ZOOM_VALUE } from '../../constants/Lineage.constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
} from '../../enums/entity.enum';
import { EntityReference } from '../../generated/type/entityLineage';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import {
  addLineageHandler,
  getAllTracedColumnEdge,
  getAllTracedNodes,
  getClassifiedEdge,
  getLayoutedElements,
  getUniqueFlowElements,
  onLoad,
  removeLineageHandler,
} from '../../utils/EntityLineageUtils';
import { createEdges, createNodes } from '../../utils/LineageV1Utils';
import SVGIcons from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import EdgeInfoDrawer from '../Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import {
  EdgeData,
  LineageConfig,
  SelectedEdge,
} from '../Entity/EntityLineage/EntityLineage.interface';
import EntityLineageSidebar from '../Entity/EntityLineage/EntityLineageSidebar.component';
import NodeSuggestions from '../Entity/EntityLineage/NodeSuggestions.component';
import { EntityLineageReponse } from '../Lineage/Lineage.interface';
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
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [expandAllColumns, setExpandAllColumns] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge>();
  const [entityLineage, setEntityLineage] = useState<EntityLineageReponse>({
    nodes: [],
    edges: [],
    entity: {} as EntityReference,
  });
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
    async (node: EntityReference) => {
      try {
        const res = await getLineageDataByFQN(
          node.fullyQualifiedName ?? '',
          lineageConfig,
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
    [nodes, edges, selectedNode]
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

  const removeEdgeHandler = (
    { source, target }: SelectedEdge,
    confirmDelete: boolean
  ) => {
    if (confirmDelete && entityLineage) {
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
    }
  };

  const removeNodeHandler = useCallback(
    (node: Node) => {
      if (!entityLineage) {
        return;
      }
      // Get edges connected to selected node
      const edgesToRemove = getConnectedEdges([node], edges);

      // edgesToRemove.forEach((edge) => {
      //   removeEdgeHandler(
      //     getRemovedNodeData(
      //       entityLineage.nodes || [],
      //       edge,
      //       entityLineage.entity,
      //       selectedEntity
      //     ),
      //     true
      //   );
      // });

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

  const onNodeClick = (node: Node) => {
    if (node) {
      setSelectedEdge(undefined);
      setSelectedNode(node.data.node as SourceType);
      setIsDrawerOpen(true);
      handleLineageTracing(node);
    }
  };

  const onPaneClick = useCallback(() => {
    setIsDrawerOpen(false);
    setTracedNodes([]);
    setTracedColumns([]);
    setSelectedNode({} as SourceType);
  }, []);

  const onEdgeClick = (edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(true);
  };

  const onLineageEditClick = () => {
    setIsEditMode((pre) => !pre);
    setSelectedNode({} as SourceType);
    setIsDrawerOpen(false);
  };

  const onInitReactFlow = (reactFlowInstance: ReactFlowInstance) => {
    onLoad(reactFlowInstance);
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

  const toggleColumnView = () => {
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
  };

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      if (!entityLineage) {
        return;
      }
      const { target, source, sourceHandle, targetHandle } = params;

      if (target === source) {
        return;
      }

      const columnConnection = !isNil(sourceHandle) && !isNil(targetHandle);

      setStatus('waiting');
      setLoading(true);

      // const nodes = [
      //   ...(entityLineage.nodes as EntityReference[]),
      //   entityLineage.entity,
      // ];

      const targetNode = nodes?.find((n) => target === n.id);
      const sourceNode = nodes?.find((n) => source === n.id);

      // if (isUndefined(targetNode) && sourceNode?.id !== selectedNode?.id) {
      //   targetNode = getSourceOrTargetNode(target || '');
      // }
      // if (isUndefined(sourceNode) && targetNode?.id !== selectedNode?.id) {
      //   sourceNode = getSourceOrTargetNode(source || '');
      // }

      if (!isUndefined(sourceNode) && !isUndefined(targetNode)) {
        const {
          id: sourceId,
          entityType: sourceType,
          fullyQualifiedName: sourceFqn,
        } = sourceNode.data.node;
        const {
          id: targetId,
          entityType: targetType,
          fullyQualifiedName: targetFqn,
        } = targetNode.data.node;

        const newEdgeWithFqn = {
          edge: {
            fromEntity: { id: sourceId, type: sourceType, fqn: sourceFqn },
            toEntity: { id: targetId, type: targetType, fqn: targetFqn },
          },
        };

        // Create another variable without the fqn field
        const newEdgeWithoutFqn = {
          edge: {
            fromEntity: { id: sourceId, type: sourceType },
            toEntity: { id: targetId, type: targetType },
          },
        };

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

            const allEdges = [
              ...(entityLineage.edges ?? []),
              newEdgeWithFqn.edge,
            ];

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

            setTimeout(() => {
              setStatus('initial');
            }, 100);
            setNewAddedNode({} as Node);
          })
          .catch(() => {
            setStatus('initial');
            setLoading(false);
          });
      }
    },
    [selectedNode, entityLineage, nodes]
  );

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
              id: nodeId,
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

  useEffect(() => {
    if (entityFqn) {
      fetchLineageData(entityFqn, lineageConfig);
    }
  }, [lineageConfig, entityFqn, queryFilter]);

  useEffect(() => {
    // filter out the unsaved nodes
  }, []);

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
      onLineageConfigUpdate,
      onLineageEditClick,
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
    onLineageConfigUpdate,
    onLineageEditClick,
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
    </LineageContext.Provider>
  );
};

export const useLineageProvider = () => useContext(LineageContext);

export default LineageProvider;

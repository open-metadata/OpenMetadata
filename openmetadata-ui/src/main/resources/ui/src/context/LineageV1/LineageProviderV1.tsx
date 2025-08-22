/*
 *  Copyright 2024 Collate.
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

import { AxiosError } from 'axios';
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Connection,
  Edge,
  Node,
  NodeProps,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import { CSVExportResponse } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { LineageConfig } from '../../components/Entity/EntityLineage/EntityLineage.interface';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import {
  EntityLineageDirection,
  EntityLineageNodeType,
  EntityType,
} from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { EntityReference } from '../../generated/entity/type';
import { LineageLayer } from '../../generated/settings/settings';
import { useFqn } from '../../hooks/useFqn';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import {
  createEdgesAndEdgeMaps,
  createNodes,
  getLayoutedElements,
  parseLineageData,
} from '../../utils/EntityLineageUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { LineageActionsProvider } from './contexts/LineageActionsContext';
import { LineageDataProvider } from './contexts/LineageDataContext';
import { LineageUIProvider } from './contexts/LineageUIContext';
import { LineageViewProvider } from './contexts/LineageViewContext';
import {
  LineageActionType,
  LineagePlatformView,
  LineageProviderV1Props,
} from './LineageProviderV1.interface';
import { initialLineageState, lineageReducer } from './reducers/lineageReducer';

const LineageProviderV1 = ({ children }: LineageProviderV1Props) => {
  const { t } = useTranslation();
  const { fqn: decodedFqn } = useFqn();

  // Consolidated state management with reducer
  const [state, dispatch] = useReducer(lineageReducer, initialLineageState);

  // Separate node and edge state for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // React Flow instance
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();

  // Refs for stable callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // Initialize entity FQN - only when decodedFqn changes
  useEffect(() => {
    if (decodedFqn) {
      dispatch({
        type: LineageActionType.SET_ENTITY_LINEAGE,
        payload: {
          nodes: [],
          edges: [],
          entity: { fullyQualifiedName: decodedFqn } as EntityReference,
        },
      });
    }
  }, [decodedFqn]);

  // Fetch lineage data - use ref for stable reference
  const fetchLineageData = useCallback(
    async (fqn: string, entityType: string, config?: LineageConfig) => {
      dispatch({ type: LineageActionType.SET_LOADING, payload: true });
      dispatch({ type: LineageActionType.SET_INIT, payload: false });

      // Clear existing nodes and edges
      setNodes([]);
      setEdges([]);

      try {
        // Use current state from ref
        const currentState = stateRef.current;
        const res = await getLineageDataByFQN({
          fqn,
          entityType,
          config: config || currentState.lineageConfig,
          queryFilter: '',
        });

        const {
          nodes: parsedNodes,
          edges: parsedEdges,
          entity,
        } = parseLineageData(res, fqn, fqn);

        const {
          edges: updatedEdges,
          incomingMap,
          outgoingMap,
          columnsHavingLineage,
        } = createEdgesAndEdgeMaps(
          parsedNodes ?? [],
          parsedEdges ?? [],
          fqn,
          currentState.activeLayer.includes(LineageLayer.ColumnLevelLineage),
          false // Don't hide edges either!
        );

        const initialNodes = createNodes(
          parsedNodes ?? [],
          parsedEdges ?? [],
          fqn,
          incomingMap,
          outgoingMap,
          currentState.activeLayer.includes(LineageLayer.ColumnLevelLineage),
          false // Don't hide nodes!
        );

        // Apply layout to position nodes
        const layoutedElements = getLayoutedElements(
          { node: initialNodes, edge: updatedEdges },
          EntityLineageDirection.LEFT_RIGHT,
          currentState.activeLayer.includes(LineageLayer.ColumnLevelLineage),
          currentState.expandAllColumns,
          columnsHavingLineage
        );

        // Batch update state
        dispatch({
          type: LineageActionType.BATCH_UPDATE,
          payload: {
            entityLineage: { nodes: parsedNodes, edges: parsedEdges, entity },
            columnsHavingLineage,
            entityFqn: fqn,
          },
        });

        // Update React Flow state with layouted nodes
        setNodes(layoutedElements.node);
        setEdges(layoutedElements.edge);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.lineage-data-lowercase'),
          })
        );
      } finally {
        dispatch({ type: LineageActionType.SET_INIT, payload: true });
        dispatch({ type: LineageActionType.SET_LOADING, payload: false });
      }
    },
    [t, setNodes, setEdges] // Only depend on stable references
  );

  // Optimized callback handlers using useCallback
  const onInitReactFlow = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const onPaneClick = useCallback(() => {
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: false });
    dispatch({ type: LineageActionType.SET_TRACED_NODES, payload: [] });
    dispatch({ type: LineageActionType.SET_TRACED_COLUMNS, payload: [] });
    dispatch({
      type: LineageActionType.SET_SELECTED_NODE,
      payload: {} as SourceType,
    });
  }, []);

  const onNodeClick = useCallback((node: Node) => {
    if (node.type === EntityLineageNodeType.LOAD_MORE) {
      // Handle load more node click
      return;
    }

    dispatch({ type: LineageActionType.SET_SELECTED_EDGE, payload: undefined });
    dispatch({
      type: LineageActionType.SET_SELECTED_NODE,
      payload: node.data.node as SourceType,
    });
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: true });
  }, []);

  const onEdgeClick = useCallback((edge: Edge) => {
    dispatch({ type: LineageActionType.SET_SELECTED_EDGE, payload: edge });
    dispatch({
      type: LineageActionType.SET_SELECTED_NODE,
      payload: {} as SourceType,
    });
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: true });
    dispatch({ type: LineageActionType.SET_TRACED_NODES, payload: [] });
    dispatch({ type: LineageActionType.SET_TRACED_COLUMNS, payload: [] });
  }, []);

  const onColumnClick = useCallback((column: string) => {
    dispatch({ type: LineageActionType.SET_SELECTED_COLUMN, payload: column });
    dispatch({ type: LineageActionType.SET_TRACED_NODES, payload: [] });
    dispatch({ type: LineageActionType.SET_SELECTED_EDGE, payload: undefined });
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: false });
  }, []);

  const onLineageEditClick = useCallback(() => {
    dispatch({
      type: LineageActionType.SET_EDIT_MODE,
      payload: !state.isEditMode,
    });
    dispatch({
      type: LineageActionType.SET_SELECTED_NODE,
      payload: {} as SourceType,
    });
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: false });
  }, [state.isEditMode]);

  const onZoomUpdate = useCallback((value: number) => {
    dispatch({ type: LineageActionType.SET_ZOOM_VALUE, payload: value });
  }, []);

  const onLineageConfigUpdate = useCallback((config: LineageConfig) => {
    dispatch({ type: LineageActionType.SET_LINEAGE_CONFIG, payload: config });
  }, []);

  const onQueryFilterUpdate = useCallback((_query: string) => {
    // Handle query filter update
  }, []);

  const onDrawerClose = useCallback(() => {
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: false });
  }, []);

  const onNodeDrop = useCallback((event: DragEvent, _bounds: DOMRect) => {
    event.preventDefault();
    // Handle node drop for adding new nodes
  }, []);

  const onNodeCollapse = useCallback(
    (node: Node | NodeProps, direction: LineageDirection) => {
      const nodeData = 'data' in node ? node.data?.node : undefined;
      if (!nodeData) return;

      const nodeFqn = nodeData.fullyQualifiedName;

      // Find nodes to collapse (children in the specified direction)
      const nodesToCollapse = new Set<string>();
      const edgesToCheck = [...edges];
      const visited = new Set<string>();
      const queue = [nodeFqn];

      while (queue.length > 0) {
        const currentFqn = queue.shift();
        if (!currentFqn || visited.has(currentFqn)) continue;
        visited.add(currentFqn);

        edgesToCheck.forEach((edge) => {
          if (direction === LineageDirection.Downstream) {
            if (edge.source === currentFqn && edge.target !== nodeFqn) {
              nodesToCollapse.add(edge.target);
              queue.push(edge.target);
            }
          } else {
            if (edge.target === currentFqn && edge.source !== nodeFqn) {
              nodesToCollapse.add(edge.source);
              queue.push(edge.source);
            }
          }
        });
      }

      // Hide collapsed nodes
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          hidden: nodesToCollapse.has(n.id) ? true : n.hidden,
        }))
      );

      // Hide edges connected to collapsed nodes
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          hidden:
            nodesToCollapse.has(e.source) || nodesToCollapse.has(e.target)
              ? true
              : e.hidden,
        }))
      );
    },
    [edges, setNodes, setEdges]
  );

  const onConnect = useCallback(
    (connection: Edge | Connection) => {
      if (!state.isEditMode) {
        return;
      }

      // Create a new edge
      const newEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source ?? '',
        target: connection.target ?? '',
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'buttonedge',
        data: {
          isEditMode: true,
        },
      };

      setEdges((eds) => [...eds, newEdge]);

      // Open modal or drawer for adding pipeline information
      dispatch({
        type: LineageActionType.SET_MODAL_STATE,
        payload: { showAddEdgeModal: true },
      });
    },
    [state.isEditMode, setEdges]
  );

  const onColumnEdgeRemove = useCallback(() => {
    dispatch({
      type: LineageActionType.SET_MODAL_STATE,
      payload: { showDeleteModal: true },
    });
  }, []);

  const onAddPipelineClick = useCallback(() => {
    dispatch({
      type: LineageActionType.SET_MODAL_STATE,
      payload: { showAddEdgeModal: true },
    });
  }, []);

  const onUpdateLayerView = useCallback(
    (layers: LineageLayer[]) => {
      dispatch({ type: LineageActionType.SET_ACTIVE_LAYER, payload: layers });
      if (
        layers.includes(LineageLayer.ColumnLevelLineage) ||
        layers.includes(LineageLayer.DataObservability)
      ) {
        dispatch({
          type: LineageActionType.SET_PLATFORM_VIEW,
          payload: LineagePlatformView.None,
        });
      }

      // Re-layout the graph with new layer settings
      const currentState = stateRef.current;
      if (currentState.entityLineage.nodes && currentState.entityLineage.edges) {
        const {
          edges: updatedEdges,
          incomingMap,
          outgoingMap,
          columnsHavingLineage,
        } = createEdgesAndEdgeMaps(
          currentState.entityLineage.nodes,
          currentState.entityLineage.edges,
          currentState.entityFqn,
          layers.includes(LineageLayer.ColumnLevelLineage),
          false
        );

        const initialNodes = createNodes(
          currentState.entityLineage.nodes,
          currentState.entityLineage.edges,
          currentState.entityFqn,
          incomingMap,
          outgoingMap,
          layers.includes(LineageLayer.ColumnLevelLineage),
          false
        );

        const layoutedElements = getLayoutedElements(
          { node: initialNodes, edge: updatedEdges },
          EntityLineageDirection.LEFT_RIGHT,
          layers.includes(LineageLayer.ColumnLevelLineage),
          currentState.expandAllColumns,
          columnsHavingLineage
        );

        setNodes(layoutedElements.node);
        setEdges(layoutedElements.edge);
      }
    },
    [setNodes, setEdges]
  );

  const onExportClick = useCallback(() => {
    // Handle export
  }, []);

  const onPlatformViewChange = useCallback((view: LineagePlatformView) => {
    dispatch({ type: LineageActionType.SET_PLATFORM_VIEW, payload: view });
    if (view !== LineagePlatformView.None) {
      dispatch({ type: LineageActionType.SET_ACTIVE_LAYER, payload: [] });
    }
  }, []);

  const onCloseDrawer = useCallback(() => {
    dispatch({ type: LineageActionType.SET_DRAWER_OPEN, payload: false });
    dispatch({ type: LineageActionType.SET_SELECTED_EDGE, payload: undefined });
  }, []);

  const toggleColumnView = useCallback(() => {
    dispatch({
      type: LineageActionType.SET_EXPAND_ALL_COLUMNS,
      payload: !state.expandAllColumns,
    });
  }, [state.expandAllColumns]);

  const loadChildNodesHandler = useCallback(
    async (node: SourceType, direction: LineageDirection) => {
      dispatch({ type: LineageActionType.SET_LOADING, payload: true });
      try {
        const currentState = stateRef.current;
        const res = await getLineageDataByFQN({
          fqn: node.fullyQualifiedName ?? '',
          entityType: node.entityType ?? '',
          config: {
            upstreamDepth: direction === LineageDirection.Upstream ? 1 : 0,
            downstreamDepth: direction === LineageDirection.Downstream ? 1 : 0,
            nodesPerLayer: currentState.lineageConfig.nodesPerLayer,
          },
          queryFilter: '',
          direction,
        });

        // Parse and merge the new nodes with existing ones
        const { nodes: newNodes, edges: newEdges } = parseLineageData(
          res,
          node.fullyQualifiedName ?? '',
          currentState.entityFqn
        );

        // Merge nodes and edges
        const mergedNodes = [
          ...(currentState.entityLineage.nodes ?? []),
          ...(newNodes ?? []),
        ];
        const mergedEdges = [
          ...(currentState.entityLineage.edges ?? []),
          ...(newEdges ?? []),
        ];

        // Remove duplicates
        const uniqueNodes = Array.from(
          new Map(mergedNodes.map((n) => [n.fullyQualifiedName, n])).values()
        );
        const uniqueEdges = Array.from(
          new Map(
            mergedEdges.map((e) => [
              `${e.fromEntity.fullyQualifiedName}-${e.toEntity.fullyQualifiedName}`,
              e,
            ])
          ).values()
        );

        // Update entity lineage
        dispatch({
          type: LineageActionType.SET_ENTITY_LINEAGE,
          payload: {
            nodes: uniqueNodes,
            edges: uniqueEdges,
            entity: currentState.entityLineage.entity,
          },
        });

        // Re-layout the graph
        const {
          edges: updatedEdges,
          incomingMap,
          outgoingMap,
          columnsHavingLineage,
        } = createEdgesAndEdgeMaps(
          uniqueNodes,
          uniqueEdges,
          currentState.entityFqn,
          currentState.activeLayer.includes(LineageLayer.ColumnLevelLineage),
          false
        );

        const initialNodes = createNodes(
          uniqueNodes,
          uniqueEdges,
          currentState.entityFqn,
          incomingMap,
          outgoingMap,
          currentState.activeLayer.includes(LineageLayer.ColumnLevelLineage),
          false
        );

        const layoutedElements = getLayoutedElements(
          { node: initialNodes, edge: updatedEdges },
          EntityLineageDirection.LEFT_RIGHT,
          currentState.activeLayer.includes(LineageLayer.ColumnLevelLineage),
          currentState.expandAllColumns,
          columnsHavingLineage
        );

        setNodes(layoutedElements.node);
        setEdges(layoutedElements.edge);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.lineage-data-lowercase'),
          })
        );
      } finally {
        dispatch({ type: LineageActionType.SET_LOADING, payload: false });
      }
    },
    [t, setNodes, setEdges]
  );

  const removeNodeHandler = useCallback(
    (nodeToRemove: Node | NodeProps) => {
      const nodeId =
        'id' in nodeToRemove ? nodeToRemove.id : (nodeToRemove as NodeProps).data?.node?.id;
      const nodeFqn =
        'data' in nodeToRemove
          ? (nodeToRemove as NodeProps).data?.node?.fullyQualifiedName
          : undefined;

      // Remove node from nodes array
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));

      // Remove edges connected to this node
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );

      // Update entity lineage state
      const currentState = stateRef.current;
      const updatedNodes =
        currentState.entityLineage.nodes?.filter(
          (n) => n.fullyQualifiedName !== nodeFqn
        ) ?? [];
      const updatedEdges =
        currentState.entityLineage.edges?.filter(
          (e) =>
            e.fromEntity.fullyQualifiedName !== nodeFqn &&
            e.toEntity.fullyQualifiedName !== nodeFqn
        ) ?? [];

      dispatch({
        type: LineageActionType.SET_ENTITY_LINEAGE,
        payload: {
          nodes: updatedNodes,
          edges: updatedEdges,
          entity: currentState.entityLineage.entity,
        },
      });
    },
    [setNodes, setEdges]
  );

  const updateEntityData = useCallback(
    (_type: EntityType, entity?: SourceType, isPlatform?: boolean) => {
      if (entity) {
        dispatch({
          type: LineageActionType.BATCH_UPDATE,
          payload: {
            entityFqn: entity.fullyQualifiedName ?? '',
            isPlatformLineage: isPlatform ?? false,
          },
        });
      }
    },
    []
  );

  const updateEntityFqn = useCallback((fqn: string) => {
    dispatch({
      type: LineageActionType.BATCH_UPDATE,
      payload: { entityFqn: fqn },
    });
  }, []);

  const redraw = useCallback(async () => {
    // Handle redraw
  }, []);

  const exportLineageData = useCallback(async () => {
    // Handle export
    return {} as CSVExportResponse;
  }, []);

  // Memoize actions object
  const actions = useMemo(
    () => ({
      onInitReactFlow,
      onPaneClick,
      onNodeClick,
      onEdgeClick,
      onColumnClick,
      onLineageEditClick,
      onZoomUpdate,
      onLineageConfigUpdate,
      onQueryFilterUpdate,
      onDrawerClose,
      onNodeDrop,
      onNodeCollapse,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onColumnEdgeRemove,
      onAddPipelineClick,
      onUpdateLayerView,
      onExportClick,
      onPlatformViewChange,
      onCloseDrawer,
      toggleColumnView,
      loadChildNodesHandler,
      fetchLineageData,
      removeNodeHandler,
      updateEntityData,
      updateEntityFqn,
      redraw,
      exportLineageData,
    }),
    [
      onInitReactFlow,
      onPaneClick,
      onNodeClick,
      onEdgeClick,
      onColumnClick,
      onLineageEditClick,
      onZoomUpdate,
      onLineageConfigUpdate,
      onQueryFilterUpdate,
      onDrawerClose,
      onNodeDrop,
      onNodeCollapse,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onColumnEdgeRemove,
      onAddPipelineClick,
      onUpdateLayerView,
      onExportClick,
      onPlatformViewChange,
      onCloseDrawer,
      toggleColumnView,
      loadChildNodesHandler,
      fetchLineageData,
      removeNodeHandler,
      updateEntityData,
      updateEntityFqn,
      redraw,
      exportLineageData,
    ]
  );

  return (
    <LineageActionsProvider actions={actions}>
      <LineageDataProvider
        columnsHavingLineage={state.columnsHavingLineage}
        edges={edges}
        entityLineage={state.entityLineage}
        lineageConfig={state.lineageConfig}
        nodes={nodes}
        tracedColumns={state.tracedColumns}
        tracedNodes={state.tracedNodes}>
        <LineageUIProvider
          activeLayer={state.activeLayer}
          init={state.init}
          isDrawerOpen={state.isDrawerOpen}
          isEditMode={state.isEditMode}
          loading={state.loading}
          selectedColumn={state.selectedColumn}
          selectedEdge={state.selectedEdge}
          selectedNode={state.selectedNode}
          status={state.status}>
          <LineageViewProvider
            entityFqn={state.entityFqn}
            expandAllColumns={state.expandAllColumns}
            isPlatformLineage={state.isPlatformLineage}
            platformView={state.platformView}
            reactFlowInstance={reactFlowInstance}
            zoomValue={state.zoomValue}>
            {children}
          </LineageViewProvider>
        </LineageUIProvider>
      </LineageDataProvider>
    </LineageActionsProvider>
  );
};

export default LineageProviderV1;

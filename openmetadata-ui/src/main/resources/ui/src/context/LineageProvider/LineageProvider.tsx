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
import { Home02 } from '@untitledui/icons';
import { Modal } from 'antd';
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
import {
  createContext,
  DragEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Connection,
  Edge,
  getConnectedEdges,
  getIncomers,
  getOutgoers,
  Node,
  NodeProps,
  ReactFlowInstance,
  useEdgesState,
  useKeyPress,
  useNodesState,
} from 'reactflow';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { useEntityExportModalProvider } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { CSVExportResponse } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import EdgeInfoDrawer from '../../components/Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../../components/Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import AddPipeLineModal from '../../components/Entity/EntityLineage/AppPipelineModel/AddPipeLineModal';
import {
  ElementLoadingState,
  LineageConfig,
} from '../../components/Entity/EntityLineage/EntityLineage.interface';
import EntityLineageSidebar from '../../components/Entity/EntityLineage/EntityLineageSidebar.component';
import NodeSuggestions from '../../components/Entity/EntityLineage/NodeSuggestions.component';
import { ExploreQuickFilterField } from '../../components/Explore/ExplorePage.interface';
import {
  EdgeDetails,
  EntityLineageResponse,
  LineageData,
  LineageEntityReference,
  NodeData,
} from '../../components/Lineage/Lineage.interface';
import LineageNodeRemoveButton from '../../components/Lineage/LineageNodeRemoveButton';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { FULLSCREEN_QUERY_PARAM_KEY, ROUTES } from '../../constants/constants';
import {
  ExportTypes,
  LINEAGE_EXPORT_SELECTOR,
} from '../../constants/Export.constants';
import {
  ELEMENT_DELETE_STATE,
  ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { EntityLineageNodeType, EntityType } from '../../enums/entity.enum';
import { AddLineage } from '../../generated/api/lineage/addLineage';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import {
  LineageSettings,
  PipelineViewMode,
} from '../../generated/configuration/lineageSettings';
import { Table } from '../../generated/entity/data/table';
import { LineageLayer } from '../../generated/settings/settings';
import {
  ColumnLineage,
  EntityReference,
  LineageDetails,
} from '../../generated/type/entityLineage';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../hooks/useFqn';
import {
  exportLineageAsync,
  getDataQualityLineage,
  getLineageDataByFQN,
  getPlatformLineage,
  updateLineageEdge,
} from '../../rest/lineageAPI';
import { getCurrentISODate } from '../../utils/date-time/DateTimeUtils';
import {
  addLineageHandler,
  centerNodePosition,
  createEdgesAndEdgeMaps,
  createNewEdge,
  createNodes,
  decodeLineageHandles,
  getAllDownstreamEdges,
  getAllTracedColumnEdge,
  getClassifiedEdge,
  getConnectedNodesEdges,
  getEdgeDataFromEdge,
  getELKLayoutedElements,
  getEntityTypeFromPlatformView,
  getLineageEdge,
  getLineageEdgeForAPI,
  getLoadingStatusValue,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getUpdatedColumnsFromEdge,
  getUpstreamDownstreamNodesEdges,
  getViewportForLineageExport,
  onLoad,
  parseLineageData,
  positionNodesUsingElk,
  removeLineageHandler,
  removeUnconnectedNodes,
} from '../../utils/EntityLineageUtils';
import {
  getEntityBreadcrumbs,
  getEntityReferenceFromEntity,
  updateNodeType,
} from '../../utils/EntityUtils';
import { getQuickFilterQuery } from '../../utils/ExploreUtils';
import tableClassBase from '../../utils/TableClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { useTourProvider } from '../TourProvider/TourProvider';
import {
  LineageContextType,
  LineagePlatformView,
  LineageProviderProps,
} from './LineageProvider.interface';

export const LineageContext = createContext({} as LineageContextType);

const LineageProvider = ({ children }: LineageProviderProps) => {
  const { t } = useTranslation();
  const { fqn: decodedFqn } = useFqn();
  const location = useCustomLocation();
  const { isTourOpen, isTourPage } = useTourProvider();
  const { appPreferences } = useApplicationStore();
  const { preferences } = useCurrentUserPreferences();
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

  // Added this ref to compare the previous active layer with the current active layer.
  // We need to redraw the lineage if the column level lineage is added or removed.
  const prevActiveLayerRef = useRef<LineageLayer[]>([]);

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
  const [lineageData, setLineageData] = useState<LineageData>();
  const [platformView, setPlatformView] = useState<LineagePlatformView>(
    LineagePlatformView.None
  );
  const [entity, setEntity] = useState<SourceType>();
  const navigate = useNavigate();
  const [dataQualityLineage, setDataQualityLineage] =
    useState<EntityLineageResponse>();
  const [updatedEntityLineage, setUpdatedEntityLineage] =
    useState<EntityLineageResponse | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
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
    pipelineViewMode: PipelineViewMode.Node,
  });
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([]);
  const [entityType, setEntityType] = useState<EntityType>();
  const queryParams = new URLSearchParams(location.search);
  const isFullScreen = queryParams.get(FULLSCREEN_QUERY_PARAM_KEY) === 'true';
  const deletePressed = useKeyPress('Delete');
  const backspacePressed = useKeyPress('Backspace');
  const { showModal } = useEntityExportModalProvider();
  const [isPlatformLineage, setIsPlatformLineage] = useState(false);
  const [dqHighlightedEdges, setDqHighlightedEdges] = useState<Set<string>>();

  // Add state for entityFqn that can be updated independently of URL params
  const [entityFqn, setEntityFqn] = useState<string>(decodedFqn);

  const queryFilter = useMemo(() => {
    const quickFilterQuery = getQuickFilterQuery(selectedQuickFilters);

    return JSON.stringify(quickFilterQuery) ?? '';
  }, [selectedQuickFilters]);

  // Update entityFqn when decodedFqn changes (for backward compatibility)
  useEffect(() => {
    if (decodedFqn) {
      setEntityFqn(decodedFqn);
    }
  }, [decodedFqn]);

  // Function to update entityFqn
  const updateEntityFqn = useCallback((fqn: string) => {
    setEntityFqn(fqn);
  }, []);

  const lineageLayer = useMemo(() => {
    const searchData = QueryString.parse(location.search, {
      ignoreQueryPrefix: true,
    });

    return searchData.layers as LineageLayer[] | undefined;
  }, [location.search]);

  const isPlatformLineagePage = useMemo(() => {
    return location.pathname === ROUTES.PLATFORM_LINEAGE;
  }, [location]);

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

  const redrawLineage = useCallback(
    async (
      lineageData: EntityLineageResponse,
      recenter = true,
      isFirstTime = false
    ) => {
      // Wait for reactFlowInstance to be available
      if (!reactFlowInstance?.viewportInitialized) {
        return;
      }

      const allNodes: LineageEntityReference[] = uniqWith(
        [
          ...(lineageData.nodes ?? []),
          ...(lineageData.entity ? [lineageData.entity] : []),
        ],
        isEqual
      );

      const {
        edges: updatedEdges,
        incomingMap,
        outgoingMap,
        columnsHavingLineage,
      } = createEdgesAndEdgeMaps(
        allNodes,
        lineageData.edges ?? [],
        entityFqn,
        activeLayer.includes(LineageLayer.ColumnLevelLineage),
        isFirstTime ? true : undefined
      );

      const initialNodes = createNodes(
        allNodes,
        lineageData.edges ?? [],
        entityFqn,
        incomingMap,
        outgoingMap,
        activeLayer.includes(LineageLayer.ColumnLevelLineage),
        isFirstTime ? true : undefined
      );

      // Skip animation frame if first time
      if (isFirstTime) {
        // Set initial nodes and edges
        setNodes(initialNodes);
        setEdges(updatedEdges);

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      // Position nodes with actual dimensions
      const positionedNodesEdges = await positionNodesUsingElk(
        initialNodes,
        updatedEdges,
        activeLayer.includes(LineageLayer.ColumnLevelLineage),
        isEditMode || expandAllColumns,
        columnsHavingLineage
      );

      const visibleNodes = positionedNodesEdges.nodes.map((node) => ({
        ...node,
        ...(isFirstTime && { hidden: undefined }),
      }));

      const visibleEdges = positionedNodesEdges.edges.map((edge) => ({
        ...edge,
        ...(isFirstTime && { hidden: undefined }),
      }));

      // Center on root node if requested
      if (recenter) {
        const rootNode = visibleNodes.find((n) => n.data.isRootNode);
        if (rootNode) {
          centerNodePosition(rootNode, reactFlowInstance, zoomValue);
        } else if (visibleNodes.length > 0) {
          centerNodePosition(visibleNodes[0], reactFlowInstance, zoomValue);
        }
      }

      setNodes(visibleNodes);
      setEdges(visibleEdges);
      setColumnsHavingLineage(columnsHavingLineage);
    },
    [
      entityFqn,
      activeLayer,
      isEditMode,
      reactFlowInstance,
      zoomValue,
      expandAllColumns,
    ]
  );

  const updateLineageData = useCallback(
    (
      newLineageData: EntityLineageResponse,
      options: {
        shouldRedraw?: boolean;
        centerNode?: boolean;
        isFirstTime?: boolean;
      } = {}
    ) => {
      const {
        shouldRedraw = false,
        centerNode = false,
        isFirstTime = false,
      } = options;

      setEntityLineage(newLineageData);

      if (shouldRedraw) {
        redrawLineage(newLineageData, centerNode, isFirstTime);
      }
    },
    [redrawLineage]
  );

  const fetchPlatformLineage = useCallback(
    async (view: string, config?: LineageConfig) => {
      try {
        setLoading(true);
        setInit(false);
        const res = await getPlatformLineage({
          config,
          view,
        });

        setLineageData(res);

        const { nodes, edges, entity } = parseLineageData(
          res,
          '',
          entityFqn,
          config?.pipelineViewMode
        );
        const updatedEntityLineage = {
          nodes,
          edges,
          entity,
        };

        setEntityLineage(updatedEntityLineage);
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
    [entityFqn]
  );

  const fetchLineageData = useCallback(
    async (fqn: string, entityType: string, config?: LineageConfig) => {
      if (isTourOpen) {
        return;
      }

      setLoading(true);
      setInit(false);

      setNodes([]);
      setEdges([]);

      try {
        const res = await getLineageDataByFQN({
          fqn,
          entityType,
          config,
          queryFilter,
        });
        setLineageData(res);

        const { nodes, edges, entity } = parseLineageData(
          res,
          fqn,
          entityFqn,
          config?.pipelineViewMode
        );
        const updatedEntityLineage = {
          nodes,
          edges,
          entity,
        };

        setEntityLineage(updatedEntityLineage);
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
    [queryFilter, entityFqn]
  );

  const onPlatformViewChange = useCallback(
    (view: LineagePlatformView) => {
      setPlatformView(view);
      if (view !== LineagePlatformView.None) {
        setActiveLayer([]);
      }

      if (isPlatformLineage) {
        const searchData = QueryString.parse(location.search, {
          ignoreQueryPrefix: true,
        });
        navigate({
          search: QueryString.stringify({
            ...searchData,
            platformView: view !== LineagePlatformView.None ? view : undefined,
          }),
        });
      }
    },
    [isPlatformLineage, location.search]
  );

  const exportLineageData = useCallback(async () => {
    return exportLineageAsync(
      entityFqn,
      entityType ?? '',
      lineageConfig,
      queryFilter
    );
  }, [entityType, entityFqn, lineageConfig, queryFilter]);

  const onExportClick = useCallback(
    (
      exportTypes: ExportTypes[] = [ExportTypes.CSV, ExportTypes.PNG],
      onExportCallback?: (_: string) => Promise<CSVExportResponse>
    ) => {
      if (entityFqn || isPlatformLineagePage) {
        showModal({
          ...(isPlatformLineagePage
            ? {
                name: `${t('label.lineage')}_${getCurrentISODate()}`,
                exportTypes: [ExportTypes.PNG],
              }
            : {
                name: entityFqn,
                exportTypes: exportTypes,
              }),
          title: t('label.lineage'),
          documentSelector: LINEAGE_EXPORT_SELECTOR,
          viewport: exportTypes?.includes(ExportTypes.PNG)
            ? getViewportForLineageExport(nodes, LINEAGE_EXPORT_SELECTOR)
            : undefined,
          onExport: onExportCallback ?? exportLineageData,
        });
      }
    },
    [
      entityType,
      entityFqn,
      lineageConfig,
      queryFilter,
      nodes,
      isPlatformLineagePage,
    ]
  );

  const loadChildNodesHandler = useCallback(
    async (node: SourceType, direction: LineageDirection, depth = 1) => {
      try {
        const res = await getLineageDataByFQN({
          fqn: node.fullyQualifiedName ?? '',
          entityType: node.entityType ?? '',
          config: {
            upstreamDepth: direction === LineageDirection.Upstream ? depth : 0,
            downstreamDepth:
              direction === LineageDirection.Downstream ? depth : 0,
            nodesPerLayer: lineageConfig.nodesPerLayer,
            pipelineViewMode: lineageConfig.pipelineViewMode,
          }, // load only one level of child nodes
          queryFilter,
          direction,
        });

        const currentNodes: Record<string, NodeData> = {};
        for (const node of entityLineage.nodes ?? []) {
          currentNodes[node.fullyQualifiedName ?? ''] = {
            entity: node,
            paging: (node as LineageEntityReference).paging ?? {
              entityDownstreamCount: 0,
              entityUpstreamCount: 0,
            },
          };
        }
        const concatenatedLineageData = {
          nodes: {
            ...currentNodes,
            ...res.nodes,
          },
          downstreamEdges: {
            ...lineageData?.downstreamEdges,
            ...res.downstreamEdges,
          },
          upstreamEdges: {
            ...lineageData?.upstreamEdges,
            ...res.upstreamEdges,
          },
        };

        const { nodes: newNodes, edges: newEdges } = parseLineageData(
          concatenatedLineageData,
          node.fullyQualifiedName ?? '',
          entityFqn
        );

        const uniqueNodes = [...(entityLineage.nodes ?? [])];
        for (const nNode of newNodes ?? []) {
          if (
            !uniqueNodes.some(
              (n) => n.fullyQualifiedName === nNode.fullyQualifiedName
            )
          ) {
            uniqueNodes.push(nNode);
          }
        }

        const updatedEntityLineage = {
          entity: entityLineage.entity,
          nodes: uniqueNodes,
          edges: uniqWith(
            [...(entityLineage.edges ?? []), ...newEdges],
            isEqual
          ),
        };

        // remove the nodes and edges from the lineageData
        const visibleNodes: Record<string, NodeData> = {};
        for (const node of uniqueNodes) {
          visibleNodes[node.fullyQualifiedName ?? ''] = {
            entity: node,
            paging: (node as LineageEntityReference).paging ?? {
              entityDownstreamCount: 0,
              entityUpstreamCount: 0,
            },
          };
        }

        const currentNode = updatedEntityLineage.nodes.find(
          (n) => n.fullyQualifiedName === node.fullyQualifiedName
        );

        if (currentNode) {
          if (direction === LineageDirection.Upstream) {
            (currentNode as LineageEntityReference).upstreamExpandPerformed =
              true;
          } else {
            (currentNode as LineageEntityReference).downstreamExpandPerformed =
              true;
          }
        }

        updateLineageData(updatedEntityLineage, {
          shouldRedraw: true,
          centerNode: false,
          isFirstTime: false,
        });

        // Update only the edges in lineageData. These edges are further used in
        // processing the nodes when node is expanded.
        setLineageData((prev) => {
          return {
            nodes: prev?.nodes ?? {},
            downstreamEdges: concatenatedLineageData.downstreamEdges,
            upstreamEdges: concatenatedLineageData.upstreamEdges,
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
    [
      nodes,
      edges,
      lineageConfig,
      entityLineage,
      setEntityLineage,
      queryFilter,
      entityFqn,
    ]
  );

  const handleLineageTracing = useCallback(
    (selectedNode: Node) => {
      // Skip processing if this is the same node that was already traced
      if (activeNode?.id === selectedNode.id && tracedNodes.length > 0) {
        return;
      }
      const { normalEdge } = getClassifiedEdge(edges);
      const connectedNodeIds = new Set<string>([selectedNode.id]);
      const nodesToProcess = [selectedNode];

      // Process upstream nodes (incomers)
      for (const node of nodesToProcess) {
        const incomers = getIncomers(node, nodes, normalEdge);
        for (const incomer of incomers) {
          if (!connectedNodeIds.has(incomer.id)) {
            connectedNodeIds.add(incomer.id);
            nodesToProcess.push(incomer);
          }
        }
      }

      // Reset and process downstream nodes (outgoers)
      nodesToProcess.length = 0;
      nodesToProcess.push(selectedNode);

      for (const node of nodesToProcess) {
        const outgoers = getOutgoers(node, nodes, normalEdge);
        for (const outgoer of outgoers) {
          if (!connectedNodeIds.has(outgoer.id)) {
            connectedNodeIds.add(outgoer.id);
            nodesToProcess.push(outgoer);
          }
        }
      }

      setTracedNodes(Array.from(connectedNodeIds));
      setTracedColumns([]);
    },
    [nodes, edges, activeNode, tracedNodes]
  );

  const onUpdateLayerView = useCallback((layers: LineageLayer[]) => {
    setActiveLayer(layers);
    if (
      layers.includes(LineageLayer.ColumnLevelLineage) ||
      layers.includes(LineageLayer.DataObservability)
    ) {
      setPlatformView(LineagePlatformView.None);
    }
  }, []);

  const updateEntityData = useCallback(
    (
      entityType: EntityType,
      entity?: SourceType,
      isPlatformLineage?: boolean
    ) => {
      setEntity(entity);
      setEntityFqn(entity?.fullyQualifiedName ?? '');
      setEntityType(entityType);
      setIsPlatformLineage(isPlatformLineage ?? false);
      if (isPlatformLineage && !entity) {
        onPlatformViewChange(LineagePlatformView.Service);
      }
    },
    []
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

    const customPipelineEdge = edge.data.edge.extraInfo;

    const edgeData = getEdgeDataFromEdge(edge);

    await removeLineageHandler(edgeData);

    let filteredEdges: EdgeDetails[] = [];

    if (customPipelineEdge) {
      // find all edges where customPipelineEdge.docId is equal to extraInfo.docId
      filteredEdges = (entityLineage.edges ?? []).filter(
        (item) => item.extraInfo?.docId !== customPipelineEdge.docId
      );

      setEdges((prev) => {
        return prev.filter(
          (item) => item.data.edge.extraInfo?.docId !== customPipelineEdge.docId
        );
      });
    } else {
      filteredEdges = (entityLineage.edges ?? []).filter(
        (item) =>
          !(
            item.fromEntity.id === edgeData.fromId &&
            item.toEntity.id === edgeData.toId
          )
      );

      // Remove the source and target nodes if they are not connected to any other nodes
      const updatedNodes = removeUnconnectedNodes(edgeData, nodes, edges);
      setNodes(updatedNodes);

      setEdges((prev) => {
        return prev.filter(
          (item) =>
            !(item.source === edgeData.fromId && item.target === edgeData.toId)
        );
      });
    }

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

    // filter the edge from edges
    setEdges((prev) => {
      return prev.filter((item) => item.id !== edge.id);
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
          const edgeData = getEdgeDataFromEdge(edge);
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
            <>
              <LineageNodeRemoveButton
                onRemove={() => removeNodeHandler(newNode as Node)}
              />

              <NodeSuggestions
                entityType={entityType}
                onSelectHandler={(value) => onEntitySelect(value, nodeId)}
              />
            </>
          ),
          isEditMode,
          isNewNode: true,
        },
      };
      setNodes([...nodes, newNode as Node]);
      setNewAddedNode(newNode as Node);
    }
  };

  const selectLoadMoreNode = async (node: Node) => {
    const { pagination_data, direction } = node.data.node;
    const { parentId, index: from } = pagination_data;

    // Find parent node to get its details
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) {
      return;
    }

    try {
      const config: LineageConfig = {
        ...lineageConfig,
        upstreamDepth: direction === LineageDirection.Upstream ? 1 : 0,
        downstreamDepth: direction === LineageDirection.Downstream ? 1 : 0,
      };

      const res = await getLineageDataByFQN({
        fqn: parentNode.data.node.fullyQualifiedName,
        entityType: parentNode.data.node.entityType,
        config,
        queryFilter,
        from,
        direction,
      });

      const concatenatedLineageData = {
        nodes: {
          ...lineageData?.nodes,
          ...res.nodes,
        },
        downstreamEdges: {
          ...lineageData?.downstreamEdges,
          ...res.downstreamEdges,
        },
        upstreamEdges: {
          ...lineageData?.upstreamEdges,
          ...res.upstreamEdges,
        },
      };

      setLineageData(concatenatedLineageData);

      const { nodes: newNodes, edges: newEdges } = parseLineageData(
        concatenatedLineageData,
        parentNode.data.node.fullyQualifiedName,
        entityFqn
      );

      updateLineageData(
        {
          ...entityLineage,
          nodes: uniqWith([...newNodes], isEqual),
          edges: uniqWith([...newEdges], isEqual),
        },
        {
          shouldRedraw: true,
        }
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.lineage-data-lowercase'),
        })
      );
    }
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
    if (reactFlowInstance.viewportInitialized) {
      redraw();
    }
  };

  const onLineageConfigUpdate = useCallback((config: LineageConfig) => {
    setLineageConfig(config);
  }, []);

  const onDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const onZoomUpdate = useCallback((value: number) => {
    setZoomValue(value);
  }, []);

  const onCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedEdge(undefined);
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
          newEdgeWithoutFqn.edge.lineageDetails =
            lineageDetails as AddLineage['edge']['lineageDetails'];
        }

        addLineageHandler(newEdgeWithoutFqn)
          .then(() => {
            if (!entityLineage) {
              return;
            }
            setStatus('success');
            setLoading(false);

            const allNodes = uniqWith(
              [
                ...(entityLineage.nodes ?? []),
                sourceNode?.data.node as EntityReference,
                targetNode?.data.node as EntityReference,
              ],
              isEqual
            );

            const allEdges = isUndefined(currentEdge)
              ? uniqWith(
                  [...(entityLineage.edges ?? []), newEdgeWithFqn.edge],
                  isEqual
                )
              : entityLineage.edges ?? [];

            if (currentEdge && columnConnection) {
              currentEdge.columns = updatedColumns; // update current edge with new columns
            }

            updateLineageData({
              ...entityLineage,
              nodes: allNodes,
              edges: allEdges,
            });

            setNodes((prev) =>
              prev.map((node) =>
                updateNodeType(node, sourceNode?.id, targetNode?.id)
              )
            );

            const { edges: createdEdges, columnsHavingLineage } =
              createEdgesAndEdgeMaps(
                allNodes,
                allEdges,
                entityFqn,
                activeLayer.includes(LineageLayer.ColumnLevelLineage)
              );
            setEdges(createdEdges);
            setColumnsHavingLineage(columnsHavingLineage);

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
    [entityLineage, nodes, entityFqn]
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
                columns: updatedEdgeDetails.edge.lineageDetails?.columnsLineage,
                description,
                sqlQuery,
              },
            },
          };
        });
        // Update the edge in the edges array
        setEdges((prev) => {
          return prev.map((edge) => {
            return edge.id === selectedEdge?.id
              ? {
                  ...edge,
                  data: {
                    ...edge.data,
                    edge: {
                      ...edge.data?.edge,
                      columns:
                        updatedEdgeDetails.edge.lineageDetails?.columnsLineage,
                      description,
                      sqlQuery,
                    },
                  },
                }
              : edge;
          });
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
    (node: Node | NodeProps, direction: LineageDirection) => {
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

      // Find the node in updatedNodes by ID and set expandPerformed: false
      const currentNodeId = (node as Node).id;
      const nodeToUpdate = updatedNodes.find((n) => n.id === currentNodeId);
      if (nodeToUpdate) {
        if (direction === LineageDirection.Upstream) {
          (nodeToUpdate as LineageEntityReference).upstreamExpandPerformed =
            false;
        } else {
          (nodeToUpdate as LineageEntityReference).downstreamExpandPerformed =
            false;
        }
      }

      // remove the nodes and edges from the lineageData
      const visibleNodes: Record<string, NodeData> = {};
      for (const node of updatedNodes) {
        visibleNodes[node.fullyQualifiedName ?? ''] = {
          entity: node,
          paging: (node as LineageEntityReference).paging ?? {
            entityDownstreamCount: 0,
            entityUpstreamCount: 0,
          },
        };
      }

      updateLineageData(
        {
          ...entityLineage,
          nodes: updatedNodes,
          edges: updatedEdges,
        },
        {
          shouldRedraw: true,
          centerNode: false,
          isFirstTime: false,
        }
      );
    },
    [nodes, edges, entityLineage]
  );

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

  const redraw = useCallback(async () => {
    if (entityLineage) {
      await redrawLineage(entityLineage, true);
    }
  }, [entityLineage, redrawLineage]);

  const onPlatformViewUpdate = useCallback(() => {
    if (entity && entityFqn && entityType) {
      if (platformView === LineagePlatformView.Service && entity?.service) {
        fetchLineageData(
          entity?.service.fullyQualifiedName ?? '',
          entity?.service.type,
          lineageConfig
        );
      } else if (
        platformView === LineagePlatformView.Domain &&
        !isEmpty(entity?.domains)
      ) {
        fetchLineageData(
          entity?.domains?.[0]?.fullyQualifiedName ?? '',
          entity?.domains?.[0]?.type ?? '',
          lineageConfig
        );
      } else if (
        platformView === LineagePlatformView.DataProduct &&
        ((entity as Table)?.dataProducts ?? [])?.length > 0
      ) {
        fetchLineageData(
          (entity as Table)?.dataProducts?.[0]?.fullyQualifiedName ?? '',
          (entity as Table)?.dataProducts?.[0]?.type ?? '',
          lineageConfig
        );
      } else if (platformView === LineagePlatformView.None) {
        fetchLineageData(entityFqn, entityType, lineageConfig);
      } else if (isPlatformLineage) {
        fetchPlatformLineage(
          getEntityTypeFromPlatformView(platformView),
          lineageConfig
        );
      }
    } else if (isPlatformLineage) {
      fetchPlatformLineage(
        getEntityTypeFromPlatformView(platformView),
        lineageConfig
      );
    }
  }, [
    entity,
    entityType,
    entityFqn,
    lineageConfig,
    platformView,
    queryFilter,
    isPlatformLineage,
  ]);

  useEffect(() => {
    if (defaultLineageConfig) {
      setLineageConfig({
        upstreamDepth: defaultLineageConfig.upstreamDepth,
        downstreamDepth: defaultLineageConfig.downstreamDepth,
        pipelineViewMode: defaultLineageConfig.pipelineViewMode,
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
    if (!isEditMode && updatedEntityLineage !== null) {
      // On exit of edit mode, use updatedEntityLineage and update data.
      const { downstreamEdges, upstreamEdges } =
        getUpstreamDownstreamNodesEdges(
          updatedEntityLineage.edges ?? [],
          updatedEntityLineage.nodes ?? [],
          entityFqn
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
  }, [isEditMode, updatedEntityLineage, entityFqn]);

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
    const prevActiveLayer = prevActiveLayerRef.current;

    const prevHadColumn = prevActiveLayer.includes(
      LineageLayer.ColumnLevelLineage
    );
    const currHasColumn = activeLayer.includes(LineageLayer.ColumnLevelLineage);

    if (prevHadColumn !== currHasColumn) {
      redraw();
    } else {
      repositionLayout();
    }

    prevActiveLayerRef.current = activeLayer;
  }, [activeLayer, expandAllColumns]);

  useEffect(() => {
    if (reactFlowInstance?.viewportInitialized) {
      redraw();
    }
  }, [reactFlowInstance?.viewportInitialized]);

  useEffect(() => {
    onPlatformViewUpdate();
  }, [
    platformView,
    lineageConfig,
    queryFilter,
    entityType,
    isLineageSettingsLoaded,
  ]);

  const activityFeedContextValues: LineageContextType = useMemo(() => {
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
      init,
      activeLayer,
      columnsHavingLineage,
      expandAllColumns,
      platformView,
      isPlatformLineage,
      entityFqn,
      exportLineageData,
      onCloseDrawer,
      updateEntityFqn,
      toggleColumnView,
      onInitReactFlow,
      onPaneClick,
      onConnect,
      onNodeDrop,
      onNodeCollapse,
      onColumnClick,
      onNodesChange,
      onEdgesChange,
      onZoomUpdate,
      updateEntityData,
      onDrawerClose,
      loadChildNodesHandler,
      fetchLineageData,
      removeNodeHandler,
      onNodeClick,
      onEdgeClick,
      onColumnEdgeRemove,
      selectedQuickFilters,
      setSelectedQuickFilters,
      onLineageConfigUpdate,
      onLineageEditClick,
      onAddPipelineClick,
      onUpdateLayerView,
      onExportClick,
      dataQualityLineage,
      redraw,
      queryFilter,
      onPlatformViewChange,
      dqHighlightedEdges,
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
    init,
    activeLayer,
    columnsHavingLineage,
    expandAllColumns,
    isPlatformLineage,
    entityFqn,
    exportLineageData,
    onCloseDrawer,
    updateEntityFqn,
    toggleColumnView,
    onInitReactFlow,
    onPaneClick,
    onConnect,
    onNodeDrop,
    onNodeCollapse,
    onColumnClick,
    selectedQuickFilters,
    setSelectedQuickFilters,
    onNodesChange,
    onEdgesChange,
    onZoomUpdate,
    onDrawerClose,
    updateEntityData,
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
    redraw,
    onPlatformViewChange,
    dqHighlightedEdges,
  ]);

  useEffect(() => {
    if (isTourOpen || isTourPage) {
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
      fetchDataQualityLineage(entityFqn, lineageConfig);
    }
  }, [activeLayer, entityFqn, lineageConfig]);

  useEffect(() => {
    if (
      dataQualityLineage?.nodes &&
      !isUndefined(edges) &&
      isUndefined(dqHighlightedEdges)
    ) {
      const edgesToHighlight = dataQualityLineage.nodes
        .flatMap((dqNode) => getAllDownstreamEdges(dqNode.id, edges ?? []))
        .map((edge) => edge.id);
      const edgesToHighlightSet = new Set(edgesToHighlight);
      setDqHighlightedEdges(edgesToHighlightSet);
    }
  }, [dataQualityLineage, edges, dqHighlightedEdges]);

  const breadcrumbs = useMemo(
    () =>
      entity
        ? [
            ...getEntityBreadcrumbs(entity, entityType, isFullScreen),
            {
              name: t('label.lineage'),
              url: '',
              activeTitle: true,
            },
          ]
        : platformView
        ? [
            {
              name: '',
              icon: <Home02 size={12} />,
              url: '/',
              activeTitle: true,
            },
            {
              name: t('label.lineage'),
              url: '',
            },
          ]
        : [],
    [entity, isFullScreen, entityType]
  );

  return (
    <LineageContext.Provider value={activityFeedContextValues}>
      <div
        className={classNames('lineage-root', {
          'full-screen-lineage': isFullScreen,
          'sidebar-collapsed': isFullScreen && preferences?.isSidebarCollapsed,
          'sidebar-expanded': isFullScreen && !preferences?.isSidebarCollapsed,
        })}>
        {isFullScreen && breadcrumbs.length > 0 && (
          <TitleBreadcrumb
            useCustomArrow
            className="p-b-sm"
            titleLinks={breadcrumbs}
          />
        )}
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
              onClose={onCloseDrawer}
              onEdgeDetailsUpdate={onEdgeDetailsUpdate}
            />
          ) : (
            !isEmpty(selectedNode) && (
              <EntityInfoDrawer
                selectedNode={selectedNode}
                show={isDrawerOpen}
                onCancel={onCloseDrawer}
              />
            )
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

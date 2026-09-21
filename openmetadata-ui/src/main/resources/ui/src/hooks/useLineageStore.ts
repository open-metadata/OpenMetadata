/*
 *  Copyright 2025 Collate.
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
import { uniq } from 'lodash';
import { LoadingState } from 'Models';
import type {
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  ReactFlowInstance,
} from 'reactflow';
import { applyEdgeChanges, applyNodeChanges } from 'reactflow';
import { create } from 'zustand';
// Type-only import of the shared Lineage interface (also consumed the same way by
// LineageProvider.interface.tsx); relocating it to a lower layer is out of scope for this task.
// eslint-disable-next-line openmetadata-imports/no-hook-ui-imports
import type { EntityLineageResponse } from '../components/Lineage/Lineage.interface';
// Type-only import of the shared Explore quick-filter type; relocating it to a lower layer
// is out of scope for this task (tracked for a later phase).
// eslint-disable-next-line openmetadata-imports/no-hook-ui-imports
import type { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { ZOOM_VALUE } from '../constants/Lineage.constants';
import {
  LineagePlatformView,
  LineageTimeRange,
} from '../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { LineageBand } from '../generated/api/lineage/lineageScene';
import { LineageLayer, PipelineViewMode } from '../generated/settings/settings';
import type { LineageConfig } from '../interface/lineage.interface';
import type { SourceType } from '../interface/source.interface';

interface LineageState {
  // state properties
  isEditMode: boolean;
  lineageConfig: LineageConfig;
  tracedColumns: Set<string>;
  tracedNodes: Set<string>;
  zoomValue: number;
  columnsHavingLineage: Map<string, Set<string>>;
  activeLayer: LineageLayer[];
  platformView: LineagePlatformView;
  isPlatformLineage: boolean;
  activeNode?: Node;
  selectedEdge?: Edge;
  selectedNode?: SourceType;
  isColumnLevelLineage: boolean;
  isDQEnabled: boolean;
  selectedColumn?: string;
  isCreatingEdge: boolean;
  columnsInCurrentPages: Map<string, string[]>;
  nodeFilterState: Map<string, boolean>;
  isRepositioning: boolean;
  isCanvasReady: boolean;
  lineageMutationTick: number;
  sceneBand?: LineageBand;
  nodes: Node[];
  edges: Edge[];
  columnEdges: Edge[];
  entityLineage: EntityLineageResponse;
  updatedEntityLineage?: EntityLineageResponse;
  dataQualityLineage?: EntityLineageResponse;
  dqHighlightedEdges: Set<string>;
  status: LoadingState;
  init: boolean;
  loading: boolean;
  entity?: SourceType;
  entityType?: EntityType;
  entityFqn: string;
  reactFlowInstance?: ReactFlowInstance;
  selectedQuickFilters: ExploreQuickFilterField[];
  timeFilter: LineageTimeRange;
  showAddEdgeModal: boolean;
  showDeleteModal: boolean;
  isDrawerOpen: boolean;
  newAddedNode?: Node;
  deletionState: { loading: boolean; status: LoadingState };

  // Actions
  setIsEditMode: (isEditMode: boolean) => void;
  toggleEditMode: () => void;
  setLineageConfig: (lineageConfig: LineageConfig) => void;
  setTracedColumns: (tracedColumns: Set<string>) => void;
  addTracedColumns: (newColumn: string) => void;
  setTracedNodes: (tracedNodes: Set<string>) => void;
  addTracedNodes: (newNode: string) => void;
  setZoomValue: (zoomValue: number) => void;
  setColumnsHavingLineage: (
    columnsHavingLineage: Map<string, Set<string>>
  ) => void;
  updateColumnsHavingLineageById: (id: string, columnFqns: Set<string>) => void;
  setActiveLayer: (activeLayer: LineageLayer[]) => void;
  updateActiveLayer: (layer: LineageLayer | LineageLayer[]) => void;
  setPlatformView: (platformView: LineagePlatformView) => void;
  setIsPlatformLineage: (isPlatformLineage: boolean) => void;
  setActiveNode: (activeNode?: Node) => void;
  setSelectedNode: (selectedNode?: SourceType) => void;
  setSelectedEdge: (selectedEdge?: Edge) => void;
  setSelectedColumn: (selectedColumn?: string) => void;
  setIsCreatingEdge: (isCreatingEdge: boolean) => void;
  setColumnsInCurrentPages: (
    columnsInCurrentPages: Map<string, string[]>
  ) => void;
  updateColumnsInCurrentPages: (nodeId: string, columnFqns: string[]) => void;
  setNodeFilterState: (nodeId: string, isVisible: boolean) => void;
  setIsRepositioning: (isRepositioning: boolean) => void;
  setIsCanvasReady: (isCanvasReady: boolean) => void;
  bumpLineageMutationTick: () => void;
  setSceneBand: (sceneBand?: LineageBand) => void;
  reset: () => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setColumnEdges: (edges: Edge[]) => void;
  applyNodesChange: (changes: NodeChange[]) => void;
  applyEdgesChange: (changes: EdgeChange[]) => void;
  redraw: () => void;
  resetGraph: () => void;
  beginLoad: () => void;
  setLineageData: (data: EntityLineageResponse) => void;
  setUpdatedEntityLineage: (data?: EntityLineageResponse) => void;
  setDQLineage: (data?: EntityLineageResponse) => void;
  setDQHighlightedEdges: (ids: Set<string>) => void;
  setLoadError: () => void;
  commitEdits: () => void;
  resetData: () => void;
  setEntityContext: (args: {
    entity?: SourceType;
    entityType?: EntityType;
    entityFqn: string;
  }) => void;
  setReactFlowInstance: (instance?: ReactFlowInstance) => void;
  setSelectedQuickFilters: (
    next:
      | ExploreQuickFilterField[]
      | ((prev: ExploreQuickFilterField[]) => ExploreQuickFilterField[])
  ) => void;
  setTimeFilter: (range: LineageTimeRange) => void;
  openAddEdgeModal: () => void;
  closeAddEdgeModal: () => void;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setNewAddedNode: (node?: Node) => void;
  setDeletionState: (next: { loading: boolean; status: LoadingState }) => void;
}

const defaultLineageSettings = {
  upstreamDepth: 3,
  downstreamDepth: 3,
  nodesPerLayer: 50,
  pipelineViewMode: PipelineViewMode.Node,
};

export const useLineageStore = create<LineageState>((set, get) => ({
  isEditMode: false,
  lineageConfig: defaultLineageSettings,
  tracedColumns: new Set(),
  tracedNodes: new Set(),
  zoomValue: ZOOM_VALUE,
  columnsHavingLineage: new Map<string, Set<string>>(),
  activeLayer: [],
  platformView: LineagePlatformView.None,
  isPlatformLineage: false,
  isColumnLevelLineage: false,
  isDQEnabled: false,
  isCreatingEdge: false,
  columnsInCurrentPages: new Map(),
  nodeFilterState: new Map(),
  isRepositioning: false,
  isCanvasReady: false,
  lineageMutationTick: 0,
  nodes: [],
  edges: [],
  columnEdges: [],
  entityLineage: {} as EntityLineageResponse,
  dqHighlightedEdges: new Set(),
  status: 'initial',
  init: false,
  loading: false,
  entity: undefined,
  entityType: undefined,
  entityFqn: '',
  reactFlowInstance: undefined,
  selectedQuickFilters: [],
  timeFilter: {},
  showAddEdgeModal: false,
  showDeleteModal: false,
  isDrawerOpen: false,
  newAddedNode: undefined,
  deletionState: { loading: false, status: 'initial' },

  // Actions
  setLineageConfig: (lineageConfig: LineageConfig) => set({ lineageConfig }),

  setIsEditMode: (isEditMode: boolean) => set({ isEditMode }),

  toggleEditMode: () => {
    const { isEditMode, isColumnLevelLineage, sceneBand } = get();
    const updatedEditMode = !isEditMode;

    if (
      updatedEditMode &&
      sceneBand === LineageBand.Field &&
      !isColumnLevelLineage
    ) {
      set({
        activeLayer: [LineageLayer.ColumnLevelLineage],
        isColumnLevelLineage: true,
      });
    }

    if (!updatedEditMode) {
      set({ tracedColumns: new Set(), tracedNodes: new Set() });
    }

    set({
      isEditMode: !isEditMode,
      activeNode: undefined,
      selectedNode: undefined,
      selectedEdge: undefined,
      selectedColumn: undefined,
    });
  },

  setTracedColumns: (tracedColumns: Set<string>) => set({ tracedColumns }),

  addTracedColumns: (newColumn: string) => {
    const { tracedColumns } = get();

    set({ tracedColumns: new Set([...tracedColumns, newColumn]) });
  },

  setTracedNodes: (tracedNodes: Set<string>) => set({ tracedNodes }),

  addTracedNodes: (newNode: string) => {
    const { tracedNodes } = get();

    set({ tracedNodes: new Set([...tracedNodes, newNode]) });
  },

  setZoomValue: (zoomValue: number) => set({ zoomValue }),

  setColumnsHavingLineage: (columnsHavingLineage: Map<string, Set<string>>) =>
    set({ columnsHavingLineage }),

  updateColumnsHavingLineageById: (id: string, columnFqns: Set<string>) => {
    set((state) => {
      const updated = new Map(state.columnsHavingLineage);
      updated.set(id, columnFqns);

      return { columnsHavingLineage: updated };
    });
  },

  setActiveLayer: (activeLayer: LineageLayer[]) => {
    const { tracedColumns } = get();
    if (
      !activeLayer.includes(LineageLayer.ColumnLevelLineage) &&
      tracedColumns.size > 0
    ) {
      set({ tracedColumns: new Set() });
    }

    if (
      activeLayer.includes(LineageLayer.ColumnLevelLineage) ||
      activeLayer.includes(LineageLayer.DataObservability)
    ) {
      set({ platformView: LineagePlatformView.None });
    }

    const isColumnLevelLineage = activeLayer.includes(
      LineageLayer.ColumnLevelLineage
    );

    set({
      activeLayer,
      isColumnLevelLineage,
      isDQEnabled: activeLayer.includes(LineageLayer.DataObservability),
    });
  },

  updateActiveLayer: (layer: LineageLayer | LineageLayer[]) => {
    const { activeLayer } = get();

    const consolidatedLayer = uniq([
      ...activeLayer,
      ...(Array.isArray(layer) ? layer : [layer]),
    ]);
    const isColumnLevelLineage = consolidatedLayer.includes(
      LineageLayer.ColumnLevelLineage
    );

    set({
      activeLayer: consolidatedLayer,
      isColumnLevelLineage: isColumnLevelLineage,
      isDQEnabled: consolidatedLayer.includes(LineageLayer.DataObservability),
    });
  },

  setPlatformView: (platformView: LineagePlatformView) => set({ platformView }),

  setIsPlatformLineage: (isPlatformLineage: boolean) =>
    set({ isPlatformLineage }),

  setActiveNode: (activeNode?: Node) => set({ activeNode }),

  setSelectedNode: (selectedNode?: SourceType) => set({ selectedNode }),

  setSelectedEdge: (selectedEdge?: Edge) => set({ selectedEdge }),

  setSelectedColumn: (selectedColumn?: string) => set({ selectedColumn }),
  setIsCreatingEdge: (isCreatingEdge: boolean) => set({ isCreatingEdge }),
  setColumnsInCurrentPages: (columnsInCurrentPages: Map<string, string[]>) =>
    set({ columnsInCurrentPages }),

  updateColumnsInCurrentPages: (nodeId: string, columnFqns: string[]) => {
    set((state) => {
      const updated = new Map(state.columnsInCurrentPages);
      updated.set(nodeId, columnFqns);

      return { columnsInCurrentPages: updated };
    });
  },

  setNodeFilterState: (nodeId: string, isVisible: boolean) => {
    set((state) => {
      const updated = new Map(state.nodeFilterState);
      updated.set(nodeId, isVisible);

      return { nodeFilterState: updated };
    });
  },

  setIsRepositioning: (isRepositioning: boolean) => set({ isRepositioning }),

  setIsCanvasReady: (isCanvasReady: boolean) => set({ isCanvasReady }),

  bumpLineageMutationTick: () =>
    set((state) => ({
      lineageMutationTick: state.lineageMutationTick + 1,
    })),

  setSceneBand: (sceneBand?: LineageBand) => set({ sceneBand }),

  reset: () =>
    set({
      isEditMode: false,
      lineageConfig: defaultLineageSettings,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      zoomValue: ZOOM_VALUE,
      activeLayer: [],
      platformView: LineagePlatformView.None,
      isPlatformLineage: false,
      columnsHavingLineage: new Map(),
      activeNode: undefined,
      selectedNode: undefined,
      selectedEdge: undefined,
      isColumnLevelLineage: false,
      isDQEnabled: false,
      selectedColumn: undefined,
      isCreatingEdge: false,
      columnsInCurrentPages: new Map(),
      nodeFilterState: new Map(),
      isRepositioning: false,
      isCanvasReady: false,
      lineageMutationTick: 0,
      sceneBand: undefined,
      nodes: [],
      edges: [],
      columnEdges: [],
      entityLineage: {} as EntityLineageResponse,
      updatedEntityLineage: undefined,
      dataQualityLineage: undefined,
      dqHighlightedEdges: new Set(),
      status: 'initial',
      init: false,
      loading: false,
      entity: undefined,
      entityType: undefined,
      entityFqn: '',
      reactFlowInstance: undefined,
      selectedQuickFilters: [],
      timeFilter: {},
      showAddEdgeModal: false,
      showDeleteModal: false,
      isDrawerOpen: false,
      newAddedNode: undefined,
      deletionState: { loading: false, status: 'initial' },
    }),

  setNodes: (nodes: Node[]) => set({ nodes }),

  setEdges: (edges: Edge[]) => set({ edges }),

  setColumnEdges: (columnEdges: Edge[]) => set({ columnEdges }),

  applyNodesChange: (changes: NodeChange[]) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  applyEdgesChange: (changes: EdgeChange[]) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  redraw: () =>
    set((state) => ({
      lineageMutationTick: state.lineageMutationTick + 1,
    })),

  resetGraph: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      columnEdges: [],
      lineageMutationTick: state.lineageMutationTick + 1,
    })),

  beginLoad: () => set({ loading: true, status: 'waiting' }),

  setLineageData: (data: EntityLineageResponse) =>
    set({
      entityLineage: data,
      loading: false,
      init: true,
      status: 'success',
    }),

  setUpdatedEntityLineage: (updatedEntityLineage?: EntityLineageResponse) =>
    set({ updatedEntityLineage }),

  setDQLineage: (dataQualityLineage?: EntityLineageResponse) =>
    set({ dataQualityLineage }),

  setDQHighlightedEdges: (dqHighlightedEdges: Set<string>) =>
    set({ dqHighlightedEdges }),

  setLoadError: () => set({ loading: false, status: 'initial' }),

  commitEdits: () =>
    set((state) => ({
      entityLineage: state.updatedEntityLineage ?? state.entityLineage,
      updatedEntityLineage: undefined,
    })),

  resetData: () =>
    set({
      entityLineage: {} as EntityLineageResponse,
      updatedEntityLineage: undefined,
      dataQualityLineage: undefined,
      dqHighlightedEdges: new Set(),
      status: 'initial',
      init: false,
      loading: false,
    }),

  setEntityContext: ({ entity, entityType, entityFqn }) =>
    set({ entity, entityType, entityFqn }),

  setReactFlowInstance: (reactFlowInstance?: ReactFlowInstance) =>
    set({ reactFlowInstance }),

  setSelectedQuickFilters: (next) =>
    set((s) => ({
      selectedQuickFilters:
        typeof next === 'function' ? next(s.selectedQuickFilters) : next,
    })),

  setTimeFilter: (timeFilter: LineageTimeRange) => set({ timeFilter }),

  openAddEdgeModal: () => set({ showAddEdgeModal: true }),

  closeAddEdgeModal: () => set({ showAddEdgeModal: false }),

  openDeleteModal: () => set({ showDeleteModal: true }),

  closeDeleteModal: () => set({ showDeleteModal: false }),

  openDrawer: () => set({ isDrawerOpen: true }),

  closeDrawer: () => set({ isDrawerOpen: false }),

  setNewAddedNode: (newAddedNode?: Node) => set({ newAddedNode }),

  setDeletionState: (deletionState: {
    loading: boolean;
    status: LoadingState;
  }) => set({ deletionState }),
}));

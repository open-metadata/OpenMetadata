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
import { LoadingState } from 'Models';
import { Edge, Node, OnLoadParams, ReactFlowInstance } from 'reactflow';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { LineagePlatformView } from '../../../context/LineageProvider/LineageProvider.interface';
import { LOADING_STATE } from '../../../enums/common.enum';
import { LineageLayer } from '../../../generated/settings/settings';
import { EntityLineage } from '../../../generated/type/entityLineage';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { LineageConfig } from '../Entity/EntityLineage/EntityLineage.interface';
import { EntityLineageResponse } from '../Lineage/Lineage.interface';

// Separate interfaces for different slices of state
interface LineageUIState {
  isDrawerOpen: boolean;
  loading: boolean;
  isEditMode: boolean;
  init: boolean;
  status: LoadingState;
  expandAllColumns: boolean;
  isPlatformLineage: boolean;
  zoomValue: number;
}

interface LineageDataState {
  nodes: Node[];
  edges: Edge[];
  rootEntity: SourceType;
  entityLineage: EntityLineageResponse;
  reactFlowInstance?: ReactFlowInstance;
  lineageConfig: LineageConfig;
  selectedNode: SourceType;
  loadMoreNode?: Node;
  selectedColumn: string;
  activeLayer: LineageLayer[];
  columnsHavingLineage: string[];
  platformView: LineagePlatformView;
  entityFqn: string;
  selectedQuickFilters: ExploreQuickFilterField[];
  dataQualityLineage?: EntityLineageResponse;
  dqHighlightedEdges?: Set<string>;
}

interface LineageTracingState {
  tracedNodes: Set<string>;
  tracedColumns: string[];
  tracingVersion: number;
}

interface LineageActions {
  // UI Actions
  setIsDrawerOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setIsEditMode: (editMode: boolean) => void;
  setInit: (init: boolean) => void;
  setStatus: (status: LoadingState) => void;
  setExpandAllColumns: (expand: boolean) => void;
  setIsPlatformLineage: (isPlatform: boolean) => void;
  setZoomValue: (zoom: number) => void;

  // Data Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setEntityLineage: (entityLineage: EntityLineageResponse) => void;
  setReactFlowInstance: (reactFlowInstance: OnLoadParams) => void;
  setLineageConfig: (lineageConfig: LineageConfig) => void;
  setLoadModeNode: (loadMoreNode: Node) => void;
  setSelectedNode: (selectedNode: SourceType) => void;
  setSelectedColumn: (selectedColumn: string) => void;
  setActiveLayer: (activeLayer: LineageLayer[]) => void;
  setColumnsHavingLineage: (columnsHavingLineage: string[]) => void;
  setPlatformView: (platformView: LineagePlatformView) => void;
  setEntityFqn: (entityFqn: string) => void;
  setSelectedQuickFilters: (
    selectedQuickFilters: ExploreQuickFilterField[]
  ) => void;
  setDataQualityLineage: (dataQualityLineage: EntityLineageResponse) => void;
  setDQHighlightedEdges: (dqHighlightedEdges: Edge[]) => void;

  // Tracing Actions
  setIsTraced: (isTraced: boolean) => void;
  setTracingPath: (tracingPath: string[]) => void;

  // React Flow Actions
  setRfInstance: (rfInstance: OnLoadParams) => void;

  // Batch Actions
  resetLineage: () => void;
}

type LineageState = LineageUIState &
  LineageDataState &
  LineageTracingState &
  LineageActions;

const initialUIState: LineageUIState = {
  isDrawerOpen: false,
  loading: true, // Keeping default loading to true to avoid flicker
  isEditMode: false,
  init: false,
  status: LOADING_STATE.INITIAL,
  expandAllColumns: false,
  isPlatformLineage: false,
  zoomValue: 1,
};

const initialDataState: LineageDataState = {
  nodes: [],
  edges: [],
  rootEntity: {} as SourceType,
  entityLineage: {} as EntityLineageResponse,
  reactFlowInstance: undefined,
  lineageConfig: {
    upstreamDepth: 2,
    downstreamDepth: 2,
    nodesPerLayer: 50,
  },
  selectedNode: {} as SourceType,
  loadMoreNode: undefined,
  selectedColumn: '',
  activeLayer: [LineageLayer.EntityLineage],
  columnsHavingLineage: [],
  platformView: LineagePlatformView.None,
  entityFqn: '',
  selectedQuickFilters: [],
  dataQualityLineage: undefined,
  dqHighlightedEdges: undefined,
};

const initialTracingState: LineageTracingState = {
  tracedNodes: new Set<string>(),
  tracedColumns: [],
  tracingVersion: 0,
};

type LineageStatus = LoadingState;

export const useLineageStore = create<LineageState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    ...initialUIState,
    ...initialDataState,
    ...initialTracingState,

    // UI Actions
    setIsDrawerOpen: (isDrawerOpen: boolean) => set(() => ({ isDrawerOpen })),

    setLoading: (loading: boolean) => set(() => ({ loading })),

    setIsEditMode: (isEditMode: boolean) => set(() => ({ isEditMode })),

    setInit: (init: boolean) => set(() => ({ init })),

    setStatus: (status: LineageStatus) => set(() => ({ status })),

    setExpandAllColumns: (expandAllColumns: boolean) =>
      set(() => ({ expandAllColumns })),

    setIsPlatformLineage: (isPlatformLineage: boolean) =>
      set(() => ({ isPlatformLineage })),

    setZoomValue: (zoomValue: number) => set(() => ({ zoomValue })),
    // Data Actions

    setNodes: (nodes: Node[]) => set(() => ({ nodes })),

    setEdges: (edges: Edge[]) => set(() => ({ edges })),

    setEntityLineage: (entityLineage: EntityLineage) =>
      set(() => ({ entityLineage })),

    setReactFlowInstance: (reactFlowInstance: OnLoadParams) =>
      set(() => ({ reactFlowInstance })),

    setLineageConfig: (lineageConfig: LineageConfig) =>
      set(() => ({ lineageConfig })),

    setSelectedNode: (selectedNode: SourceType) =>
      set(() => ({ selectedNode })),

    setSelectedColumn: (selectedColumn: string) =>
      set(() => ({ selectedColumn })),

    setActiveLayer: (activeLayer: LineageLayer[]) =>
      set(() => ({ activeLayer })),

    setColumnsHavingLineage: (columnsHavingLineage: string[]) =>
      set(() => ({ columnsHavingLineage })),

    setPlatformView: (platformView: LineagePlatformView) =>
      set(() => ({ platformView })),

    setEntityFqn: (entityFqn: string) => set(() => ({ entityFqn })),

    setSelectedQuickFilters: (selectedQuickFilters: QuickFilter[]) =>
      set(() => ({ selectedQuickFilters })),

    setDataQualityLineage: (dataQualityLineage: EntityLineage) =>
      set(() => ({ dataQualityLineage })),

    setDQHighlightedEdges: (dqHighlightedEdges: Edge[]) =>
      set(() => ({ dqHighlightedEdges })),

    setRootEntity: (rootEntity: SourceType) => set(() => ({ rootEntity })),

    setLoadModeNode: (loadMoreNode: Node) => set(() => ({ loadMoreNode })),

    // Tracing Actions
    setIsTraced: (isTraced: boolean) => set(() => ({ isTraced })),

    setTracingPath: (tracingPath: string[]) => set(() => ({ tracingPath })),

    // React Flow Actions
    setRfInstance: (rfInstance: OnLoadParams) =>
      set(() => ({ reactFlowInstance: rfInstance })),

    // Batch Actions
    resetLineage: () =>
      set(() => ({ ...initialDataState, ...initialTracingState })),
  }))
);

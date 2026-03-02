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
import { Edge, Node } from 'reactflow';
import { create } from 'zustand';
import { LineageConfig } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { ZOOM_VALUE } from '../constants/Lineage.constants';
import { LineagePlatformView } from '../context/LineageProvider/LineageProvider.interface';
import { LineageLayer, PipelineViewMode } from '../generated/settings/settings';

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
  reset: () => void;
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

  // Actions
  setLineageConfig: (lineageConfig: LineageConfig) => set({ lineageConfig }),

  setIsEditMode: (isEditMode: boolean) => set({ isEditMode }),

  toggleEditMode: () => {
    const { activeLayer, isEditMode, updateActiveLayer, setActiveLayer } =
      get();
    const updatedEditMode = !isEditMode;

    if (updatedEditMode) {
      updateActiveLayer(LineageLayer.ColumnLevelLineage);
    } else {
      setActiveLayer(
        activeLayer.filter((layer) => layer !== LineageLayer.ColumnLevelLineage)
      );
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
    }),
}));

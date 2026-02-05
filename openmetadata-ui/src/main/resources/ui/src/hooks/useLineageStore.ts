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
import { create } from 'zustand';
import { LineageConfig } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { ZOOM_VALUE } from '../constants/Lineage.constants';
import { LineagePlatformView } from '../context/LineageProvider/LineageProvider.interface';
import { LineageLayer, PipelineViewMode } from '../generated/settings/settings';

interface LineageState {
  // state properties
  isEditMode: boolean;
  lineageConfig: LineageConfig;
  tracedColumns: string[];
  tracedNodes: string[];
  zoomValue: number;
  columnsHavingLineage: Set<string>;
  expandAllColumns: boolean;
  activeLayer: LineageLayer[];
  platformView: LineagePlatformView;
  isPlatformLineage: boolean;

  // Actions
  setIsEditMode: (isEditMode: boolean) => void;
  setLineageConfig: (lineageConfig: LineageConfig) => void;
  setTracedColumns: (tracedColumns: string[]) => void;
  addTracedColumns: (newColumn: string) => void;
  setTracedNodes: (tracedNodes: string[]) => void;
  addTracedNodes: (newNode: string) => void;
  setZoomValue: (zoomValue: number) => void;
  setColumnsHavingLineage: (columnsHavingLineage: Set<string>) => void;
  setExpandAllColumns: (expandAllColumns: boolean) => void;
  toggleExpandAllColumns: () => void;
  setActiveLayer: (activeLayer: LineageLayer[]) => void;
  updateActiveLayer: (layer: LineageLayer | LineageLayer[]) => void;
  setPlatformView: (platformView: LineagePlatformView) => void;
  setIsPlatformLineage: (isPlatformLineage: boolean) => void;
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
  tracedColumns: [],
  tracedNodes: [],
  zoomValue: ZOOM_VALUE,
  columnsHavingLineage: new Set(),
  expandAllColumns: false,
  activeLayer: [],
  platformView: LineagePlatformView.None,
  isPlatformLineage: false,

  // Actions
  setLineageConfig: (lineageConfig: LineageConfig) => set({ lineageConfig }),

  setIsEditMode: (isEditMode: boolean) => set({ isEditMode }),

  setTracedColumns: (tracedColumns: string[]) => set({ tracedColumns }),

  addTracedColumns: (newColumn: string) => {
    const { tracedColumns } = get();

    set({ tracedColumns: [...tracedColumns, newColumn] });
  },

  setTracedNodes: (tracedNodes: string[]) => set({ tracedNodes }),

  addTracedNodes: (newNode: string) => {
    const { tracedNodes } = get();

    set({ tracedNodes: [...tracedNodes, newNode] });
  },

  setZoomValue: (zoomValue: number) => set({ zoomValue }),

  setColumnsHavingLineage: (columnsHavingLineage: Set<string>) =>
    set({ columnsHavingLineage }),

  setExpandAllColumns: (expandAllColumns: boolean) => set({ expandAllColumns }),

  toggleExpandAllColumns: () => {
    const { expandAllColumns } = get();
    set({ expandAllColumns: !expandAllColumns });
  },

  setActiveLayer: (activeLayer: LineageLayer[]) => {
    const { tracedColumns } = get();
    if (
      !activeLayer.includes(LineageLayer.ColumnLevelLineage) &&
      tracedColumns.length > 0
    ) {
      set({ tracedColumns: [] });
    }

    if (
      activeLayer.includes(LineageLayer.ColumnLevelLineage) ||
      activeLayer.includes(LineageLayer.DataObservability)
    ) {
      set({ platformView: LineagePlatformView.None });
    }

    set({ activeLayer });
  },

  updateActiveLayer: (layer: LineageLayer | LineageLayer[]) => {
    const { activeLayer } = get();
    set({
      activeLayer: uniq([
        ...activeLayer,
        ...(Array.isArray(layer) ? layer : [layer]),
      ]),
    });
  },

  setPlatformView: (platformView: LineagePlatformView) => set({ platformView }),

  setIsPlatformLineage: (isPlatformLineage: boolean) =>
    set({ isPlatformLineage }),

  reset: () =>
    set({
      isEditMode: false,
      lineageConfig: defaultLineageSettings,
      tracedColumns: [],
      zoomValue: ZOOM_VALUE,
      expandAllColumns: false,
      activeLayer: [],
      platformView: LineagePlatformView.None,
    }),
}));

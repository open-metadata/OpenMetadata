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
import { Node, ReactFlowInstance } from 'reactflow';
import { create } from 'zustand';
import {
  EdgeDetails,
  EntityLineageResponse,
  LineageData,
  LineageNode,
} from '../components/Lineage/Lineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { LineageLayer } from '../generated/configuration/lineageSettings';
import { EntityReference } from '../generated/entity/type';

export interface LineageContextType {
  // state
  //   selectedNode: string | null;
  edges: EdgeDetails[];
  loading: boolean;
  isEditMode: boolean;
  selectedNode: SourceType | null;
  reactFlowInstance: ReactFlowInstance | null;
  activeLayer: LineageLayer[];
  activeNode: Node | null;
  entityLineage: EntityLineageResponse;
  lineageData?: LineageData;
  dataQualityLineage?: EntityLineageResponse;

  // actions
  setSelectedNode: (id: SourceType | null) => void;
  setEdges: (edges: EdgeDetails[]) => void;
  setLoading: (v: boolean) => void;
  setIsEditMode: (v: boolean) => void;
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  setActiveLayer: (layers: LineageLayer[]) => void;
  setActiveNode: (node: Node | null) => void;
  setEntityLineage: (lineage: EntityLineageResponse) => void;
  setLineageData: (data: LineageData) => void;
  setDataQualityLineage: (lineage: EntityLineageResponse) => void;

  // helpers
  fetchLineage: (fqn: string) => Promise<void>;
  reset: () => void;
}

export const useLineageStore = create<LineageContextType>((set, get) => ({
  selectedNode: null,
  edges: [],
  entitiesByFQN: {},
  loading: false,
  isEditMode: false,
  reactFlowInstance: null,
  activeLayer: [],
  activeNode: null,
  entityLineage: {
    nodes: [],
    edges: [],
    entity: {} as EntityReference,
  },
  dataQualityLineage: undefined,
  lineageData: undefined,

  //   setSelectedNode: (id) => set({ selectedNode: id }),
  setEdges: (edges) => set({ edges }),
  setLoading: (v) => set({ loading: v }),
  setIsEditMode: (v) => set({ isEditMode: v }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setReactFlowInstance: (instance) => set({ reactFlowInstance: instance }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setActiveNode: (node) => set({ activeNode: node }),
  setEntityLineage: (lineage) => set({ entityLineage: lineage }),
  setLineageData: (data) => set({ lineageData: data }),
  setDataQualityLineage: (lineage) => set({ dataQualityLineage: lineage }),

  fetchLineage: async (fqn: string) => {
    // Basic fetch implementation - adapt endpoint and payload as needed.
    set({ loading: true });
    try {
      const res = await fetch(`/api/lineage?fqn=${encodeURIComponent(fqn)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch lineage: ${res.status}`);
      }
      const data = await res.json();

      // Expecting data shape: { edges: LineageEdge[], entities: LineageEntity[] }
      const edges: EdgeDetails[] = Array.isArray(data.edges) ? data.edges : [];
      const entitiesArr: LineageNode[] = Array.isArray(data.entities)
        ? data.entities
        : [];

      const entitiesByFQN: Record<string, LineageNode> = {};
      for (const e of entitiesArr) {
        if (e && e.fullyQualifiedName) {
          entitiesByFQN[e.fullyQualifiedName] = e;
        }
      }

      set({
        edges,
        loading: false,
      });
    } catch (err) {
      // keep simple error handling; caller can inspect store.loading or extend with error state
      // eslint-disable-next-line no-console
      console.error('fetchLineage error', err);
      set({ loading: false });
    }
  },

  reset: () =>
    set({
      selectedNode: null,
      edges: [],
      loading: false,
    }),
}));

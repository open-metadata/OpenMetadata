import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { SearchSourceAlias } from '../../interface/search.interface';
import { LineageNode } from '../Lineage/Lineage.interface';

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
export enum EImpactLevel {
  TableLevel = 'table',
  ColumnLevel = 'column',
}

export interface LineageNodeData {
  entity: SearchSourceAlias;
  nodeDepth?: number;
  paging?: {
    entityDownstreamCount?: number;
    entityUpstreamCount?: number;
  };
}

export interface LineageTableState {
  filterNodes: LineageNode[];
  loading: boolean;
  filterSelectionActive: boolean;
  searchValue: string;
  dialogVisible: boolean;
  impactLevel: EImpactLevel;
  upstreamColumnLineageNodes: LineageNode[];
  downstreamColumnLineageNodes: LineageNode[];
  lineageDirection: LineageDirection;
  lineagePagingInfo: LineagePagingInfo | null;
  nodeDepth?: number;
}

export type LineageTableAction =
  | { type: 'SET_FILTER_NODES'; payload: LineageNode[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FILTER_SELECTION_ACTIVE'; payload: boolean }
  | { type: 'SET_SEARCH_VALUE'; payload: string }
  | { type: 'SET_DIALOG_VISIBLE'; payload: boolean }
  | { type: 'SET_IMPACT_LEVEL'; payload: EImpactLevel }
  | { type: 'SET_UPSTREAM_COLUMN_LINEAGE_NODES'; payload: LineageNode[] }
  | { type: 'SET_DOWNSTREAM_COLUMN_LINEAGE_NODES'; payload: LineageNode[] }
  | {
      type: 'SET_COLUMN_LINEAGE_NODES';
      payload: { upstream: LineageNode[]; downstream: LineageNode[] };
    }
  | { type: 'SET_LINEAGE_DIRECTION'; payload: LineageDirection }
  | { type: 'RESET_FILTERS' }
  | { type: 'TOGGLE_FILTER_SELECTION' }
  | { type: 'SET_LINEAGE_PAGING_INFO'; payload: LineagePagingInfo | null }
  | { type: 'UPDATE_NODE_DEPTH'; payload: number };

export interface LineagePagingInfo {
  downstreamDepthInfo: { depth: number; entityCount: number }[];
  upstreamDepthInfo: { depth: number; entityCount: number }[];
  maxDownstreamDepth: number;
  maxUpstreamDepth: number;
  totalDownstreamEntities: number;
  totalUpstreamEntities: number;
}

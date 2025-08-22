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

import { LoadingState } from 'Models';
import { DragEvent, ReactNode } from 'react';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeProps,
  ReactFlowInstance,
} from 'reactflow';
import { CSVExportResponse } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { LineageConfig } from '../../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityLineageResponse } from '../../components/Lineage/Lineage.interface';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { LineageLayer } from '../../generated/settings/settings';

export interface LineageProviderV1Props {
  children: ReactNode;
}

export enum LineagePlatformView {
  None = 'None',
  Service = 'Service',
  Domain = 'Domain',
  DataProduct = 'DataProduct',
}

// Split context interfaces for better performance
export interface LineageDataContextType {
  nodes: Node[];
  edges: Edge[];
  entityLineage: EntityLineageResponse;
  lineageConfig: LineageConfig;
  tracedNodes: string[];
  tracedColumns: string[];
  columnsHavingLineage: string[];
  dataQualityLineage?: EntityLineageResponse;
  dqHighlightedEdges?: Set<string>;
}

export interface LineageUIContextType {
  isDrawerOpen: boolean;
  isEditMode: boolean;
  selectedNode: SourceType;
  selectedColumn: string;
  selectedEdge?: Edge;
  activeLayer: LineageLayer[];
  loading: boolean;
  init: boolean;
  status: LoadingState;
}

export interface LineageViewContextType {
  zoomValue: number;
  platformView: LineagePlatformView;
  expandAllColumns: boolean;
  isPlatformLineage: boolean;
  entityFqn: string;
  reactFlowInstance?: ReactFlowInstance;
}

export interface LineageActionsContextType {
  onInitReactFlow: (instance: ReactFlowInstance) => void;
  onPaneClick: () => void;
  onNodeClick: (node: Node) => void;
  onEdgeClick: (edge: Edge) => void;
  onColumnClick: (column: string) => void;
  onLineageEditClick: () => void;
  onZoomUpdate: (value: number) => void;
  onLineageConfigUpdate: (config: LineageConfig) => void;
  onQueryFilterUpdate: (query: string) => void;
  onDrawerClose: () => void;
  onNodeDrop: (event: DragEvent, bounds: DOMRect) => void;
  onNodeCollapse: (node: Node | NodeProps, direction: LineageDirection) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Edge | Connection) => void;
  onColumnEdgeRemove: () => void;
  onAddPipelineClick: () => void;
  onUpdateLayerView: (layers: LineageLayer[]) => void;
  onExportClick: () => void;
  onPlatformViewChange: (view: LineagePlatformView) => void;
  onCloseDrawer: () => void;
  toggleColumnView: () => void;
  loadChildNodesHandler: (
    node: SourceType,
    direction: LineageDirection
  ) => Promise<void>;
  fetchLineageData: (fqn: string, type: string, config: LineageConfig) => void;
  removeNodeHandler: (node: Node | NodeProps) => void;
  updateEntityData: (
    type: EntityType,
    entity?: SourceType,
    isPlatform?: boolean
  ) => void;
  updateEntityFqn: (fqn: string) => void;
  redraw: () => Promise<void>;
  exportLineageData: (_: string) => Promise<CSVExportResponse>;
}

// Reducer action types
export enum LineageActionType {
  SET_LOADING = 'SET_LOADING',
  SET_INIT = 'SET_INIT',
  SET_STATUS = 'SET_STATUS',
  SET_DRAWER_OPEN = 'SET_DRAWER_OPEN',
  SET_EDIT_MODE = 'SET_EDIT_MODE',
  SET_SELECTED_NODE = 'SET_SELECTED_NODE',
  SET_SELECTED_EDGE = 'SET_SELECTED_EDGE',
  SET_SELECTED_COLUMN = 'SET_SELECTED_COLUMN',
  SET_ACTIVE_LAYER = 'SET_ACTIVE_LAYER',
  SET_NODES = 'SET_NODES',
  SET_EDGES = 'SET_EDGES',
  SET_ENTITY_LINEAGE = 'SET_ENTITY_LINEAGE',
  SET_LINEAGE_CONFIG = 'SET_LINEAGE_CONFIG',
  SET_TRACED_NODES = 'SET_TRACED_NODES',
  SET_TRACED_COLUMNS = 'SET_TRACED_COLUMNS',
  SET_ZOOM_VALUE = 'SET_ZOOM_VALUE',
  SET_PLATFORM_VIEW = 'SET_PLATFORM_VIEW',
  SET_EXPAND_ALL_COLUMNS = 'SET_EXPAND_ALL_COLUMNS',
  SET_MODAL_STATE = 'SET_MODAL_STATE',
  SET_DELETION_STATE = 'SET_DELETION_STATE',
  BATCH_UPDATE = 'BATCH_UPDATE',
}

export type LineageAction =
  | { type: LineageActionType.SET_LOADING; payload: boolean }
  | { type: LineageActionType.SET_INIT; payload: boolean }
  | { type: LineageActionType.SET_STATUS; payload: LoadingState }
  | { type: LineageActionType.SET_DRAWER_OPEN; payload: boolean }
  | { type: LineageActionType.SET_EDIT_MODE; payload: boolean }
  | { type: LineageActionType.SET_SELECTED_NODE; payload: SourceType }
  | { type: LineageActionType.SET_SELECTED_EDGE; payload: Edge | undefined }
  | { type: LineageActionType.SET_SELECTED_COLUMN; payload: string }
  | { type: LineageActionType.SET_ACTIVE_LAYER; payload: LineageLayer[] }
  | { type: LineageActionType.SET_NODES; payload: Node[] }
  | { type: LineageActionType.SET_EDGES; payload: Edge[] }
  | {
      type: LineageActionType.SET_ENTITY_LINEAGE;
      payload: EntityLineageResponse;
    }
  | { type: LineageActionType.SET_LINEAGE_CONFIG; payload: LineageConfig }
  | { type: LineageActionType.SET_TRACED_NODES; payload: string[] }
  | { type: LineageActionType.SET_TRACED_COLUMNS; payload: string[] }
  | { type: LineageActionType.SET_ZOOM_VALUE; payload: number }
  | { type: LineageActionType.SET_PLATFORM_VIEW; payload: LineagePlatformView }
  | { type: LineageActionType.SET_EXPAND_ALL_COLUMNS; payload: boolean }
  | {
      type: LineageActionType.SET_MODAL_STATE;
      payload: { showDeleteModal?: boolean; showAddEdgeModal?: boolean };
    }
  | {
      type: LineageActionType.SET_DELETION_STATE;
      payload: { loading: boolean; status: LoadingState };
    }
  | { type: LineageActionType.BATCH_UPDATE; payload: Partial<LineageState> };

export interface LineageState {
  loading: boolean;
  init: boolean;
  status: LoadingState;
  isDrawerOpen: boolean;
  isEditMode: boolean;
  selectedNode: SourceType;
  selectedEdge?: Edge;
  selectedColumn: string;
  activeLayer: LineageLayer[];
  nodes: Node[];
  edges: Edge[];
  entityLineage: EntityLineageResponse;
  lineageConfig: LineageConfig;
  tracedNodes: string[];
  tracedColumns: string[];
  columnsHavingLineage: string[];
  zoomValue: number;
  platformView: LineagePlatformView;
  expandAllColumns: boolean;
  isPlatformLineage: boolean;
  entityFqn: string;
  showDeleteModal: boolean;
  showAddEdgeModal: boolean;
  deletionState: {
    loading: boolean;
    status: LoadingState;
  };
}

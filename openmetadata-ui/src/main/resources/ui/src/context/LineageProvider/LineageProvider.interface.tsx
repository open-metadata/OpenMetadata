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
import { LineageConfig } from '../../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityLineageResponse } from '../../components/Lineage/Lineage.interface';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { LineageLayer } from '../../generated/settings/settings';

export interface LineageProviderProps {
  children: ReactNode;
}

export enum LineagePlatformView {
  None = 'None',
  Service = 'Service',
  Domain = 'Domain',
  DataProduct = 'DataProduct',
}

export interface LineageContextType {
  reactFlowInstance?: ReactFlowInstance;
  dataQualityLineage?: EntityLineageResponse;
  nodes: Node[];
  edges: Edge[];
  tracedNodes: string[];
  columnsHavingLineage: string[];
  tracedColumns: string[];
  lineageConfig: LineageConfig;
  zoomValue: number;
  isDrawerOpen: boolean;
  loading: boolean;
  init: boolean;
  status: LoadingState;
  isEditMode: boolean;
  entityLineage: EntityLineageResponse;
  selectedNode: SourceType;
  selectedColumn: string;
  activeLayer: LineageLayer[];
  platformView: LineagePlatformView;
  expandAllColumns: boolean;
  isPlatformLineage: boolean;
  entityFqn: string;
  toggleColumnView: () => void;
  onInitReactFlow: (reactFlowInstance: ReactFlowInstance) => void;
  onPaneClick: () => void;
  onNodeClick: (node: Node) => void;
  onEdgeClick: (edge: Edge) => void;
  onColumnClick: (node: string) => void;
  onLineageEditClick: () => void;
  onZoomUpdate: (value: number) => void;
  onLineageConfigUpdate: (config: any) => void;
  onQueryFilterUpdate: (query: string) => void;
  onDrawerClose: () => void;
  onNodeDrop: (event: DragEvent, reactFlowBounds: DOMRect) => void;
  onNodeCollapse: (node: Node | NodeProps, direction: LineageDirection) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  loadChildNodesHandler: (
    node: SourceType,
    direction: LineageDirection
  ) => Promise<void>;
  fetchLineageData: (
    entityFqn: string,
    entityType: string,
    lineageConfig: LineageConfig
  ) => void;
  onExportClick: () => void;
  onPlatformViewChange: (view: LineagePlatformView) => void;
  removeNodeHandler: (node: Node | NodeProps) => void;
  onColumnEdgeRemove: () => void;
  onAddPipelineClick: () => void;
  onConnect: (connection: Edge | Connection) => void;
  updateEntityData: (
    entityType: EntityType,
    entity?: SourceType,
    isPlatformLineage?: boolean
  ) => void;
  onUpdateLayerView: (layers: LineageLayer[]) => void;
  redraw: () => Promise<void>;
  updateEntityFqn: (entityFqn: string) => void;
  dqHighlightedEdges?: Set<string>;
}

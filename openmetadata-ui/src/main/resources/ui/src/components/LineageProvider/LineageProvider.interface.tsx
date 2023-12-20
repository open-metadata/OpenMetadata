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
import { DragEvent } from 'react';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeProps,
  ReactFlowInstance,
} from 'reactflow';
import { EntityReference } from '../../generated/entity/type';
import {
  EdgeTypeEnum,
  LineageConfig,
} from '../Entity/EntityLineage/EntityLineage.interface';
import { EntityLineageReponse } from '../Lineage/Lineage.interface';
import { SourceType } from '../SearchedData/SearchedData.interface';

export interface LineageContextType {
  reactFlowInstance?: ReactFlowInstance;
  nodes: Node[];
  edges: Edge[];
  expandedNodes: string[];
  tracedNodes: string[];
  tracedColumns: string[];
  lineageConfig: LineageConfig;
  zoomValue: number;
  isDrawerOpen: boolean;
  loading: boolean;
  status: LoadingState;
  isEditMode: boolean;
  entityLineage: EntityLineageReponse;
  selectedNode: SourceType;
  selectedColumn: string;
  expandAllColumns: boolean;
  onInitReactFlow: (reactFlowInstance: ReactFlowInstance) => void;
  onPaneClick: () => void;
  onNodeClick: (node: Node) => void;
  onEdgeClick: (edge: Edge) => void;
  onColumnClick: (node: string) => void;
  onLineageEditClick: () => void;
  onZoomUpdate: (value: number) => void;
  onEntityFqnUpdate: (value: string) => void;
  onLineageConfigUpdate: (config: any) => void;
  onQueryFilterUpdate: (query: string) => void;
  onDrawerClose: () => void;
  onNodeDrop: (event: DragEvent, reactFlowBounds: DOMRect) => void;
  onNodeCollapse: (node: Node | NodeProps, direction: EdgeTypeEnum) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  toggleColumnView: () => void;
  loadChildNodesHandler: (
    node: EntityReference,
    direction: EdgeTypeEnum
  ) => Promise<void>;
  fetchLineageData: (entityFqn: string, lineageConfig: LineageConfig) => void;
  removeNodeHandler: (node: Node | NodeProps) => void;
  onColumnEdgeRemove: () => void;
  onAddPipelineClick: () => void;
  onConnect: (connection: Edge | Connection) => void;
}

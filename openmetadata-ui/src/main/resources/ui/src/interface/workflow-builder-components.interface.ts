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

import React from 'react';
import {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from 'reactflow';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { WorkflowDefinition } from '../generated/governance/workflows/workflowDefinition';

export interface DataAssetFilter {
  id: number;
  dataAsset: string;
  filters?: string;
}

export interface NodeConfig {
  name: string;
  description: string;
  dataAssets: string[];
  triggerType: string;
  eventType: string[];
  dataAssetFilters: DataAssetFilter[];
  excludeFields?: string[];
  include?: string[];
  periodicFilters?: Record<string, string>;
  triggerFilter?: string;
  scheduleType?: string;
  cronExpression?: string;
  batchSize?: number;
}

export interface DataAssetFiltersSectionProps {
  dataAssetFilters: DataAssetFilter[];
  dataAssets: string[];
  /** OSS: lock filters when only include/exclude may be edited on the trigger */
  lockFields?: boolean;
  onAddDataAssetFilter: (dataAsset?: string) => void;
  onUpdateDataAssetFilter: (dataAssetId: number, value: string) => void;
  onRemoveDataAssetFilter: (filterId: number) => void;
}

export interface TriggerConfigSectionProps {
  triggerType: string;
  eventType: string[];
  availableEventTypes: string[];
  onTriggerTypeChange: (value: string) => void;
  onEventTypeChange: (event: { target: { value: string[] } }) => void;
  onRemoveEventType: (eventTypeToRemove: string) => void;
  excludeFields?: string[];
  availableExcludeFields?: string[];
  onExcludeFieldsChange?: (excludeFields: string[]) => void;
  onRemoveExcludeField?: (fieldToRemove: string) => void;
  include?: string[];
  onIncludeChange?: (include: string[]) => void;
  onRemoveInclude?: (fieldToRemove: string) => void;
  scheduleType?: string;
  cronExpression?: string;
  batchSize?: number;
  onScheduleTypeChange?: (scheduleType: string) => void;
  onCronExpressionChange?: (cron: string) => void;
  onBatchSizeChange?: (batchSize: number) => void;
  lockNonIncludeExcludeFields?: boolean;
  lockPeriodicBatchFields?: boolean;
  /** OSS: disable only the schedule-type select; cron and batch size remain editable */
  lockScheduleTypeField?: boolean;
}

export interface MetadataFormSectionProps {
  name: string;
  description: string;
  isStartNode: boolean;
  lockFields?: boolean;
  lockDescriptionField?: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export interface DataAssetFormSectionProps {
  dataAssets: string[];
  availableDataAssets: string[];
  /** OSS: lock when only include/exclude may be edited */
  lockFields?: boolean;
  onDataAssetsChange: (dataAssets: string[]) => void;
  onRemoveDataAsset: (assetToRemove: string) => void;
}

export interface WorkflowMetadata {
  displayName: string;
  description: string;
  triggerType?: string;
  name?: string;
  createdAt?: string;
  id?: string;
  [key: string]: unknown;
}

export interface WorkflowTriggerConfig {
  entityTypes?: string[];
  events?: string[];
  exclude?: string[];
  filter?: string | Record<string, unknown>;
  filters?: Record<string, string>;
  dataAssetFilters?: DataAssetFilter[];
  schedule?: {
    scheduleTimeline?: string;
    cronExpression?: string;
  };
  batchSize?: number;
  triggerType?: string;
  [key: string]: unknown;
}

export interface WorkflowState {
  nodes: Record<string, WorkflowNodeState>;
  connections: Record<string, WorkflowConnectionState>;
  globalConfig: Record<string, unknown>;
}

export interface WorkflowNodeState {
  id: string;
  type?: string;
  config: Record<string, unknown>;
  timestamp: string;
}

export interface WorkflowConnectionState {
  hasFilters: boolean;
  filterCount: number;
  conditions: Array<{
    dataAsset: string;
    filterCount: number;
  }>;
  lastUpdated: string;
}

export interface BackendNodeConfig {
  rules: string;
  ruleTemplate: string;
  fieldName: string;
  fieldValue: string;
  qualityBands: Array<{
    name: string;
    minimumScore: number;
  }>;
  fieldsToCheck: string[];
  approvalThreshold: number;
  rejectionThreshold: number;
}

export interface UseWorkflowActionsProps {
  nodes: Node[];
  edges: Edge[];
  workflowDefinition: WorkflowDefinition | null;
  workflowMetadata: {
    name: string;
    displayName: string;
    description: string;
    createdAt?: string;
    isNewWorkflow?: boolean;
    id?: string;
  } | null;
  setWorkflowDefinition: (definition: WorkflowDefinition | null) => void;
  setWorkflowMetadata: (
    metadata: {
      name: string;
      displayName: string;
      description: string;
      createdAt?: string;
      isNewWorkflow?: boolean;
      id?: string;
    } | null
  ) => void;
  editingEdge: Edge | null;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setSelectedNode: (node: Node | null) => void;
  setIsConfigSidebarOpen: (open: boolean) => void;
  setIsWorkflowFormDrawerOpen: (open: boolean) => void;
  setIsConnectionModalOpen: (open: boolean) => void;
  setPendingConnection: (connection: Connection | null) => void;
  setFocusedConnection: (
    connection: { sourceId: string; targetId: string } | null
  ) => void;
  setEditingEdge: (edge: Edge | null) => void;
  setModalPosition: (position: { x: number; y: number } | undefined) => void;
  syncWithStore: () => void;
  isNodeDragEnabled?: (nodeType: string) => boolean;
}

export interface UseWorkflowEffectsProps {
  fqn?: string;
  storeWorkflowDefinition: WorkflowDefinition | null;
  storeNodes: Node[];
  storeEdges: Edge[];
  isWorkflowFormDrawerOpen: boolean;
  setWorkflowDefinition: (def: WorkflowDefinition | null) => void;
  setLoading: (loading: boolean) => void;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setSelectedNode: (node: Node | null) => void;
  syncWithStore: () => void;
}

export interface ConnectionCondition {
  id: string;
  type: 'simple' | 'complex';
  field?: string;
  operator: string;
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

export interface ConnectionConditionModalProps {
  isOpen: boolean;
  connection: Connection | null;
  sourceNode?: Node | null;
  sourceNodeLabel: string;
  targetNodeLabel: string;
  position?: { x: number; y: number };
  initialConditions?: ConnectionCondition[] | null;
  onSave: (connection: Connection, conditions: ConnectionCondition[]) => void;
  onCancel: () => void;
}

export interface CustomControlsProps {
  onUndo?: () => void;
  onRedo?: () => void;
  onRearrange?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isViewMode?: boolean;
  allowStructuralGraphEdits?: boolean;
}

export interface EmptyCanvasMessageProps {
  isDragging: boolean;
  hasNodes: boolean;
}

export interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onEdgeDelete: (edgeId: string) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragEnter: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  focusedConnection?: { sourceId: string; targetId: string } | null;
  isDragging: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onRearrange?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isNodeDragEnabled?: (nodeType: string) => boolean;
  isConnectionModalOpen?: boolean;
  pendingConnection?: Connection | null;
}

export interface WorkflowControlsProps {
  onTestWorkflow?: () => void;
  onSaveWorkflow?: () => void;
  onCancelWorkflow?: () => void;
  onRevertAndCancel?: () => void;
  onRunWorkflow?: () => void;
  onDeleteWorkflow?: () => void;
  isRunLoading?: boolean;
}

export interface WorkflowHeaderProps {
  title: string;
  workflowName?: string;
  children?: React.ReactNode;
  handleTestWorkflow: () => void;
  handleSaveWorkflow: () => void;
  handleDeleteWorkflow?: () => void;
  handleRevertAndCancel?: () => void;
  handleRunWorkflow?: () => void;
  isRunLoading?: boolean;
  focusedConnection?: { sourceId: string; targetId: string } | null;
  onUpdateDisplayName?: (displayName: string) => void;
}

export interface TaskItemProps {
  icon: React.ReactNode;
  label: string;
  type: NodeSubType;
  onDragStart: (
    event: React.DragEvent,
    subType: NodeSubType,
    label: string
  ) => void;
  disabled?: boolean;
  isBeta?: boolean;
}

export interface NodeConfigSidebarProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  workflowDefinition: WorkflowDefinition | null;
  workflowMetadata?: WorkflowMetadata;
  onWorkflowMetadataUpdate?: (metadata: WorkflowMetadata) => void;
  onWorkflowUpdate: (workflowDefinition: WorkflowDefinition) => void;
  setNodes?: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges?: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
}

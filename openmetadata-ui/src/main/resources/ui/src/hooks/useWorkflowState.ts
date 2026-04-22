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

import { SelectChangeEvent } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Connection, Edge, Node } from 'reactflow';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import { WorkflowDefinition } from '../generated/governance/workflows/workflowDefinition';
import {
  DataAssetFilter,
  NodeConfig,
} from '../interface/workflow-builder-components.interface';

export interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  workflowDefinition: WorkflowDefinition | null;
  selectedNode: Node | null;
  isConfigSidebarOpen: boolean;
  isWorkflowFormDrawerOpen: boolean;
  loading: boolean;
  isDragging: boolean;
  pendingConnection: Connection | null;
  isConnectionModalOpen: boolean;
  modalPosition: { x: number; y: number } | undefined;
  focusedConnection: { sourceId: string; targetId: string } | null;
  editingEdge: Edge | null;
  config: NodeConfig;
  hasStartNode: boolean;
  isStartNodeConfigured: boolean;
  workflowMetadata?: {
    name: string;
    displayName: string;
    description: string;
    createdAt?: string;
    isNewWorkflow?: boolean;
    id?: string;
  } | null;
}

interface UseWorkflowStateProps {
  initialConfig?: Partial<NodeConfig>;
  fqn?: string;
}

export const useWorkflowState = ({
  initialConfig,
  fqn,
}: UseWorkflowStateProps = {}) => {
  const defaultConfig: NodeConfig = {
    name: '',
    description: '',
    dataAssets: [],
    triggerType: 'eventBasedEntity',
    eventType: ['Created', 'Updated'],
    excludeFields: [],
    include: [],
    triggerFilter: '',
    scheduleType: '',
    cronExpression: '',
    batchSize: 100,
    dataAssetFilters: [],
    ...initialConfig,
  };

  const [state, setState] = useState<WorkflowState>({
    nodes: [],
    edges: [],
    workflowDefinition: null,
    selectedNode: null,
    isConfigSidebarOpen: false,
    isWorkflowFormDrawerOpen: false,
    loading: false,
    isDragging: false,
    pendingConnection: null,
    isConnectionModalOpen: false,
    modalPosition: undefined,
    focusedConnection: null,
    editingEdge: null,
    config: defaultConfig,
    hasStartNode: false,
    isStartNodeConfigured: false,
    workflowMetadata: null,
  });

  const updateState = useCallback(
    <K extends keyof WorkflowState>(
      key: K,
      value: WorkflowState[K] | ((prev: WorkflowState[K]) => WorkflowState[K])
    ) => {
      setState((prev) => ({
        ...prev,
        [key]: typeof value === 'function' ? value(prev[key]) : value,
      }));
    },
    []
  );

  const updateMultipleState = useCallback((updates: Partial<WorkflowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateConfig = useCallback(
    <K extends keyof NodeConfig>(key: K, value: NodeConfig[K]) => {
      setState((prev) => ({
        ...prev,
        config: { ...prev.config, [key]: value },
      }));
    },
    []
  );

  const updateWorkflowDefinition = useCallback(
    (updates: Record<string, unknown>) => {
      setState((prev) => ({
        ...prev,
        workflowDefinition: prev.workflowDefinition
          ? { ...prev.workflowDefinition, ...updates }
          : null,
      }));
    },
    []
  );

  const updateWorkflowDefinitionWithMerge = useCallback(
    (updates: Partial<WorkflowDefinition>) => {
      setState((prev) => {
        if (!prev.workflowDefinition) {
          return prev;
        }

        // Deep merge the updates with existing workflow definition
        const updatedDefinition = {
          ...prev.workflowDefinition,
          ...updates,
          trigger: updates.trigger
            ? {
                ...(prev.workflowDefinition.trigger &&
                typeof prev.workflowDefinition.trigger === 'object'
                  ? prev.workflowDefinition.trigger
                  : {}),
                ...(updates.trigger && typeof updates.trigger === 'object'
                  ? updates.trigger
                  : {}),
                config: {
                  ...(prev.workflowDefinition.trigger &&
                  typeof prev.workflowDefinition.trigger === 'object' &&
                  'config' in prev.workflowDefinition.trigger
                    ? prev.workflowDefinition.trigger.config
                    : {}),
                  ...(updates.trigger &&
                  typeof updates.trigger === 'object' &&
                  'config' in updates.trigger
                    ? updates.trigger.config
                    : {}),
                },
              }
            : prev.workflowDefinition.trigger,
        };

        return {
          ...prev,
          workflowDefinition: updatedDefinition,
        };
      });
    },
    []
  );

  const updateDataAssetFilters = useCallback(
    (updater: (filters: DataAssetFilter[]) => DataAssetFilter[]) => {
      setState((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          dataAssetFilters: updater(prev.config.dataAssetFilters),
        },
      }));
    },
    []
  );

  const addDataAssetFilter = useCallback(
    (dataAsset?: string) => {
      const existingDataAssets = state.config.dataAssetFilters.map(
        (df) => df.dataAsset
      );
      const availableDataAssets = state.config.dataAssets.filter(
        (asset) => !existingDataAssets.includes(asset)
      );

      if (availableDataAssets.length === 0) {
        return;
      }

      const targetDataAsset =
        dataAsset && availableDataAssets.includes(dataAsset)
          ? dataAsset
          : availableDataAssets[0];

      const newId =
        state.config.dataAssetFilters.length > 0
          ? Math.max(...state.config.dataAssetFilters.map((df) => df.id)) + 1
          : 1;

      updateDataAssetFilters((filters) => [
        ...filters,
        {
          id: newId,
          dataAsset: targetDataAsset,
        },
      ]);
    },
    [
      state.config.dataAssetFilters,
      state.config.dataAssets,
      updateDataAssetFilters,
    ]
  );

  const removeFromConfigArray = useCallback(
    <K extends keyof NodeConfig>(key: K, itemToRemove: string) => {
      setState((prev) => {
        const updatedArray = (prev.config[key] as string[]).filter(
          (item) => item !== itemToRemove
        );

        return {
          ...prev,
          config: { ...prev.config, [key]: updatedArray },
        };
      });
    },
    []
  );

  const handleEventTypeChange = useCallback(
    (event: SelectChangeEvent<string[]>) => {
      const value = event.target.value;
      const newEventTypes =
        typeof value === 'string' ? value.split(',') : value;
      updateConfig('eventType', newEventTypes);
    },
    [updateConfig]
  );

  const derivedState = {
    hasNodes: state.nodes.length > 0,
    hasEdges: state.edges.length > 0,
    isNewWorkflow: !fqn || state.workflowMetadata?.isNewWorkflow,
    canSave: state.hasStartNode && state.isStartNodeConfigured,
  };

  useEffect(() => {
    const startNode = state.nodes.find(
      (node) => node.type === NodeType.StartEvent
    );
    const hasStart = !!startNode;
    const isConfigured =
      hasStart &&
      Boolean(
        startNode.data?.lastSaved ||
          startNode.data?.userModified ||
          (startNode.data?.name && startNode.data?.dataAssets?.length > 0) ||
          // If start node exists and has any configuration data, consider it configured
          startNode.data?.triggerType ||
          startNode.data?.eventType ||
          startNode.data?.scheduleType ||
          startNode.data?.input ||
          startNode.data?.output
      );

    if (
      state.hasStartNode !== hasStart ||
      state.isStartNodeConfigured !== isConfigured
    ) {
      updateMultipleState({
        hasStartNode: hasStart,
        isStartNodeConfigured: isConfigured,
      });
    }
  }, [state.nodes, state.hasStartNode, state.isStartNodeConfigured]);

  return {
    ...state,
    ...derivedState,
    updateState,
    updateMultipleState,
    updateConfig,
    updateWorkflowDefinition,
    updateWorkflowDefinitionWithMerge,
    updateDataAssetFilters,
    addDataAssetFilter,
    removeFromConfigArray,
    handleEventTypeChange,
    setNodes: (value: Node[] | ((prev: Node[]) => Node[])) =>
      updateState('nodes', value),
    setEdges: (value: Edge[] | ((prev: Edge[]) => Edge[])) =>
      updateState('edges', value),
    setSelectedNode: (value: Node | null) => updateState('selectedNode', value),
    setIsConfigSidebarOpen: (value: boolean) =>
      updateState('isConfigSidebarOpen', value),
    setIsWorkflowFormDrawerOpen: (value: boolean) =>
      updateState('isWorkflowFormDrawerOpen', value),
    setLoading: (value: boolean) => updateState('loading', value),
    setWorkflowDefinition: (value: WorkflowDefinition | null) =>
      updateState('workflowDefinition', value),
    setWorkflowMetadata: (value: WorkflowState['workflowMetadata']) =>
      updateState('workflowMetadata', value),
    setPendingConnection: (value: Connection | null) =>
      updateState('pendingConnection', value),
    setIsConnectionModalOpen: (value: boolean) =>
      updateState('isConnectionModalOpen', value),
    setModalPosition: (value: { x: number; y: number } | undefined) =>
      updateState('modalPosition', value),
    setFocusedConnection: (
      value: { sourceId: string; targetId: string } | null
    ) => updateState('focusedConnection', value),
    setEditingEdge: (value: Edge | null) => updateState('editingEdge', value),
    setIsDragging: (value: boolean) => updateState('isDragging', value),
  };
};

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

import axios, { AxiosError } from 'axios';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../contexts/WorkflowModeContext';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { UseWorkflowActionsProps } from '../interface/workflow-builder-components.interface';
import {
  deleteWorkflowByFQN,
  updateWorkflowDefinition,
} from '../rest/workflowDefinitionsAPI';
import {
  buildWorkflowForSave,
  testWorkflow,
} from '../services/WorkflowValidationService';
import { shouldShowForm, shouldUseConfigSidebar } from '../utils/NodeUtils';
import { showErrorToast, showSuccessToast } from '../utils/ToastUtils';
import { getWorkflowDefinitionsListPath } from '../utils/WorkflowRouterUtils';
import { useWorkflowEdgeManagement } from './useWorkflowEdgeManagement';

export const useWorkflowActions = ({
  nodes,
  edges,
  workflowDefinition,
  workflowMetadata,
  setWorkflowDefinition,
  setWorkflowMetadata,
  editingEdge,
  setNodes,
  setEdges,
  setSelectedNode,
  setIsConfigSidebarOpen,
  setIsWorkflowFormDrawerOpen,
  setIsConnectionModalOpen,
  setPendingConnection,
  setFocusedConnection,
  setEditingEdge,
  setModalPosition,
  syncWithStore,
}: UseWorkflowActionsProps) => {
  const { isViewMode, enterViewMode } = useWorkflowModeContext();
  const navigate = useNavigate();

  const edgeManagement = useWorkflowEdgeManagement({
    nodes,
    edges,
    setEdges,
    editingEdge,
    setEditingEdge,
    setIsConnectionModalOpen,
    setPendingConnection,
    setFocusedConnection,
    setModalPosition,
    isViewMode,
  });

  // Node configuration save handler
  const handleNodeConfigSave = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      // Check if this is a Data Completeness node being updated
      const isDataCompletenessUpdate =
        config.subType === NodeSubType.DataCompletenessTask &&
        config.qualityBands;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...config,
                lastSaved: new Date().toISOString(),
              },
            };
          }

          return node;
        })
      );

      if (isDataCompletenessUpdate) {
        edgeManagement.fixInvalidEdgeConditions(
          nodeId,
          config.qualityBands as unknown[]
        );
      }

      setSelectedNode(null);
      setIsConfigSidebarOpen(false);
    },
    [setNodes, setSelectedNode, setIsConfigSidebarOpen, edgeManagement]
  );

  // Config sidebar close handler
  const handleConfigSidebarClose = useCallback(() => {
    setIsConfigSidebarOpen(false);
    setSelectedNode(null);
  }, [setIsConfigSidebarOpen, setSelectedNode]);

  // Workflow form drawer close handler
  const handleWorkflowFormDrawerClose = useCallback(() => {
    setIsWorkflowFormDrawerOpen(false);
  }, [setIsWorkflowFormDrawerOpen]);

  // Test workflow handler
  const handleTestWorkflow = useCallback(async () => {
    try {
      return await testWorkflow(
        nodes,
        edges,
        workflowDefinition,
        workflowMetadata
      );
    } catch {
      // testWorkflow / buildWorkflowForSave already show a toast on validation failure
    }
  }, [nodes, edges, workflowDefinition, workflowMetadata]);

  // Node click handler
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      setSelectedNode(node);

      const nodeType = node.type || '';

      if (!shouldShowForm(nodeType)) {
        setIsConfigSidebarOpen(false);
        setIsWorkflowFormDrawerOpen(false);

        return;
      }

      if (shouldUseConfigSidebar(nodeType)) {
        setIsConfigSidebarOpen(true);
        setIsWorkflowFormDrawerOpen(false);
      } else {
        syncWithStore();
        setIsWorkflowFormDrawerOpen(true);
        setIsConfigSidebarOpen(false);
      }
    },
    [
      setSelectedNode,
      setIsConfigSidebarOpen,
      setIsWorkflowFormDrawerOpen,
      syncWithStore,
    ]
  );

  const handleSaveWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      if (!workflowDefinition || !workflowMetadata) {
        showErrorToast('Workflow data is missing');

        return false;
      }

      const workflowData = await buildWorkflowForSave(
        nodes,
        edges,
        workflowDefinition,
        workflowMetadata
      );

      const savedWorkflow = await updateWorkflowDefinition(workflowData);
      showSuccessToast('Workflow saved successfully!');

      setWorkflowDefinition(savedWorkflow);
      setWorkflowMetadata({
        ...workflowMetadata,
        name: savedWorkflow.name,
        displayName: savedWorkflow.displayName || '',
        description: savedWorkflow.description,
        id: savedWorkflow.id,
        isNewWorkflow: false,
      });

      enterViewMode();

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showErrorToast(error);
      } else if (error instanceof Error) {
        showErrorToast(error.message);
      } else {
        showErrorToast(String(error));
      }

      return false;
    }
  }, [
    workflowDefinition,
    workflowMetadata,
    nodes,
    edges,
    setWorkflowDefinition,
    setWorkflowMetadata,
    enterViewMode,
  ]);

  const handleWorkflowMetadataUpdate = useCallback(
    (metadata: {
      displayName: string;
      description: string;
      triggerType?: string;
    }) => {
      setWorkflowMetadata({
        ...workflowMetadata,
        name: workflowMetadata?.name || '',
        displayName: metadata.displayName,
        description: metadata.description,
        ...(metadata.triggerType && {
          triggerType: metadata.triggerType,
        }),
      });
    },
    [setWorkflowMetadata]
  );

  const performDeleteWorkflow = useCallback(async () => {
    if (!workflowMetadata?.name) {
      showErrorToast('Workflow name is required for deletion');

      return;
    }

    try {
      await deleteWorkflowByFQN(workflowMetadata.name, true);
      showSuccessToast('Workflow deleted successfully');

      navigate(getWorkflowDefinitionsListPath());
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [workflowMetadata?.name, navigate]);

  return {
    handleNodeConfigSave,
    handleConfigSidebarClose,
    handleWorkflowFormDrawerClose,
    handleTestWorkflow,
    handleNodeClick,
    handleSaveWorkflow,
    performDeleteWorkflow,
    handleConnectionSave: edgeManagement.handleConnectionSave,
    handleConnectionCancel: edgeManagement.handleConnectionCancel,
    handleEdgeClick: edgeManagement.handleEdgeClick,
    handleEdgeDelete: edgeManagement.handleEdgeDelete,
    handleWorkflowMetadataUpdate,
    fixMissingEdgeLabels: edgeManagement.fixMissingEdgeLabels,
    fixInvalidEdgeConditions: edgeManagement.fixInvalidEdgeConditions,
  };
};

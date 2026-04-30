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

import { Card, Tabs } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { Edge, Node, ReactFlowProvider } from 'reactflow';
import DeleteModalMUI from '../../../components/common/DeleteModal/DeleteModalMUI';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { UnsavedChangesModal } from '../../../components/Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import {
  ConnectionConditionModal,
  WorkflowCanvas,
  WorkflowExecutionHistory,
  WorkflowHeader,
  WorkflowSidebar,
} from '../../../components/WorkflowDefinitions/WorkflowBuilder';
import { NodeFormSidebar } from '../../../components/WorkflowDefinitions/WorkflowBuilder/NodeFormSidebar';
import type { WorkflowBuilderTab } from '../../../constants/WorkflowBuilder.constants';
import {
  getWorkflowBuilderTabs,
  tabTestIds,
} from '../../../constants/WorkflowBuilder.constants';
import {
  useWorkflowModeContext,
  WorkflowModeProvider,
} from '../../../contexts/WorkflowModeContext';
import { NodeType } from '../../../generated/governance/workflows/elements/nodeType';
import { useFqn } from '../../../hooks/useFqn';
import { useWorkflowActions } from '../../../hooks/useWorkflowActions';
import { useWorkflowHistory } from '../../../hooks/useWorkflowHistory';
import {
  useWorkflowLogic,
  UseWorkflowLogicReturn,
} from '../../../hooks/useWorkflowLogic';
import { useWorkflowNavigationBlock } from '../../../hooks/useWorkflowNavigationBlock';
import {
  patchWorkflowDefinition,
  triggerWorkflow,
} from '../../../rest/workflowDefinitionsAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import workflowClassBase from '../../../utils/WorkflowClassBase';
import { applyFlowchartLayout } from '../../../utils/WorkflowLayout';
import { getWorkflowDefinitionsListPath } from '../../../utils/WorkflowRouterUtils';

interface WorkflowBuilderInternalProps {
  workflowLogic: UseWorkflowLogicReturn;
}

const WorkflowBuilderInternal: React.FC<WorkflowBuilderInternalProps> = ({
  workflowLogic,
}) => {
  const { t } = useTranslation();
  const {
    canAccessSidebar,
    canDragNodes,
    enterViewMode,
    isEditMode,
    showWorkflowNodePalette,
  } = useWorkflowModeContext();

  const {
    edges,
    editingEdge,
    focusedConnection,
    isConfigSidebarOpen,
    isConnectionModalOpen,
    isDragging,
    loading,
    modalPosition,
    nodes,
    onConnect,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    onEdgesChange,
    onNodesChange,
    pendingConnection,
    selectedNode,
    setEdges,
    setNodes,
    workflowDefinition,
    workflowMetadata,
    isNodeDragEnabled,
  } = workflowLogic;

  const syncWithStore = workflowLogic.syncWithStore;
  const { canRedo, canUndo, redo, saveState, undo } = useWorkflowHistory();
  const workflowBuilderTabs = useMemo(() => getWorkflowBuilderTabs(t), [t]);

  const sourceNode = useMemo(() => {
    if (!pendingConnection) {
      return null;
    }

    return nodes.find((n: Node) => n.id === pendingConnection.source) || null;
  }, [nodes, pendingConnection]);

  const sourceNodeLabel = useMemo(() => {
    return sourceNode?.data?.label || 'Unknown';
  }, [sourceNode]);

  const targetNodeLabel = useMemo(() => {
    if (!pendingConnection) {
      return '';
    }

    return (
      nodes.find((n: Node) => n.id === pendingConnection.target)?.data?.label ||
      'Unknown'
    );
  }, [nodes, pendingConnection]);

  const startEventNode = useMemo(() => {
    return (
      nodes.find(
        (n: Node) =>
          n.type === NodeType.StartEvent ||
          n.data?.subType === NodeType.StartEvent
      ) || null
    );
  }, [nodes]);

  const startEventDataAssets = useMemo(() => {
    return startEventNode?.data?.dataAssets || [];
  }, [startEventNode]);

  const startEventTriggerType = useMemo(() => {
    return startEventNode?.data?.triggerType || '';
  }, [startEventNode]);

  const [isUndoRedoInProgress, setIsUndoRedoInProgress] = useState(false);
  const [isRunLoading, setIsRunLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkflowBuilderTab>(
    workflowBuilderTabs[0].value as WorkflowBuilderTab
  );
  const [savedStateOnEdit, setSavedStateOnEdit] = useState<{
    edges: Edge[];
    nodes: Node[];
  } | null>(null);
  const [hasNodeConfigSaved, setHasNodeConfigSaved] = useState(false);

  const handleUndo = () => {
    const previousState = undo();
    if (previousState) {
      setIsUndoRedoInProgress(true);
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
      setTimeout(() => setIsUndoRedoInProgress(false), 100);
    }
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState) {
      setIsUndoRedoInProgress(true);
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setTimeout(() => setIsUndoRedoInProgress(false), 100);
    }
  };

  const handleRearrange = () => {
    if (nodes.length === 0) {
      return;
    }
    saveState(nodes, edges, 'Before Rearrange');
    const { edges: layoutedEdges, nodes: layoutedNodes } = applyFlowchartLayout(
      nodes,
      edges
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    saveState(layoutedNodes, layoutedEdges, 'Rearrange Workflow');
  };

  const prevNodesRef = useRef(nodes);
  const prevEdgesRef = useRef(edges);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;

      return;
    }

    if (isUndoRedoInProgress) {
      prevNodesRef.current = nodes;
      prevEdgesRef.current = edges;

      return;
    }

    if (prevNodesRef.current === nodes && prevEdgesRef.current === edges) {
      return;
    }

    const timer = setTimeout(() => {
      if (!isUndoRedoInProgress && (nodes.length > 0 || edges.length > 0)) {
        saveState(nodes, edges, 'Workflow State Changed');
      }
    }, 500);

    prevNodesRef.current = nodes;
    prevEdgesRef.current = edges;

    return () => clearTimeout(timer);
  }, [nodes, edges, saveState, isUndoRedoInProgress]);

  const isNodeDragEnabledWrapper = useCallback(
    (nodeType: string) => isNodeDragEnabled(nodeType as NodeType),
    [isNodeDragEnabled]
  );

  const workflowActions = useWorkflowActions({
    ...workflowLogic,
    isNodeDragEnabled: isNodeDragEnabledWrapper,
    syncWithStore,
    workflowMetadata: workflowLogic.workflowMetadata ?? null,
  });

  const {
    handleConfigSidebarClose,
    handleConnectionCancel,
    handleConnectionSave,
    handleEdgeClick,
    handleEdgeDelete: originalHandleEdgeDelete,
    handleNodeClick,
    handleNodeConfigSave: originalHandleNodeConfigSave,
    handleSaveWorkflow,
    handleTestWorkflow,
    handleWorkflowMetadataUpdate,
    performDeleteWorkflow,
  } = workflowActions;

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      saveState(nodes, edges, 'Before Edge Delete');
      originalHandleEdgeDelete(edgeId);
    },
    [saveState, nodes, edges, originalHandleEdgeDelete]
  );

  const handleNodeConfigSave = (
    nodeId: string,
    config: Record<string, unknown>
  ) => {
    saveState(nodes, edges, 'Before Node Configuration Update');
    originalHandleNodeConfigSave(nodeId, config);
    setHasNodeConfigSaved(true);
  };

  const handleShowDeleteModal = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleDeleteModalCancel = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  const handleDeleteWorkflowFromModal = useCallback(async () => {
    try {
      setIsDeleting(true);
      await performDeleteWorkflow();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [performDeleteWorkflow]);

  const handleRunWorkflow = useCallback(async () => {
    const workflowFqn = workflowMetadata?.name;
    if (!workflowFqn) {
      showErrorToast(t('message.workflow-fqn-required'));

      return;
    }

    try {
      setIsRunLoading(true);
      await triggerWorkflow(workflowFqn);
      showSuccessToast(t('message.workflow-triggered-successfully'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsRunLoading(false);
    }
  }, [workflowMetadata?.name, t]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isEditMode && !savedStateOnEdit) {
      setSavedStateOnEdit({
        edges: [...edges],
        nodes: [...nodes],
      });
    } else if (!isEditMode && savedStateOnEdit) {
      setSavedStateOnEdit(null);
    }
  }, [isEditMode, savedStateOnEdit, loading]);

  const navBlockEnabled = isEditMode && hasNodeConfigSaved;

  const handleRevertAndCancel = useCallback(() => {
    if (savedStateOnEdit) {
      setNodes(savedStateOnEdit.nodes);
      setEdges(savedStateOnEdit.edges);
      setSavedStateOnEdit(null);
    }
    setHasNodeConfigSaved(false);
    enterViewMode();
  }, [savedStateOnEdit, setNodes, setEdges, enterViewMode]);

  const handleSaveWorkflowWithSnapshot =
    useCallback(async (): Promise<boolean> => {
      const success = await handleSaveWorkflow();
      if (success) {
        setHasNodeConfigSaved(false);
      }

      return success;
    }, [handleSaveWorkflow]);

  const handleUpdateDisplayName = useCallback(
    async (newDisplayName: string) => {
      try {
        if (!workflowDefinition?.id) {
          showErrorToast(t('message.workflow-id-required'));

          return;
        }

        const updatedWorkflowDefinition = {
          ...workflowDefinition,
          displayName: newDisplayName,
        };

        const jsonPatch: Operation[] = compare(
          workflowDefinition,
          updatedWorkflowDefinition
        );

        const response = await patchWorkflowDefinition(
          workflowDefinition.id,
          jsonPatch
        );

        handleWorkflowMetadataUpdate({
          description: workflowMetadata?.description || '',
          displayName: response.displayName || newDisplayName,
        });
        workflowLogic.setWorkflowDefinition(response);
        syncWithStore();

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.display-name'),
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [
      workflowDefinition,
      workflowMetadata?.description,
      handleWorkflowMetadataUpdate,
      syncWithStore,
    ]
  );

  const navigationBlock = useWorkflowNavigationBlock({
    enabled: navBlockEnabled,
    onSaveWorkflow: handleSaveWorkflowWithSnapshot,
  });

  const workflowDisplayName =
    workflowMetadata?.displayName || 'Workflow Builder';
  const workflowName = workflowMetadata?.name;

  const breadcrumbs = useMemo(() => {
    return [
      {
        activeTitle: false,
        name: t('label.workflow-plural'),
        url: getWorkflowDefinitionsListPath(),
      },
    ];
  }, [workflowDisplayName, t]);

  if (loading) {
    return <Loader />;
  }

  const sidebarClassName = classNames(
    'tw:absolute tw:top-8.5 tw:left-5 tw:bottom-5 tw:w-72 tw:z-10',
    'tw:flex tw:flex-col tw:min-h-0',
    'tw:rounded-lg tw:bg-primary tw:border tw:border-border-secondary tw:shadow-sm',
    'tw:overflow-y-auto tw:transition-opacity tw:duration-300',
    {
      'tw:opacity-30': focusedConnection || isConnectionModalOpen,
    }
  );

  return (
    <PageLayoutV1
      fullHeight
      mainContainerClassName="workflow-builder-layout"
      pageContainerStyle={{
        height: 'calc(100vh - var(--ant-navbar-height))',
        overflow: 'hidden',
      }}
      pageTitle={t('label.workflow-plural')}>
      {isConnectionModalOpen && (
        <div className="tw:fixed tw:inset-0 tw:bg-black/30 tw:z-9999" />
      )}

      <div className="tw:bg-gray-50 tw:flex tw:flex-1 tw:min-h-0 tw:flex-col tw:overflow-hidden">
        <div className="tw:mb-4 tw:shrink-0">
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </div>

        <div className="tw:shrink-0">
          <WorkflowHeader
            handleDeleteWorkflow={handleShowDeleteModal}
            handleRevertAndCancel={handleRevertAndCancel}
            handleRunWorkflow={handleRunWorkflow}
            handleSaveWorkflow={handleSaveWorkflowWithSnapshot}
            handleTestWorkflow={handleTestWorkflow}
            isRunLoading={isRunLoading}
            title={workflowDisplayName}
            workflowName={workflowName}
            onUpdateDisplayName={handleUpdateDisplayName}
          />
        </div>
        <Card className="tw:mt-3">
          <Tabs
            className="tw:w-full tw:mt-3 tw:shrink-0 tw:pl-5"
            data-testid="workflow-execution-tabs"
            selectedKey={activeTab}
            onSelectionChange={(key) =>
              setActiveTab(key as WorkflowBuilderTab)
            }>
            <Tabs.List items={workflowBuilderTabs} type="underline">
              {(tab) => (
                <Tabs.Item
                  data-testid={tabTestIds[tab.id as WorkflowBuilderTab]}
                  id={tab.id}
                  label={tab.label}
                />
              )}
            </Tabs.List>
          </Tabs>
        </Card>
        <div className="tw:relative tw:flex tw:flex-1 tw:min-h-0 tw:flex-col tw:pt-4">
          {activeTab === workflowBuilderTabs[0].value ? (
            <div className="tw:flex-1 tw:min-h-0 tw:flex tw:flex-col tw:overflow-hidden">
              <WorkflowCanvas
                canRedo={canRedo}
                canUndo={canUndo}
                edges={edges}
                focusedConnection={focusedConnection}
                isConnectionModalOpen={isConnectionModalOpen}
                isDragging={isDragging}
                isNodeDragEnabled={
                  canDragNodes ? isNodeDragEnabledWrapper : () => false
                }
                nodes={nodes}
                pendingConnection={pendingConnection}
                onConnect={onConnect}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onEdgeClick={handleEdgeClick}
                onEdgeDelete={handleEdgeDelete}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodesChange={onNodesChange}
                onRearrange={handleRearrange}
                onRedo={handleRedo}
                onUndo={handleUndo}
              />
            </div>
          ) : (
            <div className="tw:flex-1 tw:min-h-0 tw:flex tw:flex-col tw:overflow-hidden">
              <WorkflowExecutionHistory />
            </div>
          )}

          {activeTab === workflowBuilderTabs[0].value &&
            canAccessSidebar &&
            showWorkflowNodePalette && (
              <div className={sidebarClassName}>
                <WorkflowSidebar
                  isNodeDragEnabled={
                    isEditMode && showWorkflowNodePalette
                      ? isNodeDragEnabledWrapper
                      : () => false
                  }
                />
              </div>
            )}
        </div>
      </div>

      <NodeFormSidebar
        currentWorkflowConfig={{
          dataAssets: startEventDataAssets,
          triggerType: startEventTriggerType,
        }}
        isOpen={isConfigSidebarOpen}
        node={selectedNode}
        setEdges={setEdges}
        setNodes={setNodes}
        workflowDefinition={workflowDefinition || undefined}
        workflowMetadata={workflowMetadata || undefined}
        onClose={handleConfigSidebarClose}
        onSave={handleNodeConfigSave}
        onWorkflowMetadataUpdate={handleWorkflowMetadataUpdate}
        onWorkflowUpdate={workflowLogic.setWorkflowDefinition}
      />
      <ConnectionConditionModal
        connection={pendingConnection}
        initialConditions={editingEdge?.data?.conditions || null}
        isOpen={isConnectionModalOpen}
        position={modalPosition}
        sourceNode={sourceNode}
        sourceNodeLabel={sourceNodeLabel}
        targetNodeLabel={targetNodeLabel}
        onCancel={handleConnectionCancel}
        onSave={handleConnectionSave}
      />

      <UnsavedChangesModal
        description={t('message.unsaved-changes-warning')}
        discardText={t('label.discard')}
        loading={navigationBlock.isSaveLoading}
        open={navigationBlock.showModal}
        saveText={t('label.save')}
        title={t('message.discard-your-changes')}
        onCancel={navigationBlock.onCancel}
        onDiscard={navigationBlock.onDiscard}
        onSave={navigationBlock.onSave}
      />

      <DeleteModalMUI
        entityTitle={workflowMetadata?.displayName || ''}
        isDeleting={isDeleting}
        message={t('message.delete-entity-message', {
          entity: workflowMetadata?.displayName || '',
        })}
        open={showDeleteModal}
        onCancel={handleDeleteModalCancel}
        onDelete={handleDeleteWorkflowFromModal}
      />
    </PageLayoutV1>
  );
};

const WorkflowBuilderWrapper: React.FC<{ workflowFqn?: string }> = ({
  workflowFqn,
}) => {
  const workflowLogic = useWorkflowLogic({ fqn: workflowFqn });
  const { workflowDefinition } = workflowLogic;

  return (
    <WorkflowModeProvider
      workflowDefinition={workflowDefinition}
      workflowFqn={workflowFqn}>
      <WorkflowBuilderInternal workflowLogic={workflowLogic} />
    </WorkflowModeProvider>
  );
};

const WorkflowBuilder: React.FC = () => {
  const { fqn } = useFqn();
  const allowCreateWorkflow =
    workflowClassBase.getCapabilities().allowCreateWorkflow;

  if (!fqn?.trim() && !allowCreateWorkflow) {
    return <Navigate replace to={getWorkflowDefinitionsListPath()} />;
  }

  return (
    <ReactFlowProvider>
      <WorkflowBuilderWrapper workflowFqn={fqn} />
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;

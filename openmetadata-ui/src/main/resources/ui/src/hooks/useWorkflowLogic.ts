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

import { AxiosError } from 'axios';
import { useCallback, useEffect } from 'react';
import {
  Edge,
  Node,
  OnConnect,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import { useWorkflowStore } from '../components/WorkflowDefinitions/Workflows/useWorkflowStore';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import { getWorkflowDefinitionByFQN } from '../rest/workflowDefinitionsAPI';
import {
  createNodeData,
  generateNodeId,
  shouldShowConnectionModal,
  shouldShowForm,
  shouldUseConfigSidebar,
} from '../utils/NodeUtils';
import { showErrorToast } from '../utils/ToastUtils';
import workflowClassBase from '../utils/WorkflowClassBase';
import { applyFlowchartLayout } from '../utils/WorkflowLayout';
import { deserializeWorkflow } from '../utils/WorkflowSerializer';
import { useWorkflowState } from './useWorkflowState';

interface UseWorkflowLogicProps {
  fqn?: string;
  initialConfig?: Record<string, unknown>;
}

export const useWorkflowLogic = ({
  fqn,
  initialConfig,
}: UseWorkflowLogicProps = {}) => {
  const { screenToFlowPosition } = useReactFlow();

  const workflowState = useWorkflowState({ initialConfig, fqn });
  const {
    nodes,
    edges,
    workflowDefinition,
    setWorkflowDefinition,
    setWorkflowMetadata,
    setLoading,
    setSelectedNode,
    setIsDragging,
    updateMultipleState,
    setNodes: setUnifiedNodes,
    setEdges: setUnifiedEdges,
  } = workflowState;

  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (nodes.length > 0 && reactFlowNodes.length === 0) {
      setReactFlowNodes(nodes);
    }
  }, [nodes, reactFlowNodes.length, setReactFlowNodes]);

  useEffect(() => {
    if (edges.length > 0 && reactFlowEdges.length === 0) {
      setReactFlowEdges(edges);
    }
  }, [edges, reactFlowEdges.length, setReactFlowEdges]);

  const setBothNodes = useCallback(
    (updater: Node[] | ((nodes: Node[]) => Node[])) => {
      setReactFlowNodes(updater);
      setUnifiedNodes(updater);
    },
    [setReactFlowNodes, setUnifiedNodes]
  );

  const setBothEdges = useCallback(
    (updater: Edge[] | ((edges: Edge[]) => Edge[])) => {
      setReactFlowEdges(updater);
      setUnifiedEdges(updater);
    },
    [setReactFlowEdges, setUnifiedEdges]
  );

  const {
    setWorkflowDefinition: setStoreWorkflowDefinition,
    setNodesEdgesData: setStoreNodesEdgesData,
  } = useWorkflowStore();

  const syncWithStore = useCallback(() => {
    if (workflowDefinition) {
      setStoreWorkflowDefinition(workflowDefinition);
    }
    if (setStoreNodesEdgesData) {
      setStoreNodesEdgesData({
        nodes: reactFlowNodes,
        edges: reactFlowEdges,
        init: true,
      });
    }
  }, [
    workflowDefinition,
    reactFlowNodes,
    reactFlowEdges,
    setStoreWorkflowDefinition,
    setStoreNodesEdgesData,
  ]);

  useEffect(() => {
    const fetchWorkflowDefinition = async () => {
      if (!fqn) {
        if (!workflowClassBase.getCapabilities().allowCreateWorkflow) {
          return;
        }
        setWorkflowMetadata({
          name: '',
          displayName: 'New Workflow',
          description: '',
          isNewWorkflow: true,
        });

        return;
      }

      try {
        setLoading(true);

        const workflowData = await getWorkflowDefinitionByFQN(
          decodeURIComponent(fqn)
        );
        setWorkflowDefinition(workflowData);

        // Extract and set workflow metadata from the fetched data
        if (workflowData) {
          setWorkflowMetadata({
            name: workflowData.name || '',
            displayName: workflowData.displayName || workflowData.name || '',
            description: workflowData.description || '',
            createdAt: workflowData.createdAt,
            id: workflowData.id,
            isNewWorkflow: false,
          });
        }

        if (workflowData.nodes && workflowData.nodes.length > 0) {
          const { nodes: reactFlowNodes, edges: reactFlowEdges } =
            deserializeWorkflow(workflowData);

          const { nodes: layoutedNodes, edges: layoutedEdges } =
            applyFlowchartLayout(reactFlowNodes, reactFlowEdges);

          setReactFlowNodes(layoutedNodes);
          setUnifiedNodes(layoutedNodes);
          setReactFlowEdges(layoutedEdges);
          setUnifiedEdges(layoutedEdges);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflowDefinition();
  }, [fqn]);

  const isNodeDragEnabled = useCallback(
    (nodeType: NodeType) => {
      const startNode = reactFlowNodes.find(
        (node) => node.type === NodeType.StartEvent
      );

      if (nodeType === NodeType.StartEvent) {
        return !startNode;
      }

      if (!startNode) {
        return false;
      }

      if (fqn) {
        return true;
      }

      if (reactFlowNodes.length <= 1) {
        const isConfigured = Boolean(
          startNode.data?.lastSaved ||
            startNode.data?.userModified ||
            (startNode.data?.name && startNode.data?.dataAssets?.length > 0) ||
            startNode.data?.triggerType ||
            startNode.data?.eventType ||
            startNode.data?.scheduleType
        );

        return isConfigured;
      }

      return true;
    },
    [reactFlowNodes, fqn]
  );

  const canDragNodes = true;

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    },
    [setIsDragging]
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const isOutside =
        event.clientX <= rect.left ||
        event.clientX >= rect.right ||
        event.clientY <= rect.top ||
        event.clientY >= rect.bottom;

      if (isOutside) {
        setIsDragging(false);
      }
    },
    [setIsDragging]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!type) {
        return;
      }

      if (!isNodeDragEnabled(type as NodeType)) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeId = generateNodeId(type);
      const nodeData = createNodeData(label, type, nodeId);

      // Set the proper node name using counter approach
      const existingNames = new Set(
        reactFlowNodes.map((n) => n.data?.name).filter(Boolean)
      );
      let nodeName = '';

      if (type === NodeType.StartEvent) {
        nodeName = 'start';
      } else {
        const baseName = nodeData?.subType || nodeId;
        let counter = 1;

        nodeName = `${baseName}_${counter}`;
        while (existingNames.has(nodeName)) {
          counter++;
          nodeName = `${baseName}_${counter}`;
        }
      }

      nodeData.name = nodeName;

      const newNode = {
        id: nodeId,
        type: type,
        position,
        data: nodeData,
      };

      setBothNodes((nds: Node[]) => [...nds, newNode]);

      if (type === NodeType.StartEvent) {
        setSelectedNode(newNode);
        if (shouldShowForm(type)) {
          if (shouldUseConfigSidebar(type)) {
            updateMultipleState({
              isConfigSidebarOpen: true,
              isWorkflowFormDrawerOpen: false,
            });
          } else {
            updateMultipleState({
              isWorkflowFormDrawerOpen: true,
              isConfigSidebarOpen: false,
            });
          }
        }
      }
    },
    [
      screenToFlowPosition,
      setBothNodes,
      isNodeDragEnabled,
      setIsDragging,
      setSelectedNode,
      updateMultipleState,
    ]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const sourceNode = reactFlowNodes.find(
        (node) => node.id === connection.source
      );
      const targetNode = reactFlowNodes.find(
        (node) => node.id === connection.target
      );

      if (shouldShowConnectionModal(sourceNode, targetNode)) {
        updateMultipleState({
          pendingConnection: connection,
          isConnectionModalOpen: true,
        });
      } else {
        // Create edge manually with duplicate prevention
        const edgeId = `reactflow__edge-${connection.source}-${connection.target}`;
        const existingEdge = reactFlowEdges.find((edge) => edge.id === edgeId);

        if (existingEdge) {
          return;
        }

        const newEdge = {
          id: edgeId,
          source: connection.source || '',
          target: connection.target || '',
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          type: 'default',
        };

        setBothEdges((eds: Edge[]) => [...eds, newEdge]);
      }
    },
    [reactFlowNodes, reactFlowEdges, setBothEdges, updateMultipleState]
  );

  return {
    ...workflowState,
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
    setNodes: setBothNodes,
    setEdges: setBothEdges,

    onNodesChange,
    onEdgesChange,
    onConnect,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,

    isNodeDragEnabled,
    canDragNodes,
    syncWithStore,
    setWorkflowMetadata,
    setWorkflowDefinition,
  };
};

export type UseWorkflowLogicReturn = ReturnType<typeof useWorkflowLogic>;

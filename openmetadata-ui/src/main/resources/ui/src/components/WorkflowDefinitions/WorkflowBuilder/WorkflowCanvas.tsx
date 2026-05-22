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

import { Card } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  ConnectionLineType,
  EdgeChange,
  MarkerType,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../../constants/Lineage.constants';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { WorkflowCanvasProps } from '../../../interface/workflow-builder-components.interface';
import { CustomControls } from './CustomControls';
import { nodeTypes } from './CustomNodes';
import { EmptyCanvasMessage } from './EmptyCanvasMessage';
import { StraightEdge } from './StraightEdge';
import './WorkflowCanvas.less';

const edgeTypes = {
  straight: StraightEdge,
  default: StraightEdge,
};

const WorkflowCanvasInternal: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onEdgeDelete,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  focusedConnection,
  isDragging,
  onUndo,
  onRedo,
  onRearrange,
  canUndo = false,
  canRedo = false,
  isNodeDragEnabled,
  isConnectionModalOpen,
  pendingConnection,
}) => {
  const { allowStructuralGraphEdits, isViewMode, showWorkflowNodePalette } =
    useWorkflowModeContext();

  const structuralEditMode = allowStructuralGraphEdits && !isViewMode;
  const enablePaletteDrop =
    !isViewMode && (allowStructuralGraphEdits || showWorkflowNodePalette);

  const guardedOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!allowStructuralGraphEdits) {
        const allowed = changes.filter(
          (c) => c.type === 'select' || c.type === 'dimensions'
        );
        if (allowed.length > 0) {
          onNodesChange(allowed);
        }

        return;
      }
      onNodesChange(changes);
    },
    [allowStructuralGraphEdits, onNodesChange]
  );

  const guardedOnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!allowStructuralGraphEdits) {
        const allowed = changes.filter((c) => c.type !== 'remove');
        if (allowed.length > 0) {
          onEdgesChange(allowed);
        }

        return;
      }
      onEdgesChange(changes);
    },
    [allowStructuralGraphEdits, onEdgesChange]
  );

  const canvasClassName = classNames(
    'workflow-canvas',
    isViewMode ? 'view-mode' : 'edit-mode',
    'tw:relative tw:flex-1 tw:min-h-0 tw:w-full tw:overflow-hidden'
  );

  return (
    <Card
      className={classNames(canvasClassName, 'tw:flex-1 tw:min-h-0')}
      data-testid="workflow-canvas">
      {focusedConnection && (
        <div className="tw:absolute tw:inset-0 tw:bg-brand-900/20 tw:z-[1] tw:pointer-events-none tw:transition-opacity tw:duration-300" />
      )}

      <ReactFlow
        connectionLineType={ConnectionLineType.Straight}
        defaultEdgeOptions={{
          type: 'straight',
          style: {
            strokeWidth: 2,
          },
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        edgeTypes={edgeTypes}
        edges={edges.map((edge) => {
          let shouldDimEdge = false;

          if (focusedConnection) {
            shouldDimEdge = true;
          } else if (isConnectionModalOpen && pendingConnection) {
            shouldDimEdge = !(
              edge.source === pendingConnection.source &&
              edge.target === pendingConnection.target
            );
          }

          return {
            ...edge,
            type: edge.type || 'straight',
            markerEnd: edge.markerEnd || {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
            },
            style: {
              strokeWidth: edge.style?.strokeWidth || 2,
              ...edge.style,
              opacity: shouldDimEdge ? (isConnectionModalOpen ? 0.15 : 0.3) : 1,
              transition: 'opacity 0.3s ease',
            },
            labelStyle: {
              ...edge.labelStyle,
              cursor:
                edge.data?.conditions && !isViewMode ? 'pointer' : 'default',
            },
            data: {
              ...edge.data,
              onEdgeDelete,
            },
          };
        })}
        edgesUpdatable={structuralEditMode}
        maxZoom={MAX_ZOOM_VALUE}
        minZoom={MIN_ZOOM_VALUE}
        nodeTypes={nodeTypes}
        nodes={nodes.map((node) => {
          const nodeType = node.type || '';
          const isNodeDisabled =
            isNodeDragEnabled && !isNodeDragEnabled(nodeType);

          let shouldDimNode = false;

          if (focusedConnection) {
            shouldDimNode =
              node.id !== focusedConnection.sourceId &&
              node.id !== focusedConnection.targetId;
          } else if (isConnectionModalOpen && pendingConnection) {
            shouldDimNode =
              node.id !== pendingConnection.source &&
              node.id !== pendingConnection.target;
          }

          return {
            ...node,
            style: {
              ...node.style,
              opacity: shouldDimNode ? (isConnectionModalOpen ? 0.15 : 0.3) : 1,
              transition: 'opacity 0.3s ease',
              cursor: isViewMode ? 'default' : 'pointer',
            },
            data: {
              ...node.data,
              disabled: isNodeDisabled,
            },
          };
        })}
        nodesConnectable={structuralEditMode}
        nodesDraggable={structuralEditMode}
        onConnect={structuralEditMode ? onConnect : undefined}
        onDragEnter={enablePaletteDrop ? onDragEnter : undefined}
        onDragLeave={enablePaletteDrop ? onDragLeave : undefined}
        onDragOver={enablePaletteDrop ? onDragOver : undefined}
        onDrop={enablePaletteDrop ? onDrop : undefined}
        onEdgeClick={onEdgeClick}
        onEdgesChange={guardedOnEdgesChange}
        onNodeClick={onNodeClick}
        onNodesChange={guardedOnNodesChange}>
        <Background />
      </ReactFlow>

      <CustomControls
        allowStructuralGraphEdits={allowStructuralGraphEdits}
        canRedo={canRedo}
        canUndo={canUndo}
        isViewMode={isViewMode}
        onRearrange={onRearrange}
        onRedo={onRedo}
        onUndo={onUndo}
      />

      <EmptyCanvasMessage hasNodes={nodes.length > 0} isDragging={isDragging} />
    </Card>
  );
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
  return <WorkflowCanvasInternal {...props} />;
};

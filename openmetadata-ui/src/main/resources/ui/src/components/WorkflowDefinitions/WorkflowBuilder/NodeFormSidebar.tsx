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

import {
  Divider,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge, Node } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { NodeSubType } from '../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../generated/governance/workflows/elements/nodeType';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { WorkflowMetadata } from '../../../interface/workflow-builder-components.interface';
import { TaskNodeFormRenderer } from './forms';
import { NodeConfigSidebar } from './NodeConfigSidebar';

interface NodeFormSidebarProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  workflowDefinition?: WorkflowDefinition | null;
  workflowMetadata?: WorkflowMetadata;
  onWorkflowUpdate?: (definition: WorkflowDefinition) => void;
  onWorkflowMetadataUpdate?: (metadata: WorkflowMetadata) => void;
  setNodes?: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges?: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  currentWorkflowConfig?: {
    dataAssets?: string[];
    triggerType?: string;
  };
}

const isStartNode = (node: Node | null): boolean => {
  return (
    node?.type === NodeType.StartEvent ||
    node?.data?.subType === NodeSubType.StartEvent
  );
};

export const NodeFormSidebar: React.FC<NodeFormSidebarProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
  workflowDefinition,
  workflowMetadata,
  onWorkflowUpdate,
  onWorkflowMetadataUpdate,
  setNodes,
  setEdges,
  currentWorkflowConfig,
}) => {
  const { t } = useTranslation();

  const entityTypes = useMemo(() => {
    if (
      currentWorkflowConfig?.dataAssets &&
      currentWorkflowConfig.dataAssets.length > 0
    ) {
      return currentWorkflowConfig.dataAssets as EntityType[];
    }

    if (workflowDefinition?.trigger) {
      const triggerConfig =
        typeof workflowDefinition.trigger === 'object' &&
        workflowDefinition.trigger !== null &&
        !Array.isArray(workflowDefinition.trigger)
          ? workflowDefinition.trigger.config
          : null;

      if (triggerConfig) {
        const singleEntityType = triggerConfig.entityType;
        const multipleEntityTypes = triggerConfig.entityTypes;

        if (multipleEntityTypes && Array.isArray(multipleEntityTypes)) {
          return multipleEntityTypes as EntityType[];
        } else if (singleEntityType) {
          return [singleEntityType as EntityType];
        }
      }
    }

    return [EntityType.ALL];
  }, [workflowDefinition, currentWorkflowConfig]);

  if (!node) {
    return null;
  }

  const nodeTitle = isStartNode(node)
    ? t('label.workflow-configuration')
    : node.data?.displayName ||
      node.data?.label ||
      t('label.node-configuration');

  if (isStartNode(node)) {
    return (
      <NodeConfigSidebar
        isOpen={isOpen}
        node={node}
        setEdges={setEdges}
        setNodes={setNodes}
        workflowDefinition={workflowDefinition || null}
        workflowMetadata={workflowMetadata}
        onClose={onClose}
        onSave={onSave}
        onWorkflowMetadataUpdate={onWorkflowMetadataUpdate}
        onWorkflowUpdate={
          onWorkflowUpdate ||
          (() => {
            return;
          })
        }
      />
    );
  }

  return (
    <SlideoutMenu
      className="tw:z-9999"
      data-testid="node-config-sidebar"
      isOpen={isOpen}
      width={640}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
      {({ close }) => (
        <>
          <SlideoutMenu.Header onClose={close}>
            <Typography
              as="p"
              className="tw:m-0 tw:text-sm tw:font-semibold tw:text-primary">
              {nodeTitle}
            </Typography>
          </SlideoutMenu.Header>
          <SlideoutMenu.Content>
            <Divider orientation="horizontal" />
            <TaskNodeFormRenderer
              entityTypes={entityTypes}
              node={node}
              onClose={close}
              onDelete={
                setNodes && setEdges
                  ? (nodeId: string) => {
                      if (setNodes) {
                        setNodes((nodes) =>
                          nodes.filter((n) => n.id !== nodeId)
                        );
                      }
                      if (setEdges) {
                        setEdges((edges) =>
                          edges.filter(
                            (e) => e.source !== nodeId && e.target !== nodeId
                          )
                        );
                      }
                      if (workflowDefinition && onWorkflowUpdate) {
                        const updatedDefinition = {
                          ...workflowDefinition,
                          nodes:
                            workflowDefinition.nodes?.filter(
                              (n) => n.name !== nodeId
                            ) || [],
                          edges:
                            workflowDefinition.edges?.filter(
                              (e) => e.from !== nodeId && e.to !== nodeId
                            ) || [],
                        };
                        onWorkflowUpdate(updatedDefinition);
                      }
                    }
                  : undefined
              }
              onSave={onSave}
            />
          </SlideoutMenu.Content>
        </>
      )}
    </SlideoutMenu>
  );
};

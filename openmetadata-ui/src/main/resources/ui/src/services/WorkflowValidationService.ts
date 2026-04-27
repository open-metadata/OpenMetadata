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

import { AxiosError } from 'axios';
import i18next from 'i18next';
import { Edge, Node } from 'reactflow';
import {
  ScheduleConfig,
  WorkflowType,
} from '../constants/WorkflowBuilder.constants';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import { ScheduleTimeline } from '../generated/governance/workflows/elements/triggers/periodicBatchEntityTrigger';
import {
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import {
  DataAssetFilter,
  NodeConfig,
} from '../interface/workflow-builder-components.interface';
import { validateWorkflowDefinition } from '../rest/workflowDefinitionsAPI';
import { showErrorToast, showSuccessToast } from '../utils/ToastUtils';
import {
  getNodeConfiguration,
  getNodeName,
} from '../utils/WorkflowNodeConfigUtils';

type NodeConfigWithMetadata = NodeConfig & {
  lastSaved?: string;
  userModified?: boolean;
};

const buildTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  triggerType: string,
  existingTriggerConfig?: Record<string, unknown>
) => {
  const isEventBased = triggerType === Type.EventBasedEntity;
  const isPeriodicBatch = triggerType === Type.PeriodicBatchEntity;

  const hasUserChanges =
    startNodeConfig.lastSaved || startNodeConfig.userModified;
  const hasStartNodeConfig =
    startNodeConfig.dataAssets &&
    Array.isArray(startNodeConfig.dataAssets) &&
    startNodeConfig.dataAssets.length > 0;

  if (isEventBased) {
    const finalTriggerConfig: Record<string, unknown> = {};
    const entityTypes: string[] = [];

    if (hasUserChanges && hasStartNodeConfig) {
      const validAssets = startNodeConfig.dataAssets.filter(
        (asset: string) => asset && asset.trim() !== ''
      );
      if (validAssets.length > 0) {
        entityTypes.push(...validAssets);
      }
    } else if (
      existingTriggerConfig?.entityTypes &&
      Array.isArray(existingTriggerConfig.entityTypes)
    ) {
      entityTypes.push(...existingTriggerConfig.entityTypes);
    } else if (
      existingTriggerConfig?.entityType &&
      typeof existingTriggerConfig.entityType === 'string'
    ) {
      entityTypes.push(existingTriggerConfig.entityType);
    }

    // EntityTypes are required - must be provided
    if (entityTypes.length > 0) {
      finalTriggerConfig.entityTypes = entityTypes;
    } else {
      // If no entity types provided, this will cause issues
    }

    if (
      hasUserChanges &&
      startNodeConfig.eventType &&
      startNodeConfig.eventType.length > 0
    ) {
      finalTriggerConfig.events = startNodeConfig.eventType;
    } else if (existingTriggerConfig?.events) {
      finalTriggerConfig.events = existingTriggerConfig.events;
    }

    if (hasUserChanges && startNodeConfig.excludeFields !== undefined) {
      if (startNodeConfig.excludeFields.length > 0) {
        finalTriggerConfig.exclude = startNodeConfig.excludeFields;
      }
    } else if (existingTriggerConfig?.exclude) {
      finalTriggerConfig.exclude = existingTriggerConfig.exclude;
    }

    if (
      hasUserChanges &&
      Array.isArray(startNodeConfig.include) &&
      startNodeConfig.include.length > 0
    ) {
      finalTriggerConfig.include = startNodeConfig.include;
    } else if (existingTriggerConfig?.include) {
      finalTriggerConfig.include = existingTriggerConfig.include;
    }

    if (
      hasUserChanges &&
      startNodeConfig.triggerFilter &&
      startNodeConfig.triggerFilter.trim() !== ''
    ) {
      const filterObj: Record<string, string> = {};
      entityTypes.forEach((entityType) => {
        filterObj[entityType] = startNodeConfig.triggerFilter || '';
      });
      finalTriggerConfig.filter = filterObj;
    } else if (existingTriggerConfig?.filter) {
      finalTriggerConfig.filter = existingTriggerConfig.filter;
    }

    return finalTriggerConfig;
  } else if (isPeriodicBatch) {
    const finalTriggerConfig: Record<string, unknown> = {};
    const entityTypes: string[] = [];

    if (hasUserChanges && hasStartNodeConfig) {
      const validAssets = startNodeConfig.dataAssets.filter(
        (asset: string) => asset && asset.trim() !== ''
      );
      if (validAssets.length > 0) {
        entityTypes.push(...validAssets);
      }
    } else if (
      existingTriggerConfig?.entityTypes &&
      Array.isArray(existingTriggerConfig.entityTypes)
    ) {
      entityTypes.push(...existingTriggerConfig.entityTypes);
    } else if (
      existingTriggerConfig?.entityType &&
      typeof existingTriggerConfig.entityType === 'string'
    ) {
      entityTypes.push(existingTriggerConfig.entityType);
    }

    // EntityTypes are required - must be provided
    if (entityTypes.length > 0) {
      finalTriggerConfig.entityTypes = entityTypes;
    } else {
      // If no entity types provided, this will cause issues
    }

    if (hasUserChanges) {
      // Use user's configuration
      const scheduleType = startNodeConfig.scheduleType || 'OnDemand';
      if (scheduleType === 'Scheduled' && startNodeConfig.cronExpression) {
        finalTriggerConfig.schedule = {
          scheduleTimeline: 'Custom',
          cronExpression: startNodeConfig.cronExpression,
        };
      } else if (scheduleType === 'OnDemand') {
        finalTriggerConfig.schedule = {
          scheduleTimeline: 'None',
        };
      } else {
        finalTriggerConfig.schedule = {
          scheduleTimeline: 'None',
        };
      }

      if (startNodeConfig.batchSize && startNodeConfig.batchSize !== 100) {
        finalTriggerConfig.batchSize = startNodeConfig.batchSize;
      } else if (existingTriggerConfig?.batchSize) {
        finalTriggerConfig.batchSize = existingTriggerConfig.batchSize;
      } else {
        finalTriggerConfig.batchSize = 100;
      }
    } else {
      if (existingTriggerConfig?.schedule) {
        const existingSchedule = existingTriggerConfig.schedule as Record<
          string,
          unknown
        >;

        // If scheduleTimeline is "None", it means OnDemand
        if (existingSchedule.scheduleTimeline === ScheduleTimeline.None) {
          finalTriggerConfig.schedule = {
            scheduleTimeline: 'None',
          };
        } else if (
          existingSchedule.scheduleTimeline === ScheduleTimeline.Custom &&
          existingSchedule.cronExpression
        ) {
          finalTriggerConfig.schedule = {
            scheduleTimeline: 'Custom',
            cronExpression: existingSchedule.cronExpression,
          };
        } else {
          finalTriggerConfig.schedule = existingTriggerConfig.schedule;
        }
      } else {
        finalTriggerConfig.schedule = {
          scheduleTimeline: 'None',
        };
      }

      if (existingTriggerConfig?.batchSize) {
        finalTriggerConfig.batchSize = existingTriggerConfig.batchSize;
      } else {
        finalTriggerConfig.batchSize = 100;
      }
    }

    if (
      hasUserChanges &&
      startNodeConfig.dataAssetFilters &&
      startNodeConfig.dataAssetFilters.length > 0
    ) {
      const filterObj: Record<string, string> = {};

      startNodeConfig.dataAssetFilters.forEach((df: DataAssetFilter) => {
        const entityType = df.dataAsset;

        const jsonLogicFilter = df.filters;

        if (jsonLogicFilter && jsonLogicFilter.trim() !== '') {
          filterObj[entityType] = jsonLogicFilter;
        }
      });

      if (Object.keys(filterObj).length > 0) {
        finalTriggerConfig.filters = filterObj;
      }
    } else if (existingTriggerConfig?.filters) {
      finalTriggerConfig.filters = existingTriggerConfig.filters;
    }

    return finalTriggerConfig;
  }

  return existingTriggerConfig || {};
};

const mapNodeTypeAndSubtype = (node: Node) => {
  const nodeData = node.data || {};
  let nodeType: NodeType = (node.type as NodeType) || NodeType.AutomatedTask;
  let subType: NodeSubType =
    nodeData.subType || NodeSubType.SetEntityAttributeTask;

  if (node.type === NodeType.StartEvent) {
    nodeType = NodeType.StartEvent;
    subType = NodeSubType.StartEvent;
  } else if (node.type === NodeType.EndEvent) {
    nodeType = NodeType.EndEvent;
    subType = NodeSubType.EndEvent;
  } else if (
    node.type === NodeType.AutomatedTask ||
    nodeData.nodeType === NodeType.AutomatedTask
  ) {
    nodeType = NodeType.AutomatedTask;
    if (
      nodeData.subType === NodeSubType.CheckChangeDescriptionTask ||
      nodeData.label?.includes('Check Change Desc')
    ) {
      subType = NodeSubType.CheckChangeDescriptionTask;
    } else if (
      nodeData.subType === NodeSubType.CheckEntityAttributesTask ||
      nodeData.label?.includes('Check')
    ) {
      subType = NodeSubType.CheckEntityAttributesTask;
    } else if (
      nodeData.subType === NodeSubType.SetEntityAttributeTask ||
      nodeData.label?.includes('Set')
    ) {
      subType = NodeSubType.SetEntityAttributeTask;
    } else if (
      nodeData.subType === NodeSubType.DataCompletenessTask ||
      nodeData.label?.includes('Completeness')
    ) {
      subType = NodeSubType.DataCompletenessTask;
    } else if (
      nodeData.subType === NodeSubType.RollbackEntityTask ||
      nodeData.label?.includes('Roll') ||
      nodeData.label?.includes('Revert')
    ) {
      subType = NodeSubType.RollbackEntityTask;
    }
  } else if (
    node.type === NodeType.UserTask ||
    nodeData.nodeType === NodeType.UserTask
  ) {
    nodeType = NodeType.UserTask;
    subType = NodeSubType.UserApprovalTask;
  }

  return { nodeType, subType };
};

const buildWorkflowNodes = (nodes: Node[], validEdges: Edge[]) => {
  return nodes.map((node) => {
    const nodeData = node.data || {};
    const { nodeType, subType } = mapNodeTypeAndSubtype(node);

    if (nodeType === NodeType.StartEvent) {
      return {
        type: nodeType,
        subType: subType,
        name: 'start',
        displayName: 'start',
      };
    }

    if (nodeType === NodeType.EndEvent) {
      const endNodeName = getNodeName(
        subType,
        node.id,
        nodes.map((n) => ({ ...n.data, id: n.id }))
      );

      return {
        type: nodeType,
        subType: subType,
        name: endNodeName,
        displayName: 'End',
      };
    }

    return getNodeConfiguration(
      nodeType,
      subType,
      { ...nodeData, id: node.id },
      nodes.map((n) => ({ ...n.data, id: n.id })),
      validEdges.map((e) => ({ ...e.data, from: e.source, to: e.target }))
    );
  });
};

const buildWorkflowEdges = (edges: Edge[], nodes: Node[]) => {
  const nodesWithMetadata = nodes.map((n) => ({ ...n.data, id: n.id }));

  return edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    const getEdgeNodeName = (node: Node) => {
      if (node?.data?.subType) {
        return getNodeName(node.data.subType, node.id, nodesWithMetadata);
      }

      return node?.data?.name || node?.id || '';
    };

    const fromName = sourceNode ? getEdgeNodeName(sourceNode) : edge.source;
    const toName = targetNode ? getEdgeNodeName(targetNode) : edge.target;

    const edgeObj: { from: string; to: string; condition?: string } = {
      from: fromName,
      to: toName,
    };

    const condition = edge.data?.condition || edge.label;
    if (condition && condition !== '' && condition.trim() !== '') {
      // Check if this is a data completeness node with quality band conditions
      const isDataCompletenessNode =
        sourceNode?.data?.subType === NodeSubType.DataCompletenessTask;

      if (isDataCompletenessNode) {
        // For data completeness, preserve the original quality band name (e.g., "Gold", "Silver")
        edgeObj.condition = condition;
      } else {
        // For other nodes, use lowercase (e.g., "true", "false")
        edgeObj.condition = condition.toLowerCase();
      }
    }

    return edgeObj;
  });
};

// Find all nodes that can reach the target node (for save process)
const findAllPredecessorsInSave = (
  targetId: string,
  edges: Array<{ from: string; to: string; condition?: string }>
): string[] => {
  const predecessors = new Set<string>();
  const visited = new Set<string>();

  // Build reverse adjacency list (who points to whom)
  const reverseAdjList = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!reverseAdjList.has(edge.to)) {
      reverseAdjList.set(edge.to, []);
    }
    reverseAdjList.get(edge.to)?.push(edge.from);
  });

  const queue = [targetId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const parents = reverseAdjList.get(currentId) || [];
    for (const parent of parents) {
      predecessors.add(parent);
      if (!visited.has(parent)) {
        queue.push(parent);
      }
    }
  }

  return Array.from(predecessors);
};

// Migration function to fix inputNamespaceMap.updatedBy references
type BackendNode = ReturnType<typeof buildWorkflowNodes>[number];
type BackendEdge = ReturnType<typeof buildWorkflowEdges>[number];

const migrateInputNamespaceMap = (
  nodes: BackendNode[],
  edges: BackendEdge[]
): BackendNode[] => {
  const userTasks = nodes.filter((n) => n.type === NodeType.UserTask);

  return nodes.map((node) => {
    // Fix set/rollback task nodes - they should reference the user task that leads to them
    if (
      (node.subType === NodeSubType.SetEntityAttributeTask ||
        node.subType === NodeSubType.RollbackEntityTask) &&
      node.input?.includes('updatedBy')
    ) {
      const currentUpdatedBy = node.inputNamespaceMap?.updatedBy;

      const allPredecessors = findAllPredecessorsInSave(node.name, edges);

      const shouldMigrate =
        currentUpdatedBy === 'global' ||
        currentUpdatedBy === 'ApproveGlossaryTerm' ||
        currentUpdatedBy === 'ApprovalForUpdates' ||
        (currentUpdatedBy && !nodes.some((n) => n.name === currentUpdatedBy)) ||
        (currentUpdatedBy && !allPredecessors.includes(currentUpdatedBy));

      if (shouldMigrate) {
        // Only use a user task that is actually a predecessor (comes before this node)
        const predecessorUserTask = userTasks.find((userTask) => {
          return allPredecessors.includes(userTask.name);
        });

        if (predecessorUserTask) {
          return {
            ...node,
            inputNamespaceMap: {
              ...node.inputNamespaceMap,
              updatedBy: predecessorUserTask.name,
            },
          };
        }

        return {
          ...node,
          inputNamespaceMap: {
            ...node.inputNamespaceMap,
            updatedBy: 'global',
          },
        };
      }
    }

    return node;
  });
};

const resolveTriggerType = (
  hasUserChanges: string | boolean | null | undefined,
  hasStartNodeConfig: boolean,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerType: Type | undefined
): Type => {
  if (!hasUserChanges || !hasStartNodeConfig || !startNodeConfig.triggerType) {
    return existingTriggerType || Type.EventBasedEntity;
  }
  const trigger = startNodeConfig.triggerType;
  if (trigger === WorkflowType.EVENT_BASED) {
    return Type.EventBasedEntity;
  }
  if (
    trigger === WorkflowType.PERIODIC_BATCH ||
    trigger === ScheduleConfig.SCHEDULE_TYPE
  ) {
    return Type.PeriodicBatchEntity;
  }

  return Type.EventBasedEntity;
};

export const buildWorkflowForSave = async (
  nodes: Node[],
  edges: Edge[],
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: { displayName?: string; description?: string } | null
): Promise<WorkflowDefinition> => {
  const workflowName = workflowDefinition?.name || 'CustomWorkflow';
  const workflowDisplayName =
    workflowMetadata?.displayName ||
    workflowDefinition?.displayName ||
    'Custom Workflow';
  const workflowDescription =
    workflowMetadata?.description ||
    workflowDefinition?.description ||
    'Custom workflow created with Workflow Builder';

  const startNode = nodes.find((node) => node.type === NodeType.StartEvent);
  const startNodeConfig = (startNode?.data || {}) as NodeConfigWithMetadata;

  const currentNodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (edge) => currentNodeIds.has(edge.source) && currentNodeIds.has(edge.target)
  );

  const existingTriggerType =
    typeof workflowDefinition?.trigger === 'object' &&
    workflowDefinition?.trigger !== null &&
    !Array.isArray(workflowDefinition.trigger)
      ? workflowDefinition.trigger.type
      : undefined;

  const hasUserChanges =
    startNodeConfig.lastSaved || startNodeConfig.userModified;
  const hasStartNodeConfig =
    startNodeConfig.dataAssets &&
    Array.isArray(startNodeConfig.dataAssets) &&
    startNodeConfig.dataAssets.length > 0;

  const triggerType = resolveTriggerType(
    hasUserChanges,
    hasStartNodeConfig,
    startNodeConfig,
    existingTriggerType
  );

  const existingTriggerConfig =
    typeof workflowDefinition?.trigger === 'object' &&
    workflowDefinition?.trigger !== null &&
    !Array.isArray(workflowDefinition.trigger)
      ? workflowDefinition.trigger.config
      : undefined;

  const finalTriggerConfig = buildTriggerConfig(
    startNodeConfig,
    triggerType,
    existingTriggerConfig
  );

  const triggerEntityTypes = Array.isArray(
    (finalTriggerConfig as { entityTypes?: unknown }).entityTypes
  )
    ? (finalTriggerConfig as { entityTypes: string[] }).entityTypes ?? []
    : [];

  if (
    (triggerType === Type.EventBasedEntity ||
      triggerType === Type.PeriodicBatchEntity) &&
    triggerEntityTypes.length === 0
  ) {
    throw new Error(i18next.t('message.workflow-trigger-requires-data-assets'));
  }

  let workflowNodes = buildWorkflowNodes(nodes, validEdges);
  const workflowEdges = buildWorkflowEdges(validEdges as Edge[], nodes);

  workflowNodes = migrateInputNamespaceMap(workflowNodes, workflowEdges);

  const backendReadyJSON = {
    name: workflowName,
    displayName: workflowDisplayName,
    description: workflowDescription,
    type: triggerType,
    trigger: {
      type: triggerType,
      config: finalTriggerConfig,
      output: ['relatedEntity', 'updatedBy'],
    },
    nodes: workflowNodes,
    edges: workflowEdges,
    config: {
      storeStageStatus: triggerType === Type.EventBasedEntity,
    },
  };

  return backendReadyJSON;
};

export const testWorkflow = async (
  nodes: Node[],
  edges: Edge[],
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: { displayName?: string; description?: string } | null
): Promise<WorkflowDefinition> => {
  let backendReadyJSON: WorkflowDefinition;
  try {
    backendReadyJSON = await buildWorkflowForSave(
      nodes,
      edges,
      workflowDefinition,
      workflowMetadata
    );
  } catch (error) {
    if (error instanceof Error) {
      showErrorToast(error.message);
    } else {
      showErrorToast(String(error));
    }

    throw error;
  }

  try {
    const validationResult: {
      message: string;
      status?: string;
      validatedAt?: number;
      code?: number;
    } = await validateWorkflowDefinition(backendReadyJSON);

    showSuccessToast(
      validationResult.message || 'Workflow validation successful'
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error) {
      showErrorToast(error as AxiosError);
    } else if (error instanceof Error) {
      showErrorToast(error.message);
    } else {
      showErrorToast(String(error));
    }

    throw error;
  }

  return backendReadyJSON;
};

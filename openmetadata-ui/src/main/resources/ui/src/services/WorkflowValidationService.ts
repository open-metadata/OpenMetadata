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

type TriggerUserChanges = string | boolean | undefined;

const resolveEntityTypes = (
  hasUserChanges: TriggerUserChanges,
  hasStartNodeConfig: boolean,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
): string[] => {
  if (hasUserChanges && hasStartNodeConfig) {
    return startNodeConfig.dataAssets.filter(
      (asset: string) => asset && asset.trim() !== ''
    );
  }
  if (
    existingTriggerConfig?.entityTypes &&
    Array.isArray(existingTriggerConfig.entityTypes)
  ) {
    return [...existingTriggerConfig.entityTypes];
  }
  if (
    existingTriggerConfig?.entityType &&
    typeof existingTriggerConfig.entityType === 'string'
  ) {
    return [existingTriggerConfig.entityType];
  }

  return [];
};

const resolveEventTypes = (
  hasUserChanges: TriggerUserChanges,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
): unknown => {
  if (
    hasUserChanges &&
    startNodeConfig.eventType &&
    startNodeConfig.eventType.length > 0
  ) {
    return startNodeConfig.eventType;
  }
  if (existingTriggerConfig?.events) {
    return existingTriggerConfig.events;
  }

  return undefined;
};

const resolveExclude = (
  hasUserChanges: TriggerUserChanges,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
): unknown => {
  if (hasUserChanges && startNodeConfig.excludeFields !== undefined) {
    return startNodeConfig.excludeFields.length > 0
      ? startNodeConfig.excludeFields
      : undefined;
  }
  if (existingTriggerConfig?.exclude) {
    return existingTriggerConfig.exclude;
  }

  return undefined;
};

const resolveInclude = (
  hasUserChanges: TriggerUserChanges,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
): unknown => {
  if (
    hasUserChanges &&
    Array.isArray(startNodeConfig.include) &&
    startNodeConfig.include.length > 0
  ) {
    return startNodeConfig.include;
  }
  if (existingTriggerConfig?.include) {
    return existingTriggerConfig.include;
  }

  return undefined;
};

const resolveEventFilter = (
  hasUserChanges: TriggerUserChanges,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  entityTypes: string[]
): unknown => {
  if (
    hasUserChanges &&
    startNodeConfig.triggerFilter &&
    startNodeConfig.triggerFilter.trim() !== ''
  ) {
    const filterObj: Record<string, string> = {};
    entityTypes.forEach((entityType) => {
      filterObj[entityType] = startNodeConfig.triggerFilter || '';
    });

    return filterObj;
  }
  if (existingTriggerConfig?.filter) {
    return existingTriggerConfig.filter;
  }

  return undefined;
};

const buildEventBasedTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: TriggerUserChanges,
  hasStartNodeConfig: boolean
): Record<string, unknown> => {
  const finalTriggerConfig: Record<string, unknown> = {};
  const entityTypes = resolveEntityTypes(
    hasUserChanges,
    hasStartNodeConfig,
    startNodeConfig,
    existingTriggerConfig
  );

  // EntityTypes are required - must be provided
  if (entityTypes.length > 0) {
    finalTriggerConfig.entityTypes = entityTypes;
  }

  const events = resolveEventTypes(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig
  );
  if (events !== undefined) {
    finalTriggerConfig.events = events;
  }

  const exclude = resolveExclude(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig
  );
  if (exclude !== undefined) {
    finalTriggerConfig.exclude = exclude;
  }

  const include = resolveInclude(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig
  );
  if (include !== undefined) {
    finalTriggerConfig.include = include;
  }

  const filter = resolveEventFilter(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig,
    entityTypes
  );
  if (filter !== undefined) {
    finalTriggerConfig.filter = filter;
  }

  return finalTriggerConfig;
};

const resolveUserSchedule = (
  startNodeConfig: NodeConfigWithMetadata
): Record<string, unknown> => {
  const scheduleType = startNodeConfig.scheduleType || 'OnDemand';
  if (scheduleType === 'Scheduled' && startNodeConfig.cronExpression) {
    return {
      scheduleTimeline: 'Custom',
      cronExpression: startNodeConfig.cronExpression,
    };
  }

  return { scheduleTimeline: 'None' };
};

const resolveExistingSchedule = (
  existingTriggerConfig?: Record<string, unknown>
): unknown => {
  if (!existingTriggerConfig?.schedule) {
    return { scheduleTimeline: 'None' };
  }

  const existingSchedule = existingTriggerConfig.schedule as Record<
    string,
    unknown
  >;

  // If scheduleTimeline is "None", it means OnDemand
  if (existingSchedule.scheduleTimeline === ScheduleTimeline.None) {
    return { scheduleTimeline: 'None' };
  }
  if (
    existingSchedule.scheduleTimeline === ScheduleTimeline.Custom &&
    existingSchedule.cronExpression
  ) {
    return {
      scheduleTimeline: 'Custom',
      cronExpression: existingSchedule.cronExpression,
    };
  }

  return existingTriggerConfig.schedule;
};

const resolveUserBatchSize = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
): unknown => {
  if (startNodeConfig.batchSize && startNodeConfig.batchSize !== 100) {
    return startNodeConfig.batchSize;
  }
  if (existingTriggerConfig?.batchSize) {
    return existingTriggerConfig.batchSize;
  }

  return 100;
};

const resolvePeriodicFilters = (
  hasUserChanges: TriggerUserChanges,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
): unknown => {
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

    return Object.keys(filterObj).length > 0 ? filterObj : undefined;
  }
  if (existingTriggerConfig?.filters) {
    return existingTriggerConfig.filters;
  }

  return undefined;
};

const buildPeriodicBatchTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: TriggerUserChanges,
  hasStartNodeConfig: boolean
): Record<string, unknown> => {
  const finalTriggerConfig: Record<string, unknown> = {};
  const entityTypes = resolveEntityTypes(
    hasUserChanges,
    hasStartNodeConfig,
    startNodeConfig,
    existingTriggerConfig
  );

  // EntityTypes are required - must be provided
  if (entityTypes.length > 0) {
    finalTriggerConfig.entityTypes = entityTypes;
  }

  if (hasUserChanges) {
    finalTriggerConfig.schedule = resolveUserSchedule(startNodeConfig);
    finalTriggerConfig.batchSize = resolveUserBatchSize(
      startNodeConfig,
      existingTriggerConfig
    );
  } else {
    finalTriggerConfig.schedule = resolveExistingSchedule(
      existingTriggerConfig
    );
    finalTriggerConfig.batchSize = existingTriggerConfig?.batchSize
      ? existingTriggerConfig.batchSize
      : 100;
  }

  const filters = resolvePeriodicFilters(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig
  );
  if (filters !== undefined) {
    finalTriggerConfig.filters = filters;
  }

  return finalTriggerConfig;
};

const buildTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  triggerType: string,
  existingTriggerConfig?: Record<string, unknown>
) => {
  const hasUserChanges =
    startNodeConfig.lastSaved || startNodeConfig.userModified;
  const hasStartNodeConfig = Boolean(
    startNodeConfig.dataAssets &&
      Array.isArray(startNodeConfig.dataAssets) &&
      startNodeConfig.dataAssets.length > 0
  );

  if (triggerType === Type.EventBasedEntity) {
    return buildEventBasedTriggerConfig(
      startNodeConfig,
      existingTriggerConfig,
      hasUserChanges,
      hasStartNodeConfig
    );
  }
  if (triggerType === Type.PeriodicBatchEntity) {
    return buildPeriodicBatchTriggerConfig(
      startNodeConfig,
      existingTriggerConfig,
      hasUserChanges,
      hasStartNodeConfig
    );
  }

  return existingTriggerConfig || {};
};

const resolveAutomatedTaskSubType = (
  nodeData: { subType?: NodeSubType; label?: string },
  defaultSubType: NodeSubType
): NodeSubType => {
  const label = nodeData.label;
  const rules: Array<{ subType: NodeSubType; labels: string[] }> = [
    {
      subType: NodeSubType.CheckChangeDescriptionTask,
      labels: ['Check Change Desc'],
    },
    { subType: NodeSubType.CheckEntityAttributesTask, labels: ['Check'] },
    { subType: NodeSubType.SetEntityAttributeTask, labels: ['Set'] },
    { subType: NodeSubType.DataCompletenessTask, labels: ['Completeness'] },
    { subType: NodeSubType.RollbackEntityTask, labels: ['Roll', 'Revert'] },
  ];

  const matched = rules.find(
    (rule) =>
      nodeData.subType === rule.subType ||
      rule.labels.some((keyword) => label?.includes(keyword))
  );

  return matched ? matched.subType : defaultSubType;
};

const mapNodeTypeAndSubtype = (node: Node) => {
  const nodeData = node.data || {};
  const defaultSubType: NodeSubType =
    nodeData.subType || NodeSubType.SetEntityAttributeTask;

  if (node.type === NodeType.StartEvent) {
    return { nodeType: NodeType.StartEvent, subType: NodeSubType.StartEvent };
  }
  if (node.type === NodeType.EndEvent) {
    return { nodeType: NodeType.EndEvent, subType: NodeSubType.EndEvent };
  }
  if (
    node.type === NodeType.AutomatedTask ||
    nodeData.nodeType === NodeType.AutomatedTask
  ) {
    return {
      nodeType: NodeType.AutomatedTask,
      subType: resolveAutomatedTaskSubType(nodeData, defaultSubType),
    };
  }
  if (
    node.type === NodeType.UserTask ||
    nodeData.nodeType === NodeType.UserTask
  ) {
    return {
      nodeType: NodeType.UserTask,
      subType: NodeSubType.UserApprovalTask,
    };
  }

  return {
    nodeType: (node.type as NodeType) || NodeType.AutomatedTask,
    subType: defaultSubType,
  };
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

const shouldMigrateUpdatedBy = (
  currentUpdatedBy: string | undefined,
  nodes: BackendNode[],
  allPredecessors: string[]
): boolean => {
  const isKnownGlobalReference =
    currentUpdatedBy === 'global' ||
    currentUpdatedBy === 'ApproveGlossaryTerm' ||
    currentUpdatedBy === 'ApprovalForUpdates';
  if (isKnownGlobalReference) {
    return true;
  }
  if (!currentUpdatedBy) {
    return false;
  }

  return (
    !nodes.some((n) => n.name === currentUpdatedBy) ||
    !allPredecessors.includes(currentUpdatedBy)
  );
};

const migrateSingleNode = (
  node: BackendNode,
  nodes: BackendNode[],
  userTasks: BackendNode[],
  edges: BackendEdge[]
): BackendNode => {
  const isSetOrRollback =
    node.subType === NodeSubType.SetEntityAttributeTask ||
    node.subType === NodeSubType.RollbackEntityTask;

  // Fix set/rollback task nodes - they should reference the user task that leads to them
  if (!isSetOrRollback || !node.input?.includes('updatedBy')) {
    return node;
  }

  const currentUpdatedBy = node.inputNamespaceMap?.updatedBy;
  const allPredecessors = findAllPredecessorsInSave(node.name, edges);

  if (!shouldMigrateUpdatedBy(currentUpdatedBy, nodes, allPredecessors)) {
    return node;
  }

  // Only use a user task that is actually a predecessor (comes before this node)
  const predecessorUserTask = userTasks.find((userTask) =>
    allPredecessors.includes(userTask.name)
  );

  return {
    ...node,
    inputNamespaceMap: {
      ...node.inputNamespaceMap,
      updatedBy: predecessorUserTask ? predecessorUserTask.name : 'global',
    },
  };
};

const migrateInputNamespaceMap = (
  nodes: BackendNode[],
  edges: BackendEdge[]
): BackendNode[] => {
  const userTasks = nodes.filter((n) => n.type === NodeType.UserTask);

  return nodes.map((node) => migrateSingleNode(node, nodes, userTasks, edges));
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

const resolveWorkflowMetadata = (
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: { displayName?: string; description?: string } | null
): { name: string; displayName: string; description: string } => {
  return {
    name: workflowDefinition?.name || 'CustomWorkflow',
    displayName:
      workflowMetadata?.displayName ||
      workflowDefinition?.displayName ||
      'Custom Workflow',
    description:
      workflowMetadata?.description ||
      workflowDefinition?.description ||
      'Custom workflow created with Workflow Builder',
  };
};

const resolveExistingTrigger = (
  workflowDefinition: WorkflowDefinition | null
): { type?: Type; config?: Record<string, unknown> } => {
  const trigger = workflowDefinition?.trigger;
  if (
    typeof trigger === 'object' &&
    trigger !== null &&
    !Array.isArray(trigger)
  ) {
    return { type: trigger.type, config: trigger.config };
  }

  return {};
};

const getTriggerEntityTypes = (
  finalTriggerConfig: Record<string, unknown> | undefined
): string[] => {
  const entityTypes = (finalTriggerConfig as { entityTypes?: unknown })
    ?.entityTypes;

  return Array.isArray(entityTypes) ? (entityTypes as string[]) : [];
};

export const buildWorkflowForSave = async (
  nodes: Node[],
  edges: Edge[],
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: { displayName?: string; description?: string } | null
): Promise<WorkflowDefinition> => {
  const {
    name: workflowName,
    displayName: workflowDisplayName,
    description: workflowDescription,
  } = resolveWorkflowMetadata(workflowDefinition, workflowMetadata);

  const startNode = nodes.find((node) => node.type === NodeType.StartEvent);
  const startNodeConfig = (startNode?.data || {}) as NodeConfigWithMetadata;

  const currentNodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (edge) => currentNodeIds.has(edge.source) && currentNodeIds.has(edge.target)
  );

  const { type: existingTriggerType, config: existingTriggerConfig } =
    resolveExistingTrigger(workflowDefinition);

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

  const finalTriggerConfig = buildTriggerConfig(
    startNodeConfig,
    triggerType,
    existingTriggerConfig
  );

  const triggerEntityTypes = getTriggerEntityTypes(finalTriggerConfig);

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

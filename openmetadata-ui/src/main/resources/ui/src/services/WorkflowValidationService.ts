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
  TriggerObject,
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

// Shared with buildWorkflowForSave() so both agree on what "user touched the
// start node" means.
const hasUserModifiedStartNode = (
  startNodeConfig: NodeConfigWithMetadata
): boolean =>
  Boolean(startNodeConfig.lastSaved || startNodeConfig.userModified);

const hasConfiguredDataAssets = (
  startNodeConfig: NodeConfigWithMetadata
): boolean =>
  Boolean(
    startNodeConfig.dataAssets &&
      Array.isArray(startNodeConfig.dataAssets) &&
      startNodeConfig.dataAssets.length > 0
  );

// EntityTypes resolution is identical for both event-based and periodic-batch
// triggers - only what gets layered on top of it differs.
const resolveEntityTypes = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean,
  hasStartNodeConfig: boolean
): string[] => {
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
    entityTypes.push(...(existingTriggerConfig.entityTypes as string[]));
  } else if (
    existingTriggerConfig?.entityType &&
    typeof existingTriggerConfig.entityType === 'string'
  ) {
    entityTypes.push(existingTriggerConfig.entityType);
  }

  return entityTypes;
};

const resolveEventBasedEvents = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean
) => {
  if (
    hasUserChanges &&
    startNodeConfig.eventType &&
    startNodeConfig.eventType.length > 0
  ) {
    return startNodeConfig.eventType;
  }

  return existingTriggerConfig?.events;
};

const resolveEventBasedExclude = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean
) => {
  if (hasUserChanges && startNodeConfig.excludeFields !== undefined) {
    return startNodeConfig.excludeFields.length > 0
      ? startNodeConfig.excludeFields
      : undefined;
  }

  return existingTriggerConfig?.exclude;
};

const resolveEventBasedInclude = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean
) => {
  if (
    hasUserChanges &&
    Array.isArray(startNodeConfig.include) &&
    startNodeConfig.include.length > 0
  ) {
    return startNodeConfig.include;
  }

  return existingTriggerConfig?.include;
};

const resolveEventBasedFilter = (
  entityTypes: string[],
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean
) => {
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

  return existingTriggerConfig?.filter;
};

const buildEventBasedTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean,
  hasStartNodeConfig: boolean
): Record<string, unknown> => {
  const finalTriggerConfig: Record<string, unknown> = {};
  const entityTypes = resolveEntityTypes(
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges,
    hasStartNodeConfig
  );

  // EntityTypes are required - must be provided
  if (entityTypes.length > 0) {
    finalTriggerConfig.entityTypes = entityTypes;
  }

  const events = resolveEventBasedEvents(
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges
  );
  if (events) {
    finalTriggerConfig.events = events;
  }

  const exclude = resolveEventBasedExclude(
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges
  );
  if (exclude) {
    finalTriggerConfig.exclude = exclude;
  }

  const include = resolveEventBasedInclude(
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges
  );
  if (include) {
    finalTriggerConfig.include = include;
  }

  const filter = resolveEventBasedFilter(
    entityTypes,
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges
  );
  if (filter) {
    finalTriggerConfig.filter = filter;
  }

  return finalTriggerConfig;
};

const resolveUserScheduleConfig = (startNodeConfig: NodeConfigWithMetadata) => {
  const scheduleType = startNodeConfig.scheduleType || 'OnDemand';
  if (scheduleType === 'Scheduled' && startNodeConfig.cronExpression) {
    return {
      scheduleTimeline: 'Custom',
      cronExpression: startNodeConfig.cronExpression,
    };
  }

  return { scheduleTimeline: 'None' };
};

const resolveExistingScheduleConfig = (
  existingTriggerConfig?: Record<string, unknown>
) => {
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

const resolveScheduleConfig = (
  hasUserChanges: boolean,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
) =>
  hasUserChanges
    ? resolveUserScheduleConfig(startNodeConfig)
    : resolveExistingScheduleConfig(existingTriggerConfig);

const resolveUserBatchSize = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
) => {
  if (startNodeConfig.batchSize && startNodeConfig.batchSize !== 100) {
    return startNodeConfig.batchSize;
  }
  if (existingTriggerConfig?.batchSize) {
    return existingTriggerConfig.batchSize;
  }

  return 100;
};

const resolveExistingBatchSize = (
  existingTriggerConfig?: Record<string, unknown>
) => (existingTriggerConfig?.batchSize ? existingTriggerConfig.batchSize : 100);

const resolveBatchSize = (
  hasUserChanges: boolean,
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig?: Record<string, unknown>
) =>
  hasUserChanges
    ? resolveUserBatchSize(startNodeConfig, existingTriggerConfig)
    : resolveExistingBatchSize(existingTriggerConfig);

const buildDataAssetFilterObject = (dataAssetFilters: DataAssetFilter[]) => {
  const filterObj: Record<string, string> = {};
  dataAssetFilters.forEach((df: DataAssetFilter) => {
    const jsonLogicFilter = df.filters;
    if (jsonLogicFilter && jsonLogicFilter.trim() !== '') {
      filterObj[df.dataAsset] = jsonLogicFilter;
    }
  });

  return filterObj;
};

const resolveDataAssetFilters = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean
) => {
  if (
    hasUserChanges &&
    startNodeConfig.dataAssetFilters &&
    startNodeConfig.dataAssetFilters.length > 0
  ) {
    const filterObj = buildDataAssetFilterObject(
      startNodeConfig.dataAssetFilters
    );

    return Object.keys(filterObj).length > 0 ? filterObj : undefined;
  }

  return existingTriggerConfig?.filters;
};

const buildPeriodicBatchTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  existingTriggerConfig: Record<string, unknown> | undefined,
  hasUserChanges: boolean,
  hasStartNodeConfig: boolean
): Record<string, unknown> => {
  const finalTriggerConfig: Record<string, unknown> = {};
  const entityTypes = resolveEntityTypes(
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges,
    hasStartNodeConfig
  );

  // EntityTypes are required - must be provided
  if (entityTypes.length > 0) {
    finalTriggerConfig.entityTypes = entityTypes;
  }

  finalTriggerConfig.schedule = resolveScheduleConfig(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig
  );
  finalTriggerConfig.batchSize = resolveBatchSize(
    hasUserChanges,
    startNodeConfig,
    existingTriggerConfig
  );

  const filters = resolveDataAssetFilters(
    startNodeConfig,
    existingTriggerConfig,
    hasUserChanges
  );
  if (filters) {
    finalTriggerConfig.filters = filters;
  }

  return finalTriggerConfig;
};

const buildTriggerConfig = (
  startNodeConfig: NodeConfigWithMetadata,
  triggerType: string,
  existingTriggerConfig?: Record<string, unknown>
) => {
  const hasUserChanges = hasUserModifiedStartNode(startNodeConfig);
  const hasStartNodeConfig = hasConfiguredDataAssets(startNodeConfig);

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

// Ordered rules for AutomatedTask subtype detection - first match wins,
// mirroring the original if/else-if chain.
const AUTOMATED_TASK_SUBTYPE_RULES: Array<{
  subType: NodeSubType;
  matches: (subType?: NodeSubType, label?: string) => boolean;
}> = [
  {
    subType: NodeSubType.CheckChangeDescriptionTask,
    matches: (subType, label) =>
      subType === NodeSubType.CheckChangeDescriptionTask ||
      Boolean(label?.includes('Check Change Desc')),
  },
  {
    subType: NodeSubType.CheckEntityAttributesTask,
    matches: (subType, label) =>
      subType === NodeSubType.CheckEntityAttributesTask ||
      Boolean(label?.includes('Check')),
  },
  {
    subType: NodeSubType.SetEntityAttributeTask,
    matches: (subType, label) =>
      subType === NodeSubType.SetEntityAttributeTask ||
      Boolean(label?.includes('Set')),
  },
  {
    subType: NodeSubType.DataCompletenessTask,
    matches: (subType, label) =>
      subType === NodeSubType.DataCompletenessTask ||
      Boolean(label?.includes('Completeness')),
  },
  {
    subType: NodeSubType.RollbackEntityTask,
    matches: (subType, label) =>
      subType === NodeSubType.RollbackEntityTask ||
      Boolean(label?.includes('Roll')) ||
      Boolean(label?.includes('Revert')),
  },
];

const resolveAutomatedTaskSubType = (
  nodeData: { subType?: NodeSubType; label?: string },
  defaultSubType: NodeSubType
): NodeSubType => {
  const rule = AUTOMATED_TASK_SUBTYPE_RULES.find((r) =>
    r.matches(nodeData.subType, nodeData.label)
  );

  return rule ? rule.subType : defaultSubType;
};

const mapNodeTypeAndSubtype = (node: Node) => {
  const nodeData = node.data || {};
  let nodeType: NodeType = (node.type as NodeType) || NodeType.AutomatedTask;
  let subType: NodeSubType =
    nodeData.subType || NodeSubType.SetEntityAttributeTask;

  const isAutomatedTask =
    node.type === NodeType.AutomatedTask ||
    nodeData.nodeType === NodeType.AutomatedTask;
  const isUserTask =
    node.type === NodeType.UserTask || nodeData.nodeType === NodeType.UserTask;

  if (node.type === NodeType.StartEvent) {
    nodeType = NodeType.StartEvent;
    subType = NodeSubType.StartEvent;
  } else if (node.type === NodeType.EndEvent) {
    nodeType = NodeType.EndEvent;
    subType = NodeSubType.EndEvent;
  } else if (isAutomatedTask) {
    nodeType = NodeType.AutomatedTask;
    subType = resolveAutomatedTaskSubType(nodeData, subType);
  } else if (isUserTask) {
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

const isUpdatedByMigrationCandidate = (node: BackendNode): boolean =>
  (node.subType === NodeSubType.SetEntityAttributeTask ||
    node.subType === NodeSubType.RollbackEntityTask) &&
  Boolean(node.input?.includes('updatedBy'));

const shouldMigrateUpdatedBy = (
  currentUpdatedBy: string | undefined,
  allPredecessors: string[],
  nodes: BackendNode[]
): boolean => {
  const isKnownGlobalUpdatedBy =
    currentUpdatedBy === 'global' ||
    currentUpdatedBy === 'ApproveGlossaryTerm' ||
    currentUpdatedBy === 'ApprovalForUpdates';
  const isMissingUpdatedByReference = Boolean(
    currentUpdatedBy &&
      (!nodes.some((n) => n.name === currentUpdatedBy) ||
        !allPredecessors.includes(currentUpdatedBy))
  );

  return isKnownGlobalUpdatedBy || isMissingUpdatedByReference;
};

const resolveMigratedUpdatedBy = (
  allPredecessors: string[],
  userTasks: BackendNode[]
): string => {
  // Only use a user task that is actually a predecessor (comes before this node)
  const predecessorUserTask = userTasks.find((userTask) =>
    allPredecessors.includes(userTask.name)
  );

  return predecessorUserTask ? predecessorUserTask.name : 'global';
};

const migrateNode = (
  node: BackendNode,
  nodes: BackendNode[],
  edges: BackendEdge[],
  userTasks: BackendNode[]
): BackendNode => {
  if (!isUpdatedByMigrationCandidate(node)) {
    return node;
  }

  const currentUpdatedBy = node.inputNamespaceMap?.updatedBy;
  const allPredecessors = findAllPredecessorsInSave(node.name, edges);

  if (!shouldMigrateUpdatedBy(currentUpdatedBy, allPredecessors, nodes)) {
    return node;
  }

  return {
    ...node,
    inputNamespaceMap: {
      ...node.inputNamespaceMap,
      updatedBy: resolveMigratedUpdatedBy(allPredecessors, userTasks),
    },
  };
};

const migrateInputNamespaceMap = (
  nodes: BackendNode[],
  edges: BackendEdge[]
): BackendNode[] => {
  const userTasks = nodes.filter((n) => n.type === NodeType.UserTask);

  return nodes.map((node) => migrateNode(node, nodes, edges, userTasks));
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
) => ({
  workflowName: workflowDefinition?.name || 'CustomWorkflow',
  workflowDisplayName:
    workflowMetadata?.displayName ||
    workflowDefinition?.displayName ||
    'Custom Workflow',
  workflowDescription:
    workflowMetadata?.description ||
    workflowDefinition?.description ||
    'Custom workflow created with Workflow Builder',
});

// The generated `trigger` type is a wide union (schema oneOf); this narrows it
// to the actual TriggerObject shape used by both `.type` and `.config` lookups.
const getValidTriggerObject = (
  workflowDefinition: WorkflowDefinition | null
): TriggerObject | undefined => {
  const trigger = workflowDefinition?.trigger;
  if (
    typeof trigger === 'object' &&
    trigger !== null &&
    !Array.isArray(trigger)
  ) {
    return trigger as TriggerObject;
  }

  return undefined;
};

const resolveTriggerEntityTypes = (
  finalTriggerConfig: Record<string, unknown>
): string[] =>
  Array.isArray((finalTriggerConfig as { entityTypes?: unknown }).entityTypes)
    ? (finalTriggerConfig as { entityTypes: string[] }).entityTypes ?? []
    : [];

const assertTriggerHasEntityTypes = (
  triggerType: Type,
  triggerEntityTypes: string[]
): void => {
  if (
    (triggerType === Type.EventBasedEntity ||
      triggerType === Type.PeriodicBatchEntity) &&
    triggerEntityTypes.length === 0
  ) {
    throw new Error(i18next.t('message.workflow-trigger-requires-data-assets'));
  }
};

export const buildWorkflowForSave = async (
  nodes: Node[],
  edges: Edge[],
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: { displayName?: string; description?: string } | null
): Promise<WorkflowDefinition> => {
  const { workflowName, workflowDisplayName, workflowDescription } =
    resolveWorkflowMetadata(workflowDefinition, workflowMetadata);

  const startNode = nodes.find((node) => node.type === NodeType.StartEvent);
  const startNodeConfig = (startNode?.data || {}) as NodeConfigWithMetadata;

  const currentNodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (edge) => currentNodeIds.has(edge.source) && currentNodeIds.has(edge.target)
  );

  const validTrigger = getValidTriggerObject(workflowDefinition);
  const hasUserChanges = hasUserModifiedStartNode(startNodeConfig);
  const hasStartNodeConfig = hasConfiguredDataAssets(startNodeConfig);

  const triggerType = resolveTriggerType(
    hasUserChanges,
    hasStartNodeConfig,
    startNodeConfig,
    validTrigger?.type
  );

  const finalTriggerConfig = buildTriggerConfig(
    startNodeConfig,
    triggerType,
    validTrigger?.config
  );

  const triggerEntityTypes = resolveTriggerEntityTypes(finalTriggerConfig);
  assertTriggerHasEntityTypes(triggerType, triggerEntityTypes);

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

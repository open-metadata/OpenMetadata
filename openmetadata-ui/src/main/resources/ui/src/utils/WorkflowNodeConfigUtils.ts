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

import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import {
  BackendEdge,
  NodeConfiguration,
  NodeDataWithMetadata,
} from '../interface/WorkflowTypes.interface';

export const findPathBetweenNodes = (
  sourceId: string,
  targetId: string,
  edges: BackendEdge[]
): boolean => {
  if (sourceId === targetId) {
    return true;
  }

  const visited = new Set<string>();
  const queue = [sourceId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    const outgoingEdges = edges.filter((edge) => edge.from === currentId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return false;
};

export const getNodeName = (
  subType: string,
  nodeId: string,
  allNodes: NodeDataWithMetadata[]
): string => {
  if (subType === NodeSubType.StartEvent) {
    return 'start';
  }

  // Check if the current node already has a name property
  const currentNode = allNodes.find((n) => n.id === nodeId);
  if (currentNode?.name) {
    // Preserve the existing node name to maintain consistency across migrations
    return currentNode.name;
  }

  // For new nodes, generate a unique name that doesn't conflict with existing ones
  // Collect all existing names for this subType
  const existingNames = new Set(
    allNodes
      .filter((n) => n.subType === subType && n.name)
      .map((n) => n.name)
      .filter(Boolean)
  );

  // Find the next available number suffix
  let count = 1;
  let proposedName = `${subType}_${count}`;

  while (existingNames.has(proposedName)) {
    count++;
    proposedName = `${subType}_${count}`;
  }

  return proposedName;
};

const applySetEntityAttributeConfig = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  const fieldName = nodeData.fieldName || nodeData.config?.fieldName;
  const fieldValue = nodeData.fieldValue || nodeData.config?.fieldValue;
  if (!fieldName && !fieldValue) {
    return;
  }
  config.config = {};
  if (fieldName) {
    config.config.fieldName = fieldName;
  }
  if (fieldValue) {
    config.config.fieldValue = fieldValue;
  } else if (config.config.fieldName) {
    config.config.fieldValue = '';
  }
};

const applyCheckEntityAttributesConfig = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  const rules = nodeData.rules || nodeData.config?.rules;
  if (!rules) {
    return;
  }
  config.config = {
    rules: typeof rules === 'object' ? JSON.stringify(rules) : rules,
  };
};

const applyDataCompletenessConfig = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  const qualityBands = nodeData.qualityBands || nodeData.config?.qualityBands;
  const fieldsToCheck =
    nodeData.fieldsToCheck || nodeData.config?.fieldsToCheck;
  if (!qualityBands && !fieldsToCheck) {
    return;
  }
  config.config = {};
  if (qualityBands) {
    config.config.qualityBands = qualityBands;
  }
  if (fieldsToCheck) {
    config.config.fieldsToCheck = fieldsToCheck;
  }
};

const applyCheckChangeDescriptionConfig = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  if (!nodeData.config || typeof nodeData.config !== 'object') {
    return;
  }
  const cfg = nodeData.config as {
    condition?: 'AND' | 'OR';
    rules?: Record<string, string[]>;
  };
  const hasValidRules =
    cfg.rules && typeof cfg.rules === 'object' && !Array.isArray(cfg.rules);
  config.config = {
    condition: cfg.condition ?? 'OR',
    rules: hasValidRules ? cfg.rules : {},
  };
};

const applyPassthroughConfig = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  if (nodeData.config && Object.keys(nodeData.config).length > 0) {
    config.config = nodeData.config;
  }
};

const NODE_SPECIFIC_CONFIG_HANDLERS: Record<
  string,
  (config: NodeConfiguration, nodeData: NodeDataWithMetadata) => void
> = {
  [NodeSubType.SetEntityAttributeTask]: applySetEntityAttributeConfig,
  [NodeSubType.CheckEntityAttributesTask]: applyCheckEntityAttributesConfig,
  [NodeSubType.DataCompletenessTask]: applyDataCompletenessConfig,
  [NodeSubType.CheckChangeDescriptionTask]: applyCheckChangeDescriptionConfig,
  [NodeSubType.RollbackEntityTask]: applyPassthroughConfig,
  [NodeSubType.SinkTask]: applyPassthroughConfig,
};

const addNodeSpecificConfig = (
  config: NodeConfiguration,
  subType: string,
  nodeData: NodeDataWithMetadata
): void => {
  const handler = NODE_SPECIFIC_CONFIG_HANDLERS[subType];
  handler?.(config, nodeData);
};

// Most automated tasks require input: ["relatedEntity", "updatedBy"]
// Exception: checkEntityAttributesTask, checkChangeDescriptionTask and
// dataCompletenessTask only need ["relatedEntity"]
const AUTOMATED_TASK_SINGLE_INPUT_SUBTYPES: string[] = [
  NodeSubType.CheckEntityAttributesTask,
  NodeSubType.CheckChangeDescriptionTask,
  NodeSubType.DataCompletenessTask,
];

const AUTOMATED_TASK_OUTPUT_MAP: Record<
  string,
  { output: string[]; branches?: string[] }
> = {
  [NodeSubType.CheckEntityAttributesTask]: {
    output: ['result'],
    branches: ['true', 'false'],
  },
  [NodeSubType.CheckChangeDescriptionTask]: {
    output: ['result'],
    branches: ['true', 'false'],
  },
  [NodeSubType.DataCompletenessTask]: {
    output: [
      'completenessScore',
      'qualityBand',
      'filledFieldsCount',
      'totalFieldsCount',
      'missingFields',
      'filledFields',
      'result',
    ],
  },
  [NodeSubType.SinkTask]: {
    output: ['syncResult', 'syncedCount', 'failedCount', 'result'],
    branches: ['success', 'failure'],
  },
};

const configureAutomatedTaskIO = (
  config: NodeConfiguration,
  subType: string,
  nodeData: NodeDataWithMetadata
): void => {
  config.input = AUTOMATED_TASK_SINGLE_INPUT_SUBTYPES.includes(subType)
    ? ['relatedEntity']
    : ['relatedEntity', 'updatedBy'];

  const outputConfig = AUTOMATED_TASK_OUTPUT_MAP[subType];
  config.output = outputConfig?.output ?? [];
  if (outputConfig?.branches) {
    config.branches = outputConfig.branches;
  }

  addNodeSpecificConfig(config, subType, nodeData);
};

const applyUserApprovalConfig = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  const assigneesFromNode = nodeData.config?.assignees as
    | {
        addReviewers?: boolean;
        addOwners?: boolean;
        emptyAssigneeStrategy?: 'none' | 'assignAdmins';
        candidates?: Array<{
          id: string;
          type: string;
          fullyQualifiedName?: string;
          name?: string;
        }>;
      }
    | undefined;
  config.config = {};
  config.config.assignees = {
    addReviewers: assigneesFromNode?.addReviewers ?? true,
    addOwners: assigneesFromNode?.addOwners ?? false,
    emptyAssigneeStrategy: assigneesFromNode?.emptyAssigneeStrategy ?? 'none',
    candidates: assigneesFromNode?.candidates ?? [],
  };
  config.config.approvalThreshold =
    nodeData.approvalThreshold ?? nodeData.config?.approvalThreshold ?? 1;

  config.config.rejectionThreshold =
    nodeData.rejectionThreshold ?? nodeData.config?.rejectionThreshold ?? 1;
};

const configureUserTaskIO = (
  config: NodeConfiguration,
  subType: string,
  nodeData: NodeDataWithMetadata
): void => {
  config.input = ['relatedEntity'];
  config.output = ['updatedBy'];
  config.branches = ['true', 'false'];

  if (subType === NodeSubType.UserApprovalTask) {
    applyUserApprovalConfig(config, nodeData);
  }
};

export const configureNodeInputOutput = (
  config: NodeConfiguration,
  nodeType: string,
  subType: string,
  nodeData: NodeDataWithMetadata
): NodeConfiguration => {
  if (nodeType === NodeType.StartEvent || nodeType === NodeType.EndEvent) {
    return config;
  }

  if (nodeType === NodeType.AutomatedTask) {
    configureAutomatedTaskIO(config, subType, nodeData);
  }

  if (nodeType === NodeType.UserTask) {
    configureUserTaskIO(config, subType, nodeData);
  }

  return config;
};

// Resolve the namespace for the "updatedBy" input by finding the nearest
// preceding user-approval task, falling back to any user task, then 'global'.
const resolveUpdatedByNamespace = (
  nodeData: NodeDataWithMetadata,
  allNodes: NodeDataWithMetadata[],
  allEdges: BackendEdge[]
): string => {
  if (allEdges.length === 0) {
    // No edges available, find any user task (fallback for edge case)
    const userTaskNode = allNodes.find(
      (node) => node.subType === NodeSubType.UserApprovalTask
    );

    return userTaskNode ? userTaskNode.name || userTaskNode.id : 'global';
  }

  const currentNodeId = nodeData.id;
  const userTasks = allNodes.filter(
    (node) => node.subType === NodeSubType.UserApprovalTask
  );

  for (const userTask of userTasks) {
    const hasPath = findPathBetweenNodes(userTask.id, currentNodeId, allEdges);
    if (hasPath) {
      // Use the actual node name as the namespace for backend reference
      return userTask.name || userTask.id;
    }
  }

  return 'global';
};

// Apply user overrides with selective filtering
const applyNamespaceOverrides = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata
): void => {
  if (
    !nodeData.inputNamespaceMap ||
    Object.keys(nodeData.inputNamespaceMap).length === 0
  ) {
    return;
  }

  const filteredOverrides: Record<string, string> = {};
  Object.entries(nodeData.inputNamespaceMap).forEach(([key, value]) => {
    const isRedundantGlobalUpdatedBy =
      key === 'updatedBy' &&
      value === 'global' &&
      config.inputNamespaceMap?.updatedBy !== 'global';
    if (isRedundantGlobalUpdatedBy) {
      return;
    }
    if (typeof value === 'string') {
      filteredOverrides[key] = value;
    }
  });

  config.inputNamespaceMap = {
    ...(config.inputNamespaceMap || {}),
    ...filteredOverrides,
  };
};

// Configure input namespace mapping
export const configureInputNamespaceMap = (
  config: NodeConfiguration,
  nodeData: NodeDataWithMetadata,
  allNodes: NodeDataWithMetadata[],
  allEdges: BackendEdge[]
): NodeConfiguration => {
  if (!config.input || config.input.length === 0) {
    return config;
  }

  config.inputNamespaceMap = {};

  if (config.input.includes('relatedEntity')) {
    config.inputNamespaceMap.relatedEntity = 'global';
  }

  if (config.input.includes('updatedBy')) {
    config.inputNamespaceMap.updatedBy = resolveUpdatedByNamespace(
      nodeData,
      allNodes,
      allEdges
    );
  }

  applyNamespaceOverrides(config, nodeData);

  return config;
};

// Main node configuration function
export const getNodeConfiguration = (
  nodeType: string,
  subType: string,
  nodeData: NodeDataWithMetadata,
  allNodes: NodeDataWithMetadata[] = [],
  allEdges: BackendEdge[] = []
): NodeConfiguration => {
  const nodeName = getNodeName(subType, nodeData.id, allNodes);

  let config: NodeConfiguration = {
    type: nodeType,
    subType: subType,
    name: nodeName,
    displayName: nodeData.displayName || nodeData.label || nodeData.id,
  };

  // Configure input/output/config rules
  config = configureNodeInputOutput(config, nodeType, subType, nodeData);

  // Configure input namespace mapping
  config = configureInputNamespaceMap(config, nodeData, allNodes, allEdges);

  return config;
};

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

const addNodeSpecificConfig = (
  config: NodeConfiguration,
  subType: string,
  nodeData: NodeDataWithMetadata
): void => {
  if (subType === NodeSubType.SetEntityAttributeTask) {
    if (
      nodeData.fieldName ||
      nodeData.fieldValue ||
      nodeData.config?.fieldName ||
      nodeData.config?.fieldValue
    ) {
      config.config = {};
      if (nodeData.fieldName || nodeData.config?.fieldName) {
        config.config.fieldName =
          nodeData.fieldName || nodeData.config?.fieldName;
      }
      if (nodeData.fieldValue || nodeData.config?.fieldValue) {
        config.config.fieldValue =
          nodeData.fieldValue || nodeData.config?.fieldValue;
      } else if (config.config.fieldName) {
        config.config.fieldValue = '';
      }
    }
  } else if (subType === NodeSubType.CheckEntityAttributesTask) {
    if (nodeData.rules || nodeData.config?.rules) {
      let rulesString = nodeData.rules || nodeData.config?.rules;
      if (typeof rulesString === 'object') {
        rulesString = JSON.stringify(rulesString);
      }
      config.config = {
        rules: rulesString,
      };
    }
  } else if (subType === NodeSubType.DataCompletenessTask) {
    if (
      nodeData.qualityBands ||
      nodeData.fieldsToCheck ||
      nodeData.config?.qualityBands ||
      nodeData.config?.fieldsToCheck
    ) {
      config.config = {};
      if (nodeData.qualityBands || nodeData.config?.qualityBands) {
        config.config.qualityBands =
          nodeData.qualityBands || nodeData.config?.qualityBands;
      }
      if (nodeData.fieldsToCheck || nodeData.config?.fieldsToCheck) {
        config.config.fieldsToCheck =
          nodeData.fieldsToCheck || nodeData.config?.fieldsToCheck;
      }
    }
  } else if (subType === NodeSubType.CheckChangeDescriptionTask) {
    if (nodeData.config && typeof nodeData.config === 'object') {
      const cfg = nodeData.config as {
        condition?: 'AND' | 'OR';
        rules?: Record<string, string[]>;
      };
      config.config = {
        condition: cfg.condition ?? 'OR',
        rules:
          cfg.rules &&
          typeof cfg.rules === 'object' &&
          !Array.isArray(cfg.rules)
            ? cfg.rules
            : {},
      };
    }
  } else if (subType === NodeSubType.RollbackEntityTask) {
    if (nodeData.config && Object.keys(nodeData.config).length > 0) {
      config.config = nodeData.config;
    }
  } else if (subType === NodeSubType.SinkTask) {
    if (nodeData.config && Object.keys(nodeData.config).length > 0) {
      config.config = nodeData.config;
    }
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
    // Most automated tasks require input: ["relatedEntity", "updatedBy"]
    // Exception: checkEntityAttributesTask and dataCompletenessTask only need ["relatedEntity"]
    if (
      subType === NodeSubType.CheckEntityAttributesTask ||
      subType === NodeSubType.CheckChangeDescriptionTask ||
      subType === NodeSubType.DataCompletenessTask
    ) {
      config.input = ['relatedEntity'];
    } else {
      config.input = ['relatedEntity', 'updatedBy'];
    }

    // Configure output based on subType
    if (subType === NodeSubType.CheckEntityAttributesTask) {
      config.output = ['result'];
      config.branches = ['true', 'false'];
    } else if (subType === NodeSubType.CheckChangeDescriptionTask) {
      config.output = ['result'];
      config.branches = ['true', 'false'];
    } else if (subType === NodeSubType.DataCompletenessTask) {
      config.output = [
        'completenessScore',
        'qualityBand',
        'filledFieldsCount',
        'totalFieldsCount',
        'missingFields',
        'filledFields',
        'result',
      ];
    } else if (subType === NodeSubType.SinkTask) {
      config.output = ['syncResult', 'syncedCount', 'failedCount', 'result'];
      config.branches = ['success', 'failure'];
    } else {
      config.output = [];
    }
    addNodeSpecificConfig(config, subType, nodeData);
  }

  if (nodeType === NodeType.UserTask) {
    config.input = ['relatedEntity'];
    config.output = ['updatedBy'];
    config.branches = ['true', 'false'];

    if (subType === NodeSubType.UserApprovalTask) {
      const assigneesFromNode = nodeData.config?.assignees as
        | {
            addReviewers?: boolean;
            addOwners?: boolean;
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
        candidates: assigneesFromNode?.candidates ?? [],
      };
      config.config.approvalThreshold =
        nodeData.approvalThreshold ?? nodeData.config?.approvalThreshold ?? 1;

      config.config.rejectionThreshold =
        nodeData.rejectionThreshold ?? nodeData.config?.rejectionThreshold ?? 1;
    }
  }

  return config;
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
    let userTaskNamespace = 'global';

    if (allEdges.length > 0) {
      const currentNodeId = nodeData.id;

      const userTasks = allNodes.filter(
        (node) => node.subType === NodeSubType.UserApprovalTask
      );

      for (const userTask of userTasks) {
        const userTaskId = userTask.id;

        const hasPath = findPathBetweenNodes(
          userTaskId,
          currentNodeId,
          allEdges
        );
        if (hasPath) {
          // Use the actual node name as the namespace for backend reference
          userTaskNamespace = userTask.name || userTask.id;

          break;
        }
      }
    } else {
      // No edges available, find any user task (fallback for edge case)
      const userTaskNode = allNodes.find(
        (node) => node.subType === NodeSubType.UserApprovalTask
      );
      if (userTaskNode) {
        userTaskNamespace = userTaskNode.name || userTaskNode.id;
      }
    }

    config.inputNamespaceMap.updatedBy = userTaskNamespace;
  }

  // Apply user overrides with selective filtering
  if (
    nodeData.inputNamespaceMap &&
    Object.keys(nodeData.inputNamespaceMap).length > 0
  ) {
    const filteredOverrides: Record<string, string> = {};
    Object.entries(nodeData.inputNamespaceMap).forEach(([key, value]) => {
      if (
        key === 'updatedBy' &&
        value === 'global' &&
        config.inputNamespaceMap?.updatedBy !== 'global'
      ) {
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
  }

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

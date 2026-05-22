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

import { Node } from 'reactflow';
import {
  CONNECTION_MODAL_RULES,
  NODE_TYPE_MAPPINGS,
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
import { CustomNodeData } from '../interface/WorkflowBuilder.interface';
import {
  deserializeEventBasedFilters,
  deserializePeriodicBatchFilters,
} from './WorkflowSerializationUtils';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const getLabelFromSubType = (subType: NodeSubType): string => {
  const mapping =
    NODE_TYPE_MAPPINGS[subType as keyof typeof NODE_TYPE_MAPPINGS];

  return mapping?.label || subType;
};

export const getDisplayLabelFromSubType = (
  subType: NodeSubType | undefined
): string => {
  if (!subType) {
    return 'TASK';
  }

  const mapping =
    NODE_TYPE_MAPPINGS[subType as keyof typeof NODE_TYPE_MAPPINGS];

  return mapping?.displayLabel || subType.toUpperCase() || 'TASK';
};

export const getTypeFromSubType = (subType: NodeSubType): NodeType => {
  const mapping =
    NODE_TYPE_MAPPINGS[subType as keyof typeof NODE_TYPE_MAPPINGS];

  return mapping?.type || NodeType.AutomatedTask;
};

export const getSubTypeFromLabel = (label: string): NodeSubType => {
  const mapping = Object.entries(NODE_TYPE_MAPPINGS).find(
    ([, value]) => value.label === label
  );

  return (mapping?.[0] as NodeSubType) || NodeSubType.CheckEntityAttributesTask;
};

export const createNodeData = (
  label: string,
  _type: string,
  nodeId: string
): CustomNodeData => {
  const subType = getSubTypeFromLabel(label);
  const nodeType = getTypeFromSubType(subType);

  const baseData: CustomNodeData = {
    label,
    type: nodeType,
    name: nodeId, // This will be replaced by getNodeName in the workflow logic
    displayName: label,
    subType,
  };

  return baseData;
};

// Counter for generating unique node IDs
let nodeIdCounter = 1;

export const generateNodeId = (type: string): string => {
  return `${type}_${nodeIdCounter++}`;
};

export const shouldUseConfigSidebar = (nodeType: string): boolean => {
  return nodeType !== '';
};

export const shouldShowForm = (nodeType: string): boolean => {
  return nodeType !== '';
};

export const shouldShowConnectionModal = (
  sourceNode: Node | undefined,
  targetNode: Node | undefined
): boolean => {
  if (!sourceNode || !targetNode) {
    return false;
  }

  if (sourceNode.type === NodeType.StartEvent) {
    return false;
  }

  if (
    sourceNode.data?.subType &&
    CONNECTION_MODAL_RULES.NEVER_SHOW_SOURCES.includes(sourceNode.data.subType)
  ) {
    return false;
  }

  if (
    sourceNode.data?.subType &&
    CONNECTION_MODAL_RULES.ALWAYS_SHOW_SOURCES.includes(sourceNode.data.subType)
  ) {
    return true;
  }

  return false;
};

export const isStartNode = (node: Node | null): boolean => {
  if (!node) {
    return false;
  }

  return (
    node.type === NodeType.StartEvent ||
    node.data?.subType === NodeSubType.StartEvent
  );
};

export const getNodeTitle = (node: Node | null): string => {
  if (!node) {
    return 'Node Configuration';
  }
  if (isStartNode(node)) {
    return 'Start Node Configuration';
  }
  const subType = node.data?.subType;

  return subType
    ? `${getLabelFromSubType(subType)} Configuration`
    : 'Node Configuration';
};

export const convertDisplayToBackendTriggerType = (
  displayType: string
): string => {
  switch (displayType) {
    case 'Event Based':
      return 'eventBasedEntity';
    case 'Periodic Batch':
      return 'periodicBatchEntity';
    default:
      return displayType;
  }
};

export const convertBackendToDisplayTriggerType = (
  backendType: string
): string => {
  switch (backendType) {
    case 'eventBasedEntity':
      return 'Event Based';
    case 'periodicBatchEntity':
      return 'Periodic Batch';
    default:
      return backendType;
  }
};

export const getInitialNodeConfig = (
  node: Node,
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: {
    name: string;
    displayName: string;
    description: string;
    createdAt?: string;
    isNewWorkflow?: boolean;
    id?: string;
  } | null
): NodeConfig => {
  if (node.data && (node.data.lastSaved || node.data.userModified)) {
    return {
      name: node.data.name || '',
      description: node.data.description || '',
      dataAssets: node.data.dataAssets || [],
      triggerType: node.data.triggerType,
      eventType: node.data.eventType || ['Created', 'Updated'],
      excludeFields: node.data.excludeFields || [],
      include: Array.isArray(node.data.include) ? node.data.include : [],
      scheduleType: node.data.scheduleType || '',
      cronExpression: node.data.cronExpression || '',
      batchSize: node.data.batchSize || 100,
      dataAssetFilters: node.data.dataAssetFilters || [],
      triggerFilter: node.data.triggerFilter || '',
    };
  }

  if (isStartNode(node) && workflowDefinition) {
    const trigger = workflowDefinition.trigger;
    const config = isPlainObject(trigger) ? trigger.config || {} : {};
    const entityTypes = config.entityTypes || [];

    let dataAssetFilters: DataAssetFilter[] = [];
    if (
      isPlainObject(trigger) &&
      trigger.type === Type.PeriodicBatchEntity &&
      config.filters
    ) {
      dataAssetFilters = deserializePeriodicBatchFilters(
        config.filters,
        entityTypes
      );
    }

    let triggerFilter = '';
    if (
      isPlainObject(trigger) &&
      trigger.type === Type.EventBasedEntity &&
      config.filter
    ) {
      triggerFilter = deserializeEventBasedFilters(
        config.filter as Record<string, string>,
        entityTypes
      );
    }

    return {
      name:
        workflowMetadata?.displayName || workflowDefinition.displayName || '',
      description:
        workflowMetadata?.description || workflowDefinition.description || '',
      dataAssets: entityTypes,
      triggerType: convertBackendToDisplayTriggerType(
        isPlainObject(trigger) ? trigger.type || '' : ''
      ),
      eventType:
        config.events && config.events.length > 0
          ? config.events
          : ['Created', 'Updated'],
      excludeFields:
        config.exclude && Array.isArray(config.exclude) ? config.exclude : [],
      include: Array.isArray(config.include) ? config.include : [],
      scheduleType:
        config.schedule?.scheduleTimeline === ScheduleTimeline.None
          ? 'OnDemand'
          : config.schedule?.scheduleTimeline === ScheduleTimeline.Custom &&
            config.schedule?.cronExpression
          ? 'Scheduled'
          : '',
      cronExpression: config.schedule?.cronExpression || '',
      batchSize: config.batchSize || 500,
      dataAssetFilters,
      triggerFilter,
    };
  }

  return {
    name: node?.data?.displayName || node?.data?.label || '',
    description: node?.data?.description || '',
    dataAssets: [],
    triggerType: 'Event Based',
    eventType: ['Created', 'Updated'],
    dataAssetFilters: [],
    excludeFields: [],
    include: node?.data?.include ?? [],
    triggerFilter: '',
    scheduleType: '',
    cronExpression: '',
    batchSize: 100,
  };
};

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

import type { Node } from 'reactflow';
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

const EVENT_BASED_TRIGGER_TYPE = 'Event Based';

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
    case EVENT_BASED_TRIGGER_TYPE:
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
      return EVENT_BASED_TRIGGER_TYPE;
    case 'periodicBatchEntity':
      return 'Periodic Batch';
    default:
      return backendType;
  }
};

type WorkflowMetadata = {
  name: string;
  displayName: string;
  description: string;
  createdAt?: string;
  isNewWorkflow?: boolean;
  id?: string;
};

// getInitialNodeConfig's three branches extracted to standalone functions —
// each returns a fully-formed NodeConfig for one node "shape", keeping the
// dispatcher itself and each branch's own complexity down.

// Small fallback helpers so each NodeConfig field can be one function call
// instead of an inline `||`/`Array.isArray(...) ? ... : []` — every operator
// left inline in an object-literal return adds to that function's own
// cyclomatic complexity, so these keep the field lists flat.
const orDefault = <T, F>(value: T, fallback: F) => value || fallback;

const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

// A node that was already saved/edited carries its own config verbatim.
const getNodeConfigFromSavedData = (node: Node): NodeConfig => ({
  name: orDefault(node.data.name, ''),
  description: orDefault(node.data.description, ''),
  dataAssets: orDefault(node.data.dataAssets, []),
  triggerType: node.data.triggerType,
  eventType: orDefault(node.data.eventType, ['Created', 'Updated']),
  excludeFields: orDefault(node.data.excludeFields, []),
  include: asArray(node.data.include),
  scheduleType: orDefault(node.data.scheduleType, ''),
  cronExpression: orDefault(node.data.cronExpression, ''),
  batchSize: orDefault(node.data.batchSize, 100),
  dataAssetFilters: orDefault(node.data.dataAssetFilters, []),
  triggerFilter: orDefault(node.data.triggerFilter, ''),
});

const getTriggerConfig = (trigger: WorkflowDefinition['trigger']) =>
  isPlainObject(trigger) ? orDefault(trigger.config, {}) : {};

type TriggerConfig = ReturnType<typeof getTriggerConfig>;

const getStartNodeScheduleType = (config: TriggerConfig): string => {
  if (config.schedule?.scheduleTimeline === ScheduleTimeline.None) {
    return 'OnDemand';
  }
  if (
    config.schedule?.scheduleTimeline === ScheduleTimeline.Custom &&
    config.schedule?.cronExpression
  ) {
    return 'Scheduled';
  }

  return '';
};

const getStartNodeDataAssetFilters = (
  trigger: WorkflowDefinition['trigger'],
  config: TriggerConfig,
  entityTypes: string[]
): DataAssetFilter[] => {
  if (
    isPlainObject(trigger) &&
    trigger.type === Type.PeriodicBatchEntity &&
    config.filters
  ) {
    return deserializePeriodicBatchFilters(config.filters, entityTypes);
  }

  return [];
};

const getStartNodeTriggerFilter = (
  trigger: WorkflowDefinition['trigger'],
  config: TriggerConfig,
  entityTypes: string[]
): string => {
  if (
    isPlainObject(trigger) &&
    trigger.type === Type.EventBasedEntity &&
    config.filter
  ) {
    return deserializeEventBasedFilters(
      config.filter as Record<string, string>,
      entityTypes
    );
  }

  return '';
};

const getStartNodeTriggerType = (
  trigger: WorkflowDefinition['trigger']
): string =>
  convertBackendToDisplayTriggerType(
    isPlainObject(trigger) ? orDefault(trigger.type, '') : ''
  );

const getStartNodeEventType = (config: TriggerConfig): string[] =>
  config.events && config.events.length > 0
    ? config.events
    : ['Created', 'Updated'];

const getStartNodeExcludeFields = (config: TriggerConfig): string[] =>
  config.exclude && Array.isArray(config.exclude)
    ? asArray(config.exclude)
    : [];

// The start node's config is derived from the workflow definition's trigger.
const getNodeConfigFromStartNode = (
  workflowDefinition: WorkflowDefinition,
  workflowMetadata?: WorkflowMetadata | null
): NodeConfig => {
  const trigger = workflowDefinition.trigger;
  const config = getTriggerConfig(trigger);
  const entityTypes = orDefault(config.entityTypes, []);

  return {
    name: orDefault(
      workflowMetadata?.displayName,
      orDefault(workflowDefinition.displayName, '')
    ),
    description: orDefault(
      workflowMetadata?.description,
      orDefault(workflowDefinition.description, '')
    ),
    dataAssets: entityTypes,
    triggerType: getStartNodeTriggerType(trigger),
    eventType: getStartNodeEventType(config),
    excludeFields: getStartNodeExcludeFields(config),
    include: asArray(config.include),
    scheduleType: getStartNodeScheduleType(config),
    cronExpression: orDefault(config.schedule?.cronExpression, ''),
    batchSize: orDefault(config.batchSize, 500),
    dataAssetFilters: getStartNodeDataAssetFilters(
      trigger,
      config,
      entityTypes
    ),
    triggerFilter: getStartNodeTriggerFilter(trigger, config, entityTypes),
  };
};

// A brand-new, non-start node falls back to generic defaults.
const getDefaultNodeConfig = (node: Node): NodeConfig => ({
  name: node?.data?.displayName || node?.data?.label || '',
  description: node?.data?.description || '',
  dataAssets: [],
  triggerType: EVENT_BASED_TRIGGER_TYPE,
  eventType: ['Created', 'Updated'],
  dataAssetFilters: [],
  excludeFields: [],
  include: node?.data?.include ?? [],
  triggerFilter: '',
  scheduleType: '',
  cronExpression: '',
  batchSize: 100,
});

export const getInitialNodeConfig = (
  node: Node,
  workflowDefinition: WorkflowDefinition | null,
  workflowMetadata?: WorkflowMetadata | null
): NodeConfig => {
  if (node.data && (node.data.lastSaved || node.data.userModified)) {
    return getNodeConfigFromSavedData(node);
  }

  if (isStartNode(node) && workflowDefinition) {
    return getNodeConfigFromStartNode(workflowDefinition, workflowMetadata);
  }

  return getDefaultNodeConfig(node);
};

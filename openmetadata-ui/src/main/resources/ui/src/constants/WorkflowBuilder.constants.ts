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

import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { Event } from '../generated/api/governance/createWorkflowDefinition';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import { Type } from '../generated/governance/workflows/workflowDefinition';
import { WorkflowStatus } from '../generated/governance/workflows/workflowInstance';
import { WORKFLOW_DATA_ASSETS_LIST } from '../utils/WorkflowsUtils';

export enum ConditionValue {
  TRUE = 'TRUE',
  FALSE = 'FALSE',
}

export enum SchedularOptions {
  SCHEDULE = 'Scheduled',
  ON_DEMAND = 'OnDemand',
}

export enum WorkflowType {
  EVENT_BASED = 'Event Based',
  PERIODIC_BATCH = 'Periodic Batch',
}

export enum ScheduleConfig {
  SCHEDULE_TYPE = 'scheduleType',
  CRON_EXPRESSION = 'cronExpression',
}

export const CONNECTION_MODAL_RULES = {
  ALWAYS_SHOW_SOURCES: [
    NodeSubType.CheckEntityAttributesTask,
    NodeSubType.CheckChangeDescriptionTask,
    NodeSubType.UserApprovalTask,
    NodeSubType.DataCompletenessTask,
  ],
  NEVER_SHOW_SOURCES: [
    NodeSubType.SetEntityAttributeTask,
    NodeSubType.RollbackEntityTask,
  ],
} as const;

export const NODE_TYPE_MAPPINGS = {
  [NodeSubType.CheckEntityAttributesTask]: {
    type: NodeType.AutomatedTask,
    label: 'Check Condition',
    displayLabel: 'Check',
  },
  [NodeSubType.CheckChangeDescriptionTask]: {
    type: NodeType.AutomatedTask,
    label: 'Detect Field Change',
    displayLabel: 'Detect Field Change',
  },
  [NodeSubType.SetEntityAttributeTask]: {
    type: NodeType.AutomatedTask,
    label: 'Set Action',
    displayLabel: 'Action',
  },
  [NodeSubType.UserApprovalTask]: {
    type: NodeType.UserTask,
    label: 'Request Approval',
    displayLabel: 'User Approval',
  },
  [NodeSubType.DataCompletenessTask]: {
    type: NodeType.AutomatedTask,
    label: 'Data Completeness',
    displayLabel: 'Data Completeness',
  },
  [NodeSubType.RollbackEntityTask]: {
    type: NodeType.AutomatedTask,
    label: 'Revert Changes',
    displayLabel: 'Revert Changes',
  },
  [NodeSubType.SinkTask]: {
    type: NodeType.AutomatedTask,
    category: 'sink',
    label: 'Git Sink',
    displayLabel: 'Git Sink',
  },
  [NodeSubType.StartEvent]: {
    type: NodeType.StartEvent,
    label: 'Start',
    displayLabel: 'Start',
  },
  [NodeSubType.EndEvent]: {
    type: NodeType.EndEvent,
    label: 'End',
    displayLabel: 'End',
  },
} as const;

export const DEFAULT_QUALITY_BANDS = [
  { name: 'Gold', minimumScore: 90 },
  { name: 'Silver', minimumScore: 75 },
  { name: 'Bronze', minimumScore: 50 },
  { name: 'No Plate', minimumScore: 0 },
] as const;

export const ALL_DATA_ASSETS_OPTION_VALUE = '__ALL_DATA_ASSETS__';

export const AVAILABLE_OPTIONS = {
  DATA_ASSETS: WORKFLOW_DATA_ASSETS_LIST,
  TRIGGER_TYPES: [
    { value: Type.PeriodicBatchEntity, label: 'Schedule' },
    { value: Type.EventBasedEntity, label: 'Event' },
  ],
  EVENT_TYPES: [Event.Created, Event.Updated],
  CONDITION_VALUES: [
    { value: ConditionValue.TRUE, label: 'True' },
    { value: ConditionValue.FALSE, label: 'False' },
  ],
  FIELD_NAMES: ['dataAssets', 'eventType', 'excludeFields'],
} as const;

export enum FieldOptions {
  TAGS = 'tags',
  DESCRIPTION = 'description',
  DISPLAY_NAME = 'displayName',
  NAME = 'name',
  GLOSSARY_TERMS = 'glossaryTerms',
  TIER = 'tier',
  STATUS = 'status',
  CERTIFICATION = 'certification',
}

export const FIELD_OPTIONS_DROPDOWN = [
  { label: 'Tags', value: FieldOptions.TAGS },
  { label: 'Description', value: FieldOptions.DESCRIPTION },
  { label: 'Display Name', value: FieldOptions.DISPLAY_NAME },
  { label: 'Glossary Terms', value: FieldOptions.GLOSSARY_TERMS },
  { label: 'Tier', value: FieldOptions.TIER },
  { label: 'Status', value: FieldOptions.STATUS },
  { label: 'Certification', value: FieldOptions.CERTIFICATION },
];

export const getStatusMapping = (
  t: (key: string) => string
): Record<
  | WorkflowStatus.Finished
  | WorkflowStatus.Running
  | WorkflowStatus.Failure
  | WorkflowStatus.Exception,
  { statusType: StatusType; displayLabel: string }
> => ({
  [WorkflowStatus.Finished]: {
    statusType: StatusType.Success,
    displayLabel: t('label.status-success'),
  },
  [WorkflowStatus.Running]: {
    statusType: StatusType.Running,
    displayLabel: t('label.status-running'),
  },
  [WorkflowStatus.Failure]: {
    statusType: StatusType.Failure,
    displayLabel: t('label.status-failed'),
  },
  [WorkflowStatus.Exception]: {
    statusType: StatusType.Failure,
    displayLabel: t('label.status-failed'),
  },
});

export type WorkflowBuilderTab = 'workflow-builder' | 'execution-history';

export const tabTestIds: Record<WorkflowBuilderTab, string> = {
  'execution-history': 'workflow-execution-history',
  'workflow-builder': 'workflow-builder-tab',
};

export const getWorkflowBuilderTabs = (
  t: (key: string) => string
): Array<{
  id: WorkflowBuilderTab;
  label: string;
  value: WorkflowBuilderTab;
}> => [
  {
    id: 'workflow-builder',
    label: t('label.workflow-builder-tab'),
    value: 'workflow-builder',
  },
  {
    id: 'execution-history',
    label: t('label.execution-history-tab'),
    value: 'execution-history',
  },
];

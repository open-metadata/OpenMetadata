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
import { EntityType } from '../enums/entity.enum';
import { Task, TaskEntityStatus, TaskEntityType } from '../rest/tasksAPI';

/**
 * Check if a task is a description-related task
 */
export const isDescriptionTask = (type?: TaskEntityType): boolean => {
  return (
    type === TaskEntityType.DescriptionUpdate ||
    type === TaskEntityType.Suggestion
  );
};

/**
 * Check if a task is a tag-related task
 */
export const isTagsTask = (type?: TaskEntityType): boolean => {
  return type === TaskEntityType.TagUpdate;
};

/**
 * Check if a task is a glossary approval task
 */
export const isGlossaryApprovalTask = (type?: TaskEntityType): boolean => {
  return type === TaskEntityType.GlossaryApproval;
};

/**
 * Check if a task is a test case resolution task
 */
export const isTestCaseResolutionTask = (type?: TaskEntityType): boolean => {
  return type === TaskEntityType.TestCaseResolution;
};

/**
 * Check if a task is open
 */
export const isTaskOpen = (status?: TaskEntityStatus): boolean => {
  return (
    status === TaskEntityStatus.Open || status === TaskEntityStatus.InProgress
  );
};

/**
 * Check if a task is closed (any terminal status)
 */
export const isTaskClosed = (status?: TaskEntityStatus): boolean => {
  return (
    status === TaskEntityStatus.Completed ||
    status === TaskEntityStatus.Approved ||
    status === TaskEntityStatus.Rejected ||
    status === TaskEntityStatus.Cancelled
  );
};

/**
 * Get the entity type from a task's about reference
 */
export const getTaskEntityType = (task: Task): EntityType | undefined => {
  if (!task.about?.type) {
    return undefined;
  }

  return task.about.type as EntityType;
};

/**
 * Get the entity FQN from a task's about reference
 */
export const getTaskEntityFQN = (task: Task): string | undefined => {
  return task.about?.fullyQualifiedName;
};

/**
 * Get the suggested value from a task's payload (for suggestion tasks)
 */
export const getTaskSuggestedValue = (task: Task): string | undefined => {
  if (!task.payload || typeof task.payload !== 'object') {
    return undefined;
  }

  const payload = task.payload as Record<string, unknown>;

  // For SuggestionPayload
  if ('suggestedValue' in payload) {
    return payload.suggestedValue as string;
  }

  // For legacy task payloads
  if ('suggestion' in payload) {
    return payload.suggestion as string;
  }

  if ('newValue' in payload) {
    return payload.newValue as string;
  }

  return undefined;
};

/**
 * Get the old/current value from a task's payload
 */
export const getTaskOldValue = (task: Task): string | undefined => {
  if (!task.payload || typeof task.payload !== 'object') {
    return undefined;
  }

  const payload = task.payload as Record<string, unknown>;

  if ('currentValue' in payload) {
    return payload.currentValue as string;
  }

  if ('oldValue' in payload) {
    return payload.oldValue as string;
  }

  return undefined;
};

/**
 * Get the detail path for a task
 */
export const getTaskDetailPath = (task: Task): string => {
  const entityType = getTaskEntityType(task);
  const entityFQN = getTaskEntityFQN(task);

  if (!entityType || !entityFQN) {
    return `/tasks/${task.id}`;
  }

  return `/${entityType}/${encodeURIComponent(entityFQN)}/activity_feed/tasks/${
    task.taskId
  }`;
};

/**
 * Format task type for display
 */
export const formatTaskType = (type?: TaskEntityType): string => {
  if (!type) {
    return 'Task';
  }

  const typeLabels: Record<TaskEntityType, string> = {
    [TaskEntityType.GlossaryApproval]: 'Glossary Approval',
    [TaskEntityType.DataAccessRequest]: 'Data Access Request',
    [TaskEntityType.DescriptionUpdate]: 'Update Description',
    [TaskEntityType.TagUpdate]: 'Update Tags',
    [TaskEntityType.OwnershipUpdate]: 'Update Ownership',
    [TaskEntityType.TierUpdate]: 'Update Tier',
    [TaskEntityType.DomainUpdate]: 'Update Domain',
    [TaskEntityType.Suggestion]: 'Suggestion',
    [TaskEntityType.TestCaseResolution]: 'Test Case Resolution',
    [TaskEntityType.IncidentResolution]: 'Incident Resolution',
    [TaskEntityType.PipelineReview]: 'Pipeline Review',
    [TaskEntityType.DataQualityReview]: 'Data Quality Review',
    [TaskEntityType.CustomTask]: 'Custom Task',
  };

  return typeLabels[type] || type;
};

/**
 * Format task status for display
 */
export const formatTaskStatus = (status?: TaskEntityStatus): string => {
  if (!status) {
    return 'Unknown';
  }

  return status;
};

/**
 * Get the color class for a task status badge
 */
export const getTaskStatusColor = (
  status?: TaskEntityStatus
): 'success' | 'warning' | 'error' | 'processing' | 'default' => {
  switch (status) {
    case TaskEntityStatus.Completed:
    case TaskEntityStatus.Approved:
      return 'success';
    case TaskEntityStatus.InProgress:
    case TaskEntityStatus.Pending:
      return 'processing';
    case TaskEntityStatus.Rejected:
    case TaskEntityStatus.Failed:
    case TaskEntityStatus.Cancelled:
      return 'error';
    case TaskEntityStatus.Open:
    default:
      return 'default';
  }
};

/**
 * Constants for task actions
 */
export const TASK_ACTION_MODES = {
  RESOLVE: 'resolve',
  REJECT: 'reject',
  CLOSE: 'close',
  EDIT: 'edit',
  RE_ASSIGN: 're_assign',
} as const;

export type TaskActionMode =
  typeof TASK_ACTION_MODES[keyof typeof TASK_ACTION_MODES];

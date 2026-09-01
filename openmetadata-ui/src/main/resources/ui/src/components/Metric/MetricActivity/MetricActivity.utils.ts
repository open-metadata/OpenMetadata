/*
 *  Copyright 2026 Collate.
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
import type { TFunction } from 'i18next';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../generated/entity/feed/conversation';
import {
  ResolutionType,
  TaskAvailableTransition,
  TaskStatus,
  TaskType,
} from '../../../generated/entity/tasks/task';
import { FeedCounts } from '../../../interface/feed.interface';
import {
  MetricActivityListItem,
  MetricMentionOption,
  MetricMentionQuery,
} from './MetricActivity.types';

export const mergeMetricActivity = (
  events: ActivityEvent[],
  conversations: Conversation[]
): MetricActivityListItem[] =>
  [
    ...events.map((event) => ({
      id: event.id,
      kind: 'activity' as const,
      timestamp: event.timestamp,
      value: event,
    })),
    ...conversations.map((conversation) => ({
      id: conversation.id,
      kind: 'thread' as const,
      timestamp: conversation.updatedAt,
      value: conversation,
    })),
  ].sort((left, right) => right.timestamp - left.timestamp);

export const createMetricFeedCounts = ({
  activityEventCount,
  closedTaskCount,
  conversationThreadCount,
  mentionCount,
  openTaskCount,
  totalTaskCount,
}: {
  activityEventCount: number;
  closedTaskCount: number;
  conversationThreadCount: number;
  mentionCount: number;
  openTaskCount: number;
  totalTaskCount: number;
}): FeedCounts => {
  const conversationCount = activityEventCount + conversationThreadCount;

  return {
    closedTaskCount,
    conversationCount,
    mentionCount,
    openTaskCount,
    totalCount: conversationCount + totalTaskCount,
    totalTasksCount: totalTaskCount,
  };
};

export const getMetricMentionQuery = (
  message: string
): MetricMentionQuery | undefined => {
  const match = /(^|\s)([@#])([^\s@#]*)$/.exec(message);
  if (!match) {
    return;
  }

  return {
    denotation: match[2] as '@' | '#',
    query: match[3],
    start: match.index + match[1].length,
  };
};

export const insertMetricMention = (
  message: string,
  query: MetricMentionQuery,
  option: MetricMentionOption
): string => {
  const token = `<#E::${option.type}::${option.fullyQualifiedName}|${query.denotation}${option.displayName}>`;

  return `${message.slice(0, query.start)}${token} `;
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Approved]: 'label.approved',
  [TaskStatus.Cancelled]: 'label.cancelled',
  [TaskStatus.Completed]: 'label.completed',
  [TaskStatus.Expired]: 'label.timeout',
  [TaskStatus.Failed]: 'label.failed',
  [TaskStatus.Granted]: 'label.granted',
  [TaskStatus.InProgress]: 'label.running',
  [TaskStatus.ManualRevoke]: 'label.cancelled',
  [TaskStatus.Open]: 'label.open',
  [TaskStatus.Pending]: 'label.pending-task',
  [TaskStatus.Rejected]: 'label.rejected',
  [TaskStatus.Revoked]: 'label.cancelled',
};

export const getMetricTaskStatusLabel = (
  t: TFunction,
  status: TaskStatus
): string => t(TASK_STATUS_LABELS[status]);

export const getMetricTaskTypeLabel = (
  t: TFunction,
  type?: TaskType
): string => {
  switch (type) {
    case TaskType.DescriptionUpdate:
      return t('label.update-description');
    case TaskType.DomainUpdate:
      return t('label.update-entity', { entity: t('label.domain') });
    case TaskType.OwnershipUpdate:
      return t('label.update-entity', { entity: t('label.owner') });
    case TaskType.TagUpdate:
      return t('label.update-entity', { entity: t('label.tag-plural') });
    case TaskType.TierUpdate:
      return t('label.update-entity', { entity: t('label.tier') });
    case TaskType.GlossaryApproval:
    case TaskType.RecognizerFeedbackApproval:
    case TaskType.RequestApproval:
      return t('label.approval');
    case TaskType.IncidentResolution:
    case TaskType.TestCaseResolution:
      return t('label.incident');
    case TaskType.DataQualityReview:
    case TaskType.PipelineReview:
      return t('label.task');
    case TaskType.DataAccessRequest:
      return t('label.data-access-request');
    case TaskType.Suggestion:
      return t('label.suggestion');
    case TaskType.CustomTask:
    default:
      return t('label.task');
  }
};

export const getMetricTaskTransitionLabel = (
  t: TFunction,
  transition: TaskAvailableTransition
): string => {
  if (transition.targetTaskStatus === TaskStatus.Approved) {
    return t('label.approve');
  }
  if (transition.targetTaskStatus === TaskStatus.Rejected) {
    return t('label.reject');
  }
  if (transition.targetTaskStatus === TaskStatus.Completed) {
    return t('label.complete');
  }
  if (transition.targetTaskStatus === TaskStatus.Cancelled) {
    return t('label.cancel');
  }

  return transition.label;
};

export const getMetricTaskResolutionLabel = (
  t: TFunction,
  resolution?: ResolutionType
): string => {
  switch (resolution) {
    case ResolutionType.Approved:
    case ResolutionType.AutoApproved:
      return t('label.approved');
    case ResolutionType.Rejected:
    case ResolutionType.AutoRejected:
      return t('label.rejected');
    case ResolutionType.Cancelled:
    case ResolutionType.Revoked:
      return t('label.cancelled');
    case ResolutionType.Completed:
      return t('label.completed');
    case ResolutionType.Expired:
    case ResolutionType.TimedOut:
      return t('label.timeout');
    default:
      return t('label.resolved');
  }
};

const WORKFLOW_LABELS: Record<string, string> = {
  approved: 'label.approved',
  completed: 'label.completed',
  draft: 'label.draft',
  failed: 'label.failed',
  inprogress: 'label.running',
  inreview: 'label.in-review',
  open: 'label.open',
  pending: 'label.pending-task',
  rejected: 'label.rejected',
  review: 'label.in-review',
  running: 'label.running',
};

export const getMetricWorkflowLabel = (t: TFunction, label: string): string => {
  const labelKey = WORKFLOW_LABELS[label.replace(/[\s_-]/g, '').toLowerCase()];

  return labelKey ? t(labelKey) : label;
};

export const getMetricActivityEventLabel = (
  t: TFunction,
  eventType: ActivityEventType
): string => {
  const updated = t('label.updated');
  switch (eventType) {
    case ActivityEventType.ColumnDescriptionUpdated:
      return `${t('label.column-description')} · ${updated}`;
    case ActivityEventType.ColumnTagsUpdated:
      return `${t('label.column')} · ${t('label.tag-plural')} · ${updated}`;
    case ActivityEventType.CustomPropertyUpdated:
      return `${t('label.custom-property')} · ${updated}`;
    case ActivityEventType.DescriptionUpdated:
      return `${t('label.description')} · ${updated}`;
    case ActivityEventType.DomainUpdated:
      return `${t('label.domain')} · ${updated}`;
    case ActivityEventType.EntityCreated:
      return `${t('label.entity')} · ${t('label.created-lowercase')}`;
    case ActivityEventType.EntityDeleted:
      return `${t('label.entity')} · ${t('label.deleted-lowercase')}`;
    case ActivityEventType.EntityRestored:
      return `${t('label.entity')} · ${t('label.restored-lowercase')}`;
    case ActivityEventType.EntitySoftDeleted:
      return `${t('label.entity')} · ${t('label.soft-deleted-lowercase')}`;
    case ActivityEventType.OwnerUpdated:
      return `${t('label.owner')} · ${updated}`;
    case ActivityEventType.PipelineStatusChanged:
      return t('label.pipeline-status-changed');
    case ActivityEventType.TagsUpdated:
      return `${t('label.tag-plural')} · ${updated}`;
    case ActivityEventType.TestCaseStatusChanged:
      return `${t('label.test-case-status')} · ${updated}`;
    case ActivityEventType.TierUpdated:
      return `${t('label.tier')} · ${updated}`;
    case ActivityEventType.EntityUpdated:
    default:
      return `${t('label.entity')} · ${updated}`;
  }
};

const FIELD_LABELS: Record<string, string> = {
  customproperties: 'label.custom-property-plural',
  description: 'label.description',
  domain: 'label.domain',
  domains: 'label.domain-plural',
  entitystatus: 'label.status',
  owner: 'label.owner',
  owners: 'label.owner-plural',
  tags: 'label.tag-plural',
  tier: 'label.tier',
};

export const getMetricActivityFieldLabel = (
  t: TFunction,
  fieldName: string
): string => {
  const labelKey =
    FIELD_LABELS[fieldName.replace(/[\s_.-]/g, '').toLowerCase()];

  return labelKey ? t(labelKey) : fieldName;
};

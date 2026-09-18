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

import { FQN_SEPARATOR_CHAR } from '../../../../constants/char.constants';
import { TIER_CATEGORY } from '../../../../constants/constants';
import {
  EntityReference,
  Task,
  TaskCategory,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { DescriptionUpdatePayload } from '../../../../generated/type/descriptionUpdatePayload';
import { DomainUpdatePayload } from '../../../../generated/type/domainUpdatePayload';
import { OwnershipUpdatePayload } from '../../../../generated/type/ownershipUpdatePayload';
import { SuggestionPayload } from '../../../../generated/type/suggestionPayload';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { TagUpdatePayload } from '../../../../generated/type/tagUpdatePayload';
import { TestCaseResolutionPayload } from '../../../../generated/type/testCaseResolutionPayload';
import { TierUpdatePayload } from '../../../../generated/type/tierUpdatePayload';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import {
  TaskAboutEntity,
  TaskDetailDescriptor,
  TaskDetailRow,
  TaskTypeBadge,
} from './taskDetail.types';
import { getTaskResolutionSummary } from './taskResolution.utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The tag prefix Collate classifies personally-identifiable columns under. */
const PII_TAG_PREFIX = 'PII.';

// The classification prefixes are read here rather than through the table
// utils' `getTierTags`: that module reaches the customization and permission
// layers at import time, which this file must not drag into the task list.
const TIER_TAG_PREFIX = `${TIER_CATEGORY}${FQN_SEPARATOR_CHAR}`;

// Type → badge label / colour / icon. Colour carries meaning here (an incident
// reads red, an access request blue), so it is declared per type rather than
// derived from the category, which is coarser.
const TASK_TYPE_BADGE: Record<
  string,
  {
    labelKey: string;
    color: TaskTypeBadge['color'];
    icon: TaskTypeBadge['icon'];
  }
> = {
  [TaskType.TestCaseResolution]: {
    labelKey: 'label.incident',
    color: 'error',
    icon: 'incident',
  },
  [TaskType.IncidentResolution]: {
    labelKey: 'label.incident',
    color: 'error',
    icon: 'incident',
  },
  [TaskType.DataAccessRequest]: {
    labelKey: 'label.data-access-request',
    color: 'blue',
    icon: 'access',
  },
  [TaskType.TagUpdate]: {
    labelKey: 'label.tag',
    color: 'purple',
    icon: 'tag',
  },
  [TaskType.OwnershipUpdate]: {
    labelKey: 'label.ownership',
    color: 'blue-light',
    icon: 'ownership',
  },
  [TaskType.DescriptionUpdate]: {
    labelKey: 'label.description',
    color: 'gray',
    icon: 'description',
  },
  [TaskType.Suggestion]: {
    labelKey: 'label.suggestion',
    color: 'gray',
    icon: 'description',
  },
  [TaskType.TierUpdate]: {
    labelKey: 'label.tier',
    color: 'orange',
    icon: 'tier',
  },
  [TaskType.DomainUpdate]: {
    labelKey: 'label.domain',
    color: 'indigo',
    icon: 'approval',
  },
  [TaskType.GlossaryApproval]: {
    labelKey: 'label.glossary',
    color: 'brand',
    icon: 'approval',
  },
  [TaskType.RequestApproval]: {
    labelKey: 'label.task',
    color: 'brand',
    icon: 'approval',
  },
};

const DEFAULT_TYPE_BADGE = {
  labelKey: 'label.task',
  color: 'gray' as TaskTypeBadge['color'],
  icon: 'approval' as TaskTypeBadge['icon'],
};

/**
 * The type chip shown in the detail header and on each list row. Falls back to
 * a neutral "Task" chip so an unmapped or future type still renders.
 */
export const getTaskTypeBadge = (task: Task, t: Translate): TaskTypeBadge => {
  const config =
    TASK_TYPE_BADGE[task.type] ??
    (task.category === TaskCategory.Incident
      ? TASK_TYPE_BADGE[TaskType.TestCaseResolution]
      : DEFAULT_TYPE_BADGE);

  return {
    label: t(config.labelKey),
    color: config.color,
    icon: config.icon,
  };
};

/**
 * Incident tasks carry no `about`; the failing test case FQN only appears in
 * the description ("New incident for test case: <fqn>") as the trailing token.
 */
export const resolveIncidentTestCaseFqn = (task: Task): string => {
  if (
    task.about?.fullyQualifiedName ||
    task.category !== TaskCategory.Incident
  ) {
    return '';
  }

  return (task.description ?? '').trim().split(/\s+/).pop() ?? '';
};

const getPayload = <T>(task: Task): Partial<T> =>
  (task.payload ?? {}) as Partial<T>;

const textRow = (
  key: string,
  icon: TaskDetailRow['icon'],
  label: string,
  text?: string
): TaskDetailRow[] =>
  text ? [{ key, icon, label, value: { kind: 'text', text } }] : [];

const dateRow = (
  key: string,
  label: string,
  timestamp?: number
): TaskDetailRow[] =>
  timestamp
    ? [{ key, icon: 'calendar', label, value: { kind: 'date', timestamp } }]
    : [];

const usersRow = (
  key: string,
  icon: TaskDetailRow['icon'],
  label: string,
  refs?: EntityReference[]
): TaskDetailRow[] =>
  refs && refs.length > 0
    ? [{ key, icon, label, value: { kind: 'users', refs } }]
    : [];

const tagsRow = (
  key: string,
  label: string,
  tags?: TagLabel[]
): TaskDetailRow[] =>
  tags && tags.length > 0
    ? [{ key, icon: 'tag', label, value: { kind: 'tags', tags } }]
    : [];

/** Assignee / requester / opened-on, which every task type shows. */
const getCommonRows = (task: Task, t: Translate): TaskDetailRow[] => [
  ...usersRow('assignees', 'user', t('label.assignee'), task.assignees),
  ...usersRow(
    'createdBy',
    'owner',
    t('label.created-by'),
    task.createdBy ? [task.createdBy] : []
  ),
  ...dateRow('createdAt', t('label.created-on'), task.createdAt),
];

/**
 * Outcome rows for a closed task. Open tasks get none — their state lives in the
 * header's status chip instead.
 */
const getResolutionRows = (task: Task, t: Translate): TaskDetailRow[] => {
  const resolution = getTaskResolutionSummary(task);
  if (!resolution) {
    return [];
  }

  return [
    ...usersRow(
      'resolvedBy',
      'owner',
      t('label.resolved-by'),
      resolution.resolvedBy ? [resolution.resolvedBy] : []
    ),
    ...textRow(
      'resolvedOn',
      'calendar',
      t('label.resolved-on'),
      resolution.resolvedOn
    ),
    ...(resolution.hasResolution
      ? textRow(
          'resolutionComment',
          'type',
          t(resolution.commentLabelKey),
          resolution.comment
        )
      : []),
  ];
};

const describeIncident = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<TestCaseResolutionPayload>(task);

  return {
    subtitleKey: 'message.task-opened-this-incident',
    rows: [
      ...getCommonRows(task, t),
      ...textRow('severity', 'shield', t('label.severity'), payload.severity),
    ],
    callout: payload.failureReason
      ? { label: t('label.failure-comment'), text: payload.failureReason }
      : undefined,
  };
};

const describeTagUpdate = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<TagUpdatePayload>(task);

  return {
    rows: [
      ...tagsRow('tags', t('label.tag-plural'), payload.tagsToAdd),
      ...textRow('source', 'source', t('label.source'), payload.source),
      ...usersRow(
        'requestedBy',
        'owner',
        t('label.requested-by'),
        task.createdBy ? [task.createdBy] : []
      ),
      ...dateRow('requestedOn', t('label.created-on'), task.createdAt),
      ...usersRow('assignees', 'user', t('label.assignee'), task.assignees),
    ],
  };
};

const describeDescriptionUpdate = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<DescriptionUpdatePayload>(task);

  return {
    rows: [
      ...getCommonRows(task, t),
      ...textRow('fieldPath', 'type', t('label.field'), payload.fieldPath),
      ...textRow('source', 'source', t('label.source'), payload.source),
    ],
    callout: payload.newDescription
      ? {
          label: t('label.suggested-description'),
          text: payload.newDescription,
        }
      : undefined,
  };
};

const describeSuggestion = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<SuggestionPayload>(task);

  return {
    rows: [
      ...getCommonRows(task, t),
      ...textRow('fieldPath', 'type', t('label.field'), payload.fieldPath),
      ...textRow('source', 'source', t('label.source'), payload.source),
    ],
    callout: payload.suggestedValue
      ? { label: t('label.suggestion'), text: payload.suggestedValue }
      : undefined,
  };
};

const describeOwnershipUpdate = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<OwnershipUpdatePayload>(task);

  return {
    rows: [
      ...usersRow(
        'newOwners',
        'owner',
        t('label.new-entity', { entity: t('label.owner-plural') }),
        payload.newOwners
      ),
      ...usersRow(
        'currentOwners',
        'owner',
        t('label.current-entity', { entity: t('label.owner-plural') }),
        payload.currentOwners
      ),
      ...getCommonRows(task, t),
    ],
    callout: payload.reason
      ? { label: t('label.context'), text: payload.reason }
      : undefined,
  };
};

const describeTierUpdate = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<TierUpdatePayload>(task);

  return {
    rows: [
      ...tagsRow(
        'newTier',
        t('label.new-entity', { entity: t('label.tier') }),
        payload.newTier ? [payload.newTier] : []
      ),
      ...tagsRow(
        'currentTier',
        t('label.current-entity', { entity: t('label.tier') }),
        payload.currentTier ? [payload.currentTier] : []
      ),
      ...getCommonRows(task, t),
    ],
    callout: payload.reason
      ? { label: t('label.context'), text: payload.reason }
      : undefined,
  };
};

const describeDomainUpdate = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<DomainUpdatePayload>(task);

  return {
    rows: [
      ...usersRow(
        'newDomain',
        'type',
        t('label.new-entity', { entity: t('label.domain') }),
        payload.newDomain ? [payload.newDomain as EntityReference] : []
      ),
      ...getCommonRows(task, t),
    ],
    callout: payload.reason
      ? { label: t('label.context'), text: payload.reason }
      : undefined,
  };
};

type Describer = (task: Task, t: Translate) => Partial<TaskDetailDescriptor>;

const DESCRIBERS: Record<string, Describer> = {
  [TaskType.TestCaseResolution]: describeIncident,
  [TaskType.IncidentResolution]: describeIncident,
  [TaskType.TagUpdate]: describeTagUpdate,
  [TaskType.DescriptionUpdate]: describeDescriptionUpdate,
  [TaskType.Suggestion]: describeSuggestion,
  [TaskType.OwnershipUpdate]: describeOwnershipUpdate,
  [TaskType.TierUpdate]: describeTierUpdate,
  [TaskType.DomainUpdate]: describeDomainUpdate,
};

/**
 * The type-specific description of a task's detail pane: header chip, subtitle,
 * summary rows and callout. A plugin may override any slice of this through the
 * `inbox.task-panels` extension point (see `InboxTaskPanelContribution`).
 *
 * Every descriptor ends with the closed-task outcome rows, so resolution details
 * surface regardless of type.
 */
export const getTaskDetailDescriptor = (
  task: Task,
  t: Translate
): TaskDetailDescriptor => {
  const describe = DESCRIBERS[task.type];
  const specific = describe
    ? describe(task, t)
    : {
        rows: getCommonRows(task, t),
        callout: task.description
          ? { label: t('label.context'), text: task.description }
          : undefined,
      };

  return {
    typeBadge: getTaskTypeBadge(task, t),
    subtitleKey: 'message.task-opened-by',
    ...specific,
    rows: [...(specific.rows ?? []), ...getResolutionRows(task, t)],
  };
};

interface EntityWithContext {
  tags?: TagLabel[];
  owners?: EntityReference[];
  columns?: { tags?: TagLabel[] }[];
  updatedAt?: number;
}

/**
 * Folds the about-entity fetch and the lineage count into the context the stat
 * tiles read. Pure so the hook stays a thin fetch wrapper.
 */
export const deriveTaskAboutEntity = (
  entity?: EntityUnion,
  downstreamCount?: number
): TaskAboutEntity => {
  const typed = (entity ?? {}) as EntityWithContext;
  const columns = typed.columns;
  const tags = typed.tags ?? [];

  return {
    entity,
    tier: tags.find((tag) => tag.tagFQN?.startsWith(TIER_TAG_PREFIX)),
    columnCount: columns?.length,
    piiColumnCount: columns?.filter((column) =>
      (column.tags ?? []).some((tag) => tag.tagFQN?.startsWith(PII_TAG_PREFIX))
    ).length,
    downstreamCount,
    ownerCount: typed.owners?.length,
    updatedAt: typed.updatedAt,
  };
};

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
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import {
  TaskAboutEntity,
  TaskDetailCallout,
  TaskDetailDescriptor,
  TaskDetailRow,
  TaskTypeBadge,
} from './taskDetail.types';
import { getTaskResolutionSummary } from './taskResolution.utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Elements that end a line of text. textContent alone joins them with no
// separator, so "<p>Q3.</p><p>Approved.</p>" would read "Q3.Approved.".
const LINE_BREAKING_ELEMENTS =
  'p, div, li, br, tr, h1, h2, h3, h4, h5, h6, blockquote, pre';

/**
 * A task description as plain text, one line per paragraph: tags stripped and
 * entities decoded.
 *
 * Descriptions are stored as sanitized HTML/markdown, and the server's
 * sanitizer encodes punctuation on update (`'` becomes `&#39;` once a workflow
 * saves the task), so anything drawing the description outside a rich-text
 * renderer must decode it. The parsed document is inert — nothing in it runs or
 * loads — and the text is rendered escaped by React. Blank lines are dropped.
 */
export const getPlainDescription = (
  task: Pick<Task, 'description'>
): string => {
  const html = task.description?.trim();
  if (!html) {
    return '';
  }

  const { body } = new DOMParser().parseFromString(html, 'text/html');
  body
    .querySelectorAll(LINE_BREAKING_ELEMENTS)
    .forEach((element) => element.after('\n'));

  return (body.textContent ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

// The description as a labelled callout, or none when it has no text. It
// stays as written; the callout renders its markdown and mentions.
const descriptionCallout = (
  task: Pick<Task, 'description'>,
  label: string
): TaskDetailCallout | undefined =>
  getPlainDescription(task)
    ? { label, text: task.description?.trim() ?? '' }
    : undefined;

/**
 * The one PII tag that marks a column as holding personal data. Its siblings
 * `PII.NonSensitive` and `PII.None` say the opposite, so a prefix match would
 * count a column classified as safe.
 */
const PII_SENSITIVE_TAG = 'PII.Sensitive';

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
    labelKey: 'label.access-request',
    color: 'blue',
    icon: 'access',
  },
  [TaskType.TagUpdate]: {
    labelKey: 'label.tag-request',
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
    labelKey: 'label.approval',
    color: 'brand',
    icon: 'approval',
  },
  [TaskType.CustomTask]: {
    labelKey: 'label.custom-task',
    color: 'gray',
    icon: 'approval',
  },
  [TaskType.DataQualityReview]: {
    labelKey: 'label.data-quality-review',
    color: 'blue-light',
    icon: 'approval',
  },
  [TaskType.PipelineReview]: {
    labelKey: 'label.pipeline-review',
    color: 'indigo',
    icon: 'approval',
  },
  [TaskType.RecognizerFeedbackApproval]: {
    labelKey: 'label.recognizer-feedback',
    color: 'purple',
    icon: 'tag',
  },
};

const DEFAULT_TYPE_BADGE = {
  labelKey: 'label.task',
  color: 'gray' as TaskTypeBadge['color'],
  icon: 'approval' as TaskTypeBadge['icon'],
};

const getTypeBadgeConfig = (task: Pick<Task, 'type' | 'category'>) =>
  TASK_TYPE_BADGE[task.type] ??
  (task.category === TaskCategory.Incident
    ? TASK_TYPE_BADGE[TaskType.TestCaseResolution]
    : DEFAULT_TYPE_BADGE);

/**
 * What a task reads as, as a stable key: two types that share a label (a test
 * case incident and an incident) are one kind to a reviewer, so the list
 * groups them under one header and the filter offers them as one option.
 */
export const getTaskTypeKey = (task: Pick<Task, 'type' | 'category'>) =>
  getTypeBadgeConfig(task).labelKey;

/**
 * The type chip shown in the detail header and on each list row. Falls back to
 * a neutral "Task" chip so an unmapped or future type still renders.
 */
export const getTaskTypeBadge = (task: Task, t: Translate): TaskTypeBadge => {
  const config = getTypeBadgeConfig(task);

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

// Who produced a proposed change, in words rather than the payload's enum. The
// payload holds a single value, so a change an agent proposed and a person then
// filed reads as its origin alone.
const SOURCE_LABEL_KEY: Record<string, string> = {
  User: 'label.user',
  Agent: 'label.agent',
  AutoPilot: 'label.auto-pilot',
  Classification: 'label.classification',
  Ingestion: 'label.ingestion',
};

const getSourceLabel = (
  t: Translate,
  source?: string,
  overrides: Record<string, string> = {}
): string | undefined => {
  if (!source) {
    return undefined;
  }
  const key = overrides[source] ?? SOURCE_LABEL_KEY[source];

  return key ? t(key) : source;
};

// On a tag request the agent is the auto-classifier, which is what a reviewer
// knows it as.
const TAG_SOURCE_OVERRIDES: Record<string, string> = {
  Agent: 'label.auto-classifier',
};

/** Assignee / requester / opened-on, which every task type shows. */
const getCommonRows = (
  task: Task,
  t: Translate,
  dateLabelKey = 'label.opened-on'
): TaskDetailRow[] => [
  ...usersRow('assignees', 'user', t('label.assignee'), task.assignees),
  ...usersRow(
    'createdBy',
    'owner',
    t('label.created-by'),
    task.createdBy ? [task.createdBy] : []
  ),
  ...dateRow('createdAt', t(dateLabelKey), task.createdAt),
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

  // Who resolved it reads in the line under the title ("Rejected by … on …"),
  // so the rows keep only when and why.
  return [
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
    // Severity sits in the asset card's tiles, beside the failing test.
    rows: getCommonRows(task, t),
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
    subtitleKey: 'message.task-requested',
    actionLabels: {
      approve: t('label.approve-entity', { entity: t('label.tag') }),
    },
    rows: [
      ...tagsRow('tags', t('label.tag'), payload.tagsToAdd),
      ...textRow(
        'source',
        'source',
        t('label.source'),
        getSourceLabel(t, payload.source, TAG_SOURCE_OVERRIDES)
      ),
      ...usersRow(
        'requestedBy',
        'owner',
        t('label.requested-by'),
        task.createdBy ? [task.createdBy] : []
      ),
      ...dateRow('requestedOn', t('label.requested-on'), task.createdAt),
    ],
    callout: descriptionCallout(task, t('label.justification')),
  };
};

const describeDescriptionUpdate = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getPayload<DescriptionUpdatePayload>(task);

  return {
    subtitleKey: 'message.task-requested',
    rows: [
      ...getCommonRows(task, t, 'label.requested-on'),
      ...textRow('fieldPath', 'type', t('label.field'), payload.fieldPath),
      ...textRow(
        'source',
        'source',
        t('label.source'),
        getSourceLabel(t, payload.source)
      ),
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
    subtitleKey: 'message.task-requested',
    rows: [
      ...getCommonRows(task, t, 'label.requested-on'),
      ...textRow('fieldPath', 'type', t('label.field'), payload.fieldPath),
      ...textRow(
        'source',
        'source',
        t('label.source'),
        getSourceLabel(t, payload.source)
      ),
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
  const currentOwners = payload.currentOwners ?? [];
  // The button names who approving hands the asset to.
  const proposedOwners = (payload.newOwners ?? [])
    .map((owner) => getEntityName(owner))
    .join(', ');

  return {
    subtitleKey: 'message.task-asked',
    actionLabels: {
      approve: t('label.assign-entity', {
        entity: proposedOwners || t('label.owner'),
      }),
      reject: t('label.dismiss'),
    },
    rows: [
      currentOwners.length
        ? {
            key: 'owner',
            icon: 'owner',
            label: t('label.owner'),
            value: { kind: 'users', refs: currentOwners },
          }
        : {
            key: 'owner',
            icon: 'owner',
            label: t('label.owner'),
            value: { kind: 'text', text: t('label.no-owner') },
          },
      // Approving replaces the current owners with these, so the reviewer sees
      // both sides of the change before deciding.
      ...usersRow(
        'newOwners',
        'owner',
        t('label.new-entity', { entity: t('label.owner-plural') }),
        payload.newOwners
      ),
      ...dateRow('createdAt', t('label.raised-on'), task.createdAt),
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
    subtitleKey: 'message.task-requested',
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
      ...getCommonRows(task, t, 'label.requested-on'),
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
    subtitleKey: 'message.task-requested',
    rows: [
      ...usersRow(
        'newDomain',
        'type',
        t('label.new-entity', { entity: t('label.domain') }),
        payload.newDomain ? [payload.newDomain as EntityReference] : []
      ),
      ...getCommonRows(task, t, 'label.requested-on'),
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
 * summary rows and callout. `override` carries a plugin's slices from the
 * `inbox.task-panels` extension point (see `InboxTaskPanelContribution`).
 *
 * Every descriptor ends with the closed-task outcome rows, so resolution details
 * surface regardless of type or of who described it.
 */
export const getTaskDetailDescriptor = (
  task: Task,
  t: Translate,
  override?: Partial<TaskDetailDescriptor>
): TaskDetailDescriptor => {
  const describe = DESCRIBERS[task.type];
  const specific = {
    ...(describe
      ? describe(task, t)
      : {
          rows: getCommonRows(task, t),
          callout: descriptionCallout(task, t('label.context')),
        }),
    // A plugin's slices win, but only the slices it sets.
    ...override,
  };

  return {
    typeBadge: getTaskTypeBadge(task, t),
    subtitleKey: 'message.task-opened-by',
    ...specific,
    // Outcome rows are the inbox's, whoever described the rest: a plugin that
    // supplies its own rows still gets resolved-on / the comment appended.
    rows: [...(specific.rows ?? []), ...getResolutionRows(task, t)],
  };
};

interface EntityWithContext {
  tags?: TagLabel[];
  owners?: EntityReference[];
  columns?: { tags?: TagLabel[] }[];
  usageSummary?: { weeklyStats?: { count?: number } };
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
      (column.tags ?? []).some((tag) => tag.tagFQN === PII_SENSITIVE_TAG)
    ).length,
    downstreamCount,
    weeklyQueryCount: typed.usageSummary?.weeklyStats?.count,
    ownerCount: typed.owners?.length,
    updatedAt: typed.updatedAt,
  };
};

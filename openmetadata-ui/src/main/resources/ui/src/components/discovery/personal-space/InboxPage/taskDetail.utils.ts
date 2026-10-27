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

import { isEmpty } from 'lodash';
import { FQN_SEPARATOR_CHAR } from '../../../../constants/char.constants';
import { TIER_CATEGORY } from '../../../../constants/constants';
import {
  EntityReference,
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { DescriptionUpdatePayload } from '../../../../generated/type/descriptionUpdatePayload';
import { DomainUpdatePayload } from '../../../../generated/type/domainUpdatePayload';
import {
  GlossaryApprovalPayload,
  ProviderType,
} from '../../../../generated/type/glossaryApprovalPayload';
import { OwnershipUpdatePayload } from '../../../../generated/type/ownershipUpdatePayload';
import { SuggestionPayload } from '../../../../generated/type/suggestionPayload';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { TagUpdatePayload } from '../../../../generated/type/tagUpdatePayload';
import { TestCaseResolutionPayload } from '../../../../generated/type/testCaseResolutionPayload';
import { TierUpdatePayload } from '../../../../generated/type/tierUpdatePayload';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Fqn from '../../../../utils/Fqn';
import {
  getMetadataCompletionInstruction,
  getMetadataCompletionPayload,
  getRequiredFieldLabel,
  isRevisionRequest,
} from '../../../Entity/Task/MetadataCompletionTask/MetadataCompletionTask.utils';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import type { ActivityChange } from './inbox.utils';
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
  [TaskType.MemoryConflictReview]: {
    labelKey: 'label.memory-conflict',
    color: 'orange',
    icon: 'approval',
  },
  [TaskType.MetadataCompletion]: {
    labelKey: 'label.missing-metadata',
    color: 'warning',
    icon: 'description',
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

// A Metadata Completion task that carries a rejection asks for a revision, not for fields.
const REVISION_BADGE: (typeof TASK_TYPE_BADGE)[string] = {
  labelKey: 'label.revise-and-resubmit',
  color: 'warning',
  icon: 'approval',
};

const getTypeBadgeConfig = (
  task: Pick<Task, 'type' | 'category'> & Partial<Pick<Task, 'payload'>>
) => {
  if (isRevisionRequest(task)) {
    return REVISION_BADGE;
  }

  return (
    TASK_TYPE_BADGE[task.type] ??
    (task.category === TaskCategory.Incident
      ? TASK_TYPE_BADGE[TaskType.TestCaseResolution]
      : DEFAULT_TYPE_BADGE)
  );
};

/**
 * What a task reads as, as a stable key: two types that share a label (a test
 * case incident and an incident) are one kind to a reviewer, so the list
 * groups them under one header and the filter offers them as one option.
 */
export const getTaskTypeKey = (
  task: Pick<Task, 'type' | 'category'> & Partial<Pick<Task, 'payload'>>
) => getTypeBadgeConfig(task).labelKey;

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
  refs?: EntityReference[],
  title?: string
): TaskDetailRow[] =>
  refs && refs.length > 0
    ? [{ key, icon, label, value: { kind: 'users', refs, title } }]
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

/**
 * The AI agent that proposed what the task decides, when an automation did: its name, or a
 * generic one when it recorded none. A person reads it instead of the bot the agent writes as.
 */
export const getProposingAgent = (task: Task, t: Translate) => {
  const { proposal } = getPayload<GlossaryApprovalPayload>(task);

  return proposal?.provider === ProviderType.Automation
    ? proposal.agent ?? t('label.ai-agent')
    : undefined;
};

const createdByRow = (task: Task, t: Translate): TaskDetailRow[] => {
  const agent = getProposingAgent(task, t);
  const creators = task.createdBy ? [task.createdBy] : [];

  return agent
    ? [
        {
          key: 'createdBy',
          icon: 'owner',
          label: t('label.created-by'),
          value: { kind: 'agent', name: agent },
        },
      ]
    : usersRow('createdBy', 'owner', t('label.created-by'), creators);
};

/** Assignee / requester / opened-on, which every task type shows. */
const getCommonRows = (
  task: Task,
  t: Translate,
  dateLabelKey = 'label.opened-on'
): TaskDetailRow[] => [
  ...usersRow(
    'assignees',
    'user',
    t('label.assignee'),
    task.assignees,
    t('label.assignee-plural')
  ),
  ...createdByRow(task, t),
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

const tagNames = (tags?: TagLabel[]) =>
  (tags ?? []).map(({ tagFQN }) => tagFQN);

// The tags a request removes and adds, as an activity card shows a tags change.
const getTagChange = (
  payload: TagUpdatePayload
): ActivityChange | undefined => {
  const before = tagNames(payload.tagsToRemove);
  const after = tagNames(payload.tagsToAdd);

  return before.length || after.length
    ? { labelKey: 'label.tag-plural', before, after, isText: false }
    : undefined;
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
    // Approving applies both lists, so the approver sees both.
    change: getTagChange(payload),
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
    change: payload.newDescription
      ? {
          labelKey: 'label.description',
          // Filled from the entity when the payload carries no snapshot
          // (withExistingValues).
          before: payload.currentDescription
            ? [payload.currentDescription]
            : [],
          after: [payload.newDescription],
          isText: true,
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
            value: {
              kind: 'users',
              refs: currentOwners,
              title: t('label.owner-plural'),
            },
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

// The fields still missing and whether the stage's conditions hold, which the server rewrites as
// they change; the fixed instruction sits where other types put their requester's context.
const describeMetadataCompletion = (
  task: Task,
  t: Translate
): Partial<TaskDetailDescriptor> => {
  const payload = getMetadataCompletionPayload(task);
  // A closed task keeps the payload it had when it closed, which no longer describes the asset.
  const isOpen = task.status === TaskStatus.Open;
  const missingFields = isOpen ? payload.missingFields ?? [] : [];

  return {
    rows: [
      ...(missingFields.length > 0
        ? [
            {
              key: 'missingFields',
              icon: 'columns' as const,
              label: t('label.missing-field-plural'),
              value: {
                kind: 'list' as const,
                items: missingFields.map((field) => ({
                  label: getRequiredFieldLabel(field, t),
                })),
                title: t('label.missing-field-plural'),
              },
            },
          ]
        : []),
      ...textRow(
        'revisionComment',
        'type',
        t('label.comment'),
        payload.revision
          ? payload.revision.comment ??
              t('message.metadata-completion-revision-no-comment')
          : undefined
      ),
      ...textRow(
        'revisionRequestedBy',
        'user',
        t('label.requested-by'),
        payload.revision?.requestedBy
      ),
      // An unmet condition is reported, not spelled out: the stage's rule may be any JSON Logic.
      ...textRow(
        'conditions',
        'shield',
        t('label.condition-plural'),
        isOpen && payload.conditionsMet === false
          ? t('message.lifecycle-conditions-not-met')
          : undefined
      ),
      ...getCommonRows(task, t),
    ],
    callout: {
      label: t('label.context'),
      text: getMetadataCompletionInstruction(payload, t),
    },
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
  [TaskType.MetadataCompletion]: describeMetadataCompletion,
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

type DescribedField = {
  name?: string;
  description?: string;
  tags?: TagLabel[];
  children?: DescribedField[];
};
type DescribedEntity = {
  description?: string;
  tags?: TagLabel[];
  columns?: DescribedField[];
};

const COLUMN_DESCRIPTION_PATH = /^columns\.(.+)\.description$/;
const COLUMN_TAGS_PATH = /^columns\.(.+?)(?:\.tags)?$/;

// The paths that name the entity itself; any other path names one of its
// fields, and one this cannot resolve (a topic's schema field, a container's
// data-model column) shows nothing rather than the entity's values.
const ENTITY_LEVEL_PATHS = new Set(['', 'description', 'tags', 'entity']);

// Follows a column path's names down through nested columns.
const findColumnByPath = (
  columns: DescribedField[] | undefined,
  names: string[]
): DescribedField | undefined =>
  names.reduce<{ found?: DescribedField; level?: DescribedField[] }>(
    ({ level }, name) => {
      const found = level?.find((column) => column.name === name);

      return { found, level: found?.children };
    },
    { level: columns }
  ).found;

// A nested column named on its own, without its parents.
const findColumnByName = (
  columns: DescribedField[] | undefined,
  name: string
): DescribedField | undefined =>
  columns?.reduce<DescribedField | undefined>(
    (found, column) =>
      found ??
      (column.name === name ? column : findColumnByName(column.children, name)),
    undefined
  );

// What a field path names on its entity: the entity itself, or a column by its
// path (`address.city`, `"a.b"` with its quotes dropped).
const getField = (
  entity: EntityUnion | undefined,
  fieldPath: string | undefined,
  columnPath: RegExp
): DescribedField | DescribedEntity | undefined => {
  const typed = entity as DescribedEntity | undefined;
  const path = fieldPath ?? '';
  if (ENTITY_LEVEL_PATHS.has(path)) {
    return typed;
  }
  const column = columnPath.exec(path)?.[1];
  const names = column
    ? Fqn.split(column).map((name) => Fqn.unquoteName(name))
    : [];
  const byPath = findColumnByPath(typed?.columns, names);

  return (
    byPath ??
    (names.length === 1
      ? findColumnByName(typed?.columns, names[0])
      : undefined)
  );
};

// The description's Existing side: the payload's snapshot when it has one,
// else the field's description as it is now.
const withExistingDescription = (
  change: ActivityChange,
  task: Task,
  entity?: EntityUnion
): ActivityChange => {
  const { fieldPath } = getPayload<DescriptionUpdatePayload>(task);
  const existing = getField(
    entity,
    fieldPath,
    COLUMN_DESCRIPTION_PATH
  )?.description?.trim();

  return change.before.length || !existing
    ? change
    : { ...change, before: [existing] };
};

// The tags a tag task keeps: the field's current tags (the payload's snapshot,
// else the asset as it is now) less those it removes or adds.
const withKeptTags = (
  change: ActivityChange,
  task: Task,
  entity?: EntityUnion
): ActivityChange => {
  const payload = getPayload<TagUpdatePayload>(task);
  // Tasks often carry an empty currentTags by default rather than a
  // snapshot, so only a non-empty one stands in for the asset.
  const current = isEmpty(payload.currentTags)
    ? getField(entity, payload.fieldPath, COLUMN_TAGS_PATH)?.tags
    : payload.currentTags;
  const changed = new Set([...change.before, ...change.after]);
  const unchanged = tagNames(current).filter((name) => !changed.has(name));

  return { ...change, unchanged };
};

/**
 * A task's change with what the asset holds now: a description's Existing
 * text, or the tags a tag request keeps.
 */
export const withExistingValues = (
  change: ActivityChange | undefined,
  task: Task,
  entity?: EntityUnion
): ActivityChange | undefined => {
  if (!change) {
    return undefined;
  }

  return change.isText
    ? withExistingDescription(change, task, entity)
    : withKeptTags(change, task, entity);
};

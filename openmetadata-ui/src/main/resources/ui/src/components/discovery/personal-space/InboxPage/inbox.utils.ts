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

import { TFunction } from 'i18next';
import { castArray, compact, uniq } from 'lodash';
import { DateTime } from 'luxon';
import { DateFilterType } from 'Models';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import {
  Task,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { EntityReference } from '../../../../generated/type/entityReference';
import { Reaction, ReactionType } from '../../../../generated/type/reaction';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { InboxDateRange } from '../../../../interface/inbox.interface';
import {
  addActivityReaction,
  removeActivityReaction,
} from '../../../../rest/activityAPI';
import {
  addConversationReaction,
  removeConversationReaction,
} from '../../../../rest/conversationsAPI';
import {
  formatDateTimeLong,
  getCurrentMillis,
  getEndOfDayInMillis,
  getEpochMillisForPastDays,
  getRelativeCalendar,
  getRelativeTime,
  getStartOfDayInMillis,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// e.g. "Jun 05, 2026, 03:01 PM" — no timezone offset.
export const ACTIVITY_DATE_FORMAT = 'MMM dd, yyyy, hh:mm a';
// Under a day header the date is already shown, so a card needs only the time.
export const ACTIVITY_CLOCK_FORMAT = 'hh:mm a';
// The day header's date, e.g. "Thu, Jul 30".
const ACTIVITY_DAY_FORMAT = 'ccc, MMM d';

/**
 * Recent activity reads best relative ("2 hours ago"); once it is a few days
 * old an absolute date is clearer, so switch over at the 3-day mark.
 */
export const formatActivityTime = (timestamp?: number): string => {
  if (!timestamp) {
    return '';
  }

  return getCurrentMillis() - timestamp >= THREE_DAYS_MS
    ? formatDateTimeLong(timestamp, ACTIVITY_DATE_FORMAT)
    : getRelativeTime(timestamp);
};

/** What an activity changed, as display values for the card's change panel. */
export interface ActivityChange {
  labelKey: string;
  before: string[];
  after: string[];
  // Descriptions are prose, not a set of chips.
  isText: boolean;
}

const CHANGE_LABEL_KEY: Partial<Record<ActivityEventType, string>> = {
  [ActivityEventType.TagsUpdated]: 'label.tag-plural',
  [ActivityEventType.ColumnTagsUpdated]: 'label.tag-plural',
  [ActivityEventType.OwnerUpdated]: 'label.owner-plural',
  [ActivityEventType.DomainUpdated]: 'label.domain-plural',
  [ActivityEventType.DescriptionUpdated]: 'label.description',
  [ActivityEventType.ColumnDescriptionUpdated]: 'label.description',
};

const DESCRIPTION_EVENTS = new Set([
  ActivityEventType.DescriptionUpdated,
  ActivityEventType.ColumnDescriptionUpdated,
]);

// Tags carry a tagFQN; owners and domains are entity references.
const getChangeValueName = (value: TagLabel | EntityReference): string =>
  'tagFQN' in value ? value.tagFQN : getEntityName(value);

// The server stores each side as JSON truncated at 1000 characters, so a long
// list may not parse; undefined lets the card fall back to the summary.
const parseChangeValues = (value?: string): string[] | undefined => {
  if (!value) {
    return [];
  }
  try {
    return castArray(JSON.parse(value)).map(getChangeValueName);
  } catch {
    return undefined;
  }
};

export const getActivityChange = (
  activity: ActivityEvent
): ActivityChange | undefined => {
  const labelKey = CHANGE_LABEL_KEY[activity.eventType];
  if (!labelKey) {
    return undefined;
  }
  const isText = DESCRIPTION_EVENTS.has(activity.eventType);
  // Descriptions stay markdown; the panel renders them as the entity page does.
  const parse = isText
    ? (value?: string) => compact([value?.trim()])
    : parseChangeValues;
  const before = parse(activity.oldValue);
  const after = parse(activity.newValue);
  const hasChange = Boolean(before?.length || after?.length);

  return before && after && hasChange
    ? { labelKey, before, after, isText }
    : undefined;
};

// A card's sentence, by event type; tags and descriptions also depend on
// whether a column changed and which way.
const EVENT_LABEL_KEY: Partial<Record<ActivityEventType, string>> = {
  [ActivityEventType.EntityCreated]: 'message.activity-created-asset',
  [ActivityEventType.EntityDeleted]: 'message.activity-deleted-asset',
  [ActivityEventType.EntitySoftDeleted]: 'message.activity-deleted-asset',
  [ActivityEventType.EntityRestored]: 'message.activity-restored-asset',
  [ActivityEventType.OwnerUpdated]: 'message.activity-changed-owner',
  [ActivityEventType.DomainUpdated]: 'message.activity-changed-domain',
  [ActivityEventType.TierUpdated]: 'message.activity-changed-tier',
  [ActivityEventType.CustomPropertyUpdated]:
    'message.activity-updated-custom-property',
  [ActivityEventType.TestCaseStatusChanged]:
    'message.activity-updated-test-status',
  [ActivityEventType.PipelineStatusChanged]:
    'message.activity-updated-pipeline-status',
};

enum TagChange {
  Added = 'added',
  Removed = 'removed',
  Changed = 'changed',
}

type ChangeTarget = 'asset' | 'column';

// [one value, several values]; a mixed change reads the same for any count.
const TAG_LABEL_KEY: Record<
  ChangeTarget,
  Record<TagChange, [string, string]>
> = {
  asset: {
    [TagChange.Added]: [
      'message.activity-added-tag',
      'message.activity-added-tag-plural',
    ],
    [TagChange.Removed]: [
      'message.activity-removed-tag',
      'message.activity-removed-tag-plural',
    ],
    [TagChange.Changed]: [
      'message.activity-changed-tags',
      'message.activity-changed-tags',
    ],
  },
  column: {
    [TagChange.Added]: [
      'message.activity-added-column-tag',
      'message.activity-added-column-tag-plural',
    ],
    [TagChange.Removed]: [
      'message.activity-removed-column-tag',
      'message.activity-removed-column-tag-plural',
    ],
    [TagChange.Changed]: [
      'message.activity-changed-column-tags',
      'message.activity-changed-column-tags',
    ],
  },
};

const DESCRIPTION_LABEL_KEY: Record<ChangeTarget, string> = {
  asset: 'message.activity-updated-description',
  column: 'message.activity-updated-column-description',
};

const TIER_TAG_PREFIX = 'Tier.';

const getChangeTarget = ({ eventType, fieldName }: ActivityEvent) =>
  eventType === ActivityEventType.ColumnTagsUpdated ||
  eventType === ActivityEventType.ColumnDescriptionUpdated ||
  fieldName?.startsWith('columns.')
    ? 'column'
    : 'asset';

// Values cut off by the server parse to nothing, which reads as a change.
const getTagChange = (before: string[], after: string[]): TagChange => {
  if (!before.length) {
    return after.length ? TagChange.Added : TagChange.Changed;
  }

  return after.length ? TagChange.Changed : TagChange.Removed;
};

// Tier is stored as a tag, but the design names it.
const isTierChange = (tags: string[]) =>
  tags.length > 0 && tags.every((tag) => tag.startsWith(TIER_TAG_PREFIX));

const getTagsLabel = (activity: ActivityEvent, t: TFunction): string => {
  const { before = [], after = [] } = getActivityChange(activity) ?? {};
  if (isTierChange([...before, ...after])) {
    return t('message.activity-changed-tier');
  }
  const count = after.length || before.length;
  const [one, many] =
    TAG_LABEL_KEY[getChangeTarget(activity)][getTagChange(before, after)];

  return t(count > 1 ? many : one, { count });
};

/**
 * The card's sentence after the actor's name ("added a tag to a column"),
 * complete on its own: the entity is the line below it.
 */
export const getActivityEventLabel = (
  activity: ActivityEvent,
  t: TFunction
): string => {
  const { eventType, fieldName } = activity;
  if (
    eventType === ActivityEventType.TagsUpdated ||
    eventType === ActivityEventType.ColumnTagsUpdated
  ) {
    return getTagsLabel(activity, t);
  }
  if (DESCRIPTION_EVENTS.has(eventType)) {
    return t(DESCRIPTION_LABEL_KEY[getChangeTarget(activity)]);
  }
  const labelKey = EVENT_LABEL_KEY[eventType];
  if (labelKey) {
    return t(labelKey);
  }

  return fieldName
    ? t('label.updated-field-for-lowercase', { field: fieldName })
    : t('message.activity-updated-asset');
};

/**
 * One edit that both removes and adds values on a list field (swapping an
 * owner, replacing a tag) is stored as two events, a removal and an addition,
 * sharing the entity, field and timestamp. Fold each removal into its addition
 * so the card reads Before → After. The addition keeps its id, so replies and
 * reactions left on the removal event are not shown.
 */
export const pairFieldChanges = (
  activities: ActivityEvent[]
): ActivityEvent[] => {
  const changeKey = ({ entity, fieldName, timestamp }: ActivityEvent) =>
    fieldName ? `${entity.id}|${fieldName}|${timestamp}` : undefined;
  const removals = new Map<string, ActivityEvent>();
  activities.forEach((activity) => {
    const key = changeKey(activity);
    if (key && activity.oldValue && !activity.newValue) {
      removals.set(key, activity);
    }
  });
  const paired = new Set<ActivityEvent>();
  const folded = activities.map((activity) => {
    const key = changeKey(activity);
    const removal =
      key && activity.newValue && !activity.oldValue
        ? removals.get(key)
        : undefined;
    if (removal) {
      paired.add(removal);
    }

    return removal ? { ...activity, oldValue: removal.oldValue } : activity;
  });

  return folded.filter((activity) => !paired.has(activity));
};

// The Activity tab's sub-tabs: whose activity the feed shows.
export enum ActivityFilter {
  All = 'all',
  Mentions = 'mentions',
  MyAssets = 'my-assets',
  Following = 'following',
}

export enum ActivityGrouping {
  Day = 'day',
  Asset = 'asset',
  User = 'user',
}

// The Type filter's options: the change panel's field labels, plus Other for
// everything without one (lifecycle events, conversations).
export const ACTIVITY_TYPE_OTHER = 'label.other';
export const ACTIVITY_TYPE_KEYS = [
  ...uniq(compact(Object.values(CHANGE_LABEL_KEY))),
  ACTIVITY_TYPE_OTHER,
];

export const getActivityTypeKey = (activity?: ActivityEvent): string =>
  (activity && CHANGE_LABEL_KEY[activity.eventType]) ?? ACTIVITY_TYPE_OTHER;

// "Today · Thu, Jul 30", "2 days ago · Wed, Jul 28"
export const getActivityDayLabel = (timestamp: number): string =>
  `${getRelativeCalendar(timestamp, undefined, 'days')} · ${formatDateTimeLong(
    timestamp,
    ACTIVITY_DAY_FORMAT
  )}`;

// Selected date window for the Inbox (Activity + Tasks), passed to the feed/task
// list APIs as startTs/endTs (server-side filtering).
export type { InboxDateRange } from '../../../../interface/inbox.interface';

// The window a date preset covers: from the start of its first day to the end
// of today. getDefaultInboxDateRange (last 30 days) seeds the page and the
// sidebar inbox-icon count.
export const getInboxDateRange = (days: number): InboxDateRange => ({
  startTs: getStartOfDayInMillis(getEpochMillisForPastDays(days)),
  endTs: getEndOfDayInMillis(getCurrentMillis()),
});

export const DEFAULT_INBOX_DATE_PRESET = 'last30days';

export const getDefaultInboxDateRange = (): InboxDateRange =>
  getInboxDateRange(PROFILER_FILTER_RANGE.last30days.days);

const ACTIVITY_DAY_MS = 24 * 60 * 60 * 1000;

// /activity and /my-feed hard-cap the window at 30 days server-side.
export const MAX_ACTIVITY_DAYS = 30;

// Single-window page size (200 = /activity per-request max; no cursor paging).
export const ACTIVITY_LIMIT = 200;

// /conversations caps limit at 100 (@Max(100) on ConversationResource.list) —
// half what /activity allows. Sending ACTIVITY_LIMIT here fails bean validation
// with a 400, so the two endpoints need separate constants.
export const CONVERSATION_LIMIT = 100;

// Presets capped to the activity API's 30-day window (drops 60-day+); titles are
// translated by the picker's consumer.
export const INBOX_DATE_RANGE_OPTIONS: DateFilterType = Object.fromEntries(
  (
    Object.entries(PROFILER_FILTER_RANGE) as [string, DateFilterType[string]][]
  ).filter(([, value]) => value.days <= MAX_ACTIVITY_DAYS)
);

// Convert the Inbox date window to the `days` param the /activity API takes,
// clamped to the server's 30-day cap (defaults to the cap when unset).
export const getActivityWindowDays = (dateRange?: InboxDateRange): number => {
  if (!dateRange?.startTs || !dateRange?.endTs) {
    return MAX_ACTIVITY_DAYS;
  }
  const days = Math.ceil(
    (dateRange.endTs - dateRange.startTs) / ACTIVITY_DAY_MS
  );

  return Math.min(Math.max(days, 1), MAX_ACTIVITY_DAYS);
};

// A list that came back a full page may hold fewer items than the window has,
// so its length is a floor, not a total.
export interface InboxCount {
  total: number;
  isCapped: boolean;
}

// Badges stop counting here: past it the exact figure stops helping triage.
const MAX_DISPLAYED_COUNT = 99;

// "42"; "30+" when the count is only a floor; "99+" once it passes the cap. A
// capped page shrinks after pairing and window clipping, so the floor is the
// visible count, not the page size.
export const formatInboxCount = ({ total, isCapped }: InboxCount): string => {
  if (total > MAX_DISPLAYED_COUNT) {
    return `${MAX_DISPLAYED_COUNT}+`;
  }

  return isCapped ? `${total}+` : String(total);
};

/**
 * Whether a millis timestamp falls inside the selected Inbox date window.
 * An undefined range (or undefined bound) means "no constraint".
 */
export const isWithinInboxRange = (
  timestamp?: number,
  range?: InboxDateRange
): boolean => {
  if (!range) {
    return true;
  }
  const ts = timestamp ?? 0;
  const afterStart = range.startTs === undefined || ts >= range.startTs;
  const beforeEnd = range.endTs === undefined || ts <= range.endTs;

  return afterStart && beforeEnd;
};

const INBOX_DATE_TIME_FORMAT = 'LLL dd, yyyy, hh:mm a';
const INBOX_DATE_FORMAT = 'LLL d, yyyy';

// Task timeline timestamp in the design format, e.g. "May 13, 2026, 08:45 PM".
export const formatInboxDateTime = (timestamp?: number): string =>
  timestamp
    ? DateTime.fromMillis(timestamp).toFormat(INBOX_DATE_TIME_FORMAT)
    : '';

// Date-only variant, e.g. "May 13, 2026" or "Oct 8, 2026".
export const formatInboxDate = (timestamp?: number): string =>
  timestamp ? DateTime.fromMillis(timestamp).toFormat(INBOX_DATE_FORMAT) : '';

// Task statuses that keep a task in the server-side "Open" bucket, mirroring
// TaskBucketSql.SHARED_OPEN_STATUSES on the backend.
const OPEN_TASK_STATUSES = new Set<TaskStatus>([
  TaskStatus.Open,
  TaskStatus.InProgress,
  TaskStatus.Pending,
  TaskStatus.ManualRevoke,
]);

/**
 * Whether a task belongs to the "Open" status bucket, mirroring the backend
 * TaskBucketSql predicate: the shared open statuses, plus a Data Access Request
 * that is Approved (still awaiting grant, so not yet closed). Used to decide
 * whether a just-resolved task should stay in the list — a DAR approval keeps it
 * Open, so it must not be removed optimistically.
 */
export const isTaskOpen = (task: Pick<Task, 'status' | 'type'>): boolean =>
  OPEN_TASK_STATUSES.has(task.status) ||
  (task.type === TaskType.DataAccessRequest &&
    task.status === TaskStatus.Approved);

// Open statuses past the approval step: an access request awaiting its grant
// or a manual revoke. Its holder still has work, but not an approval, and the
// workflow's stage name says what.
const PAST_APPROVAL_STATUSES = new Set<TaskStatus>([
  TaskStatus.Approved,
  TaskStatus.ManualRevoke,
]);

/**
 * Whether an open task awaits the viewer's approval: it is assigned to them or
 * one of their teams and has not passed its approval step. The Status filter
 * and the status label both read it, so a task filed under "Pending approval"
 * also says so.
 */
export const isTaskPendingViewer = (
  task: Pick<Task, 'status' | 'type' | 'assignees'>,
  currentUserIds: ReadonlySet<string>
): boolean =>
  isTaskOpen(task) &&
  !PAST_APPROVAL_STATUSES.has(task.status) &&
  (task.assignees ?? []).some(({ id }) => currentUserIds.has(id));

// Sort key for the merged inbox list and its day groups. Mirrors upstream's
// getConversationTimestamp (ActivityFeedListV1New.component.tsx): last activity
// (updatedAt) first, falling back to createdAt, so a replied conversation rises
// above newer unreplied ones (OpenMetadata#30879, #30909).
export const getFeedSortTimestamp = (feed: Conversation): number =>
  feed.updatedAt ?? feed.createdAt ?? 0;

export interface ReactionUser {
  id?: string;
  name?: string;
  displayName?: string;
}

/**
 * Toggle the user's reaction on an activity event via PUT/DELETE
 * /activity/{id}/reaction; returns the optimistic list.
 */
export const toggleActivityReaction = async (
  activityId: string,
  currentReactions: Reaction[],
  reactionType: ReactionType,
  operation: ReactionOperation,
  currentUser?: ReactionUser
): Promise<Reaction[]> => {
  const existing = currentReactions;
  const updated =
    operation === ReactionOperation.ADD
      ? [
          ...existing,
          {
            reactionType,
            // Carry name/displayName so the reaction tooltip can show who
            // reacted without a follow-up user lookup.
            user: {
              id: currentUser?.id as string,
              type: 'user',
              name: currentUser?.name,
              displayName: currentUser?.displayName,
            },
          } as Reaction,
        ]
      : existing.filter(
          (reaction) =>
            !(
              reaction.reactionType === reactionType &&
              reaction.user?.id === currentUser?.id
            )
        );

  if (operation === ReactionOperation.ADD) {
    await addActivityReaction(activityId, reactionType);
  } else {
    await removeActivityReaction(activityId, reactionType);
  }

  return updated;
};

/**
 * Toggle the user's reaction on a conversation root via PUT/DELETE
 * /conversations/{id}/reaction; returns the optimistic list.
 */
export const toggleConversationReaction = async (
  conversationId: string,
  currentReactions: Reaction[],
  reactionType: ReactionType,
  operation: ReactionOperation,
  currentUser?: ReactionUser
): Promise<Reaction[]> => {
  const existing = currentReactions;
  const updated =
    operation === ReactionOperation.ADD
      ? [
          ...existing,
          {
            reactionType,
            user: {
              id: currentUser?.id as string,
              type: 'user',
              name: currentUser?.name,
              displayName: currentUser?.displayName,
            },
          } as Reaction,
        ]
      : existing.filter(
          (reaction) =>
            !(
              reaction.reactionType === reactionType &&
              reaction.user?.id === currentUser?.id
            )
        );

  if (operation === ReactionOperation.ADD) {
    await addConversationReaction(conversationId, reactionType);
  } else {
    await removeConversationReaction(conversationId, reactionType);
  }

  return updated;
};

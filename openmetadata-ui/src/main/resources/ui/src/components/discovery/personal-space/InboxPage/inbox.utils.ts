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
import { Reaction, ReactionType } from '../../../../generated/type/reaction';
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

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
// e.g. "Jun 05, 2026, 03:01 PM" — no timezone offset.
const ACTIVITY_DATE_FORMAT = 'MMM dd, yyyy, hh:mm a';

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

/**
 * Header action text for an activity-event card ("updated Description for"),
 * derived from `eventType` (+ `fieldName`), reusing existing lowercase keys.
 */
export const getActivityEventLabel = (
  activity: ActivityEvent,
  t: TFunction
): string => {
  const updated = t('label.updated-lowercase');
  const forPrep = t('label.for-lowercase');
  const onPrep = t('label.on-lowercase');

  switch (activity.eventType) {
    case ActivityEventType.EntityCreated:
      return `${t('label.created-lowercase')} ${onPrep}`;
    case ActivityEventType.EntityDeleted:
    case ActivityEventType.EntitySoftDeleted:
      return `${t('label.deleted-lowercase')} ${onPrep}`;
    case ActivityEventType.EntityRestored:
      return `${t('label.restored-lowercase')} ${onPrep}`;
    case ActivityEventType.DescriptionUpdated:
    case ActivityEventType.ColumnDescriptionUpdated:
      return `${updated} ${t('label.description')} ${forPrep}`;
    case ActivityEventType.TagsUpdated:
    case ActivityEventType.ColumnTagsUpdated:
      return `${t('label.added-lowercase')} ${t('label.tag-plural')} ${t(
        'label.to-lowercase'
      )}`;
    case ActivityEventType.OwnerUpdated:
      return `${updated} ${t('label.owner')} ${forPrep}`;
    case ActivityEventType.DomainUpdated:
      return `${updated} ${t('label.domain')} ${forPrep}`;
    case ActivityEventType.TierUpdated:
      return `${updated} ${t('label.tier')} ${forPrep}`;
    case ActivityEventType.CustomPropertyUpdated:
      return `${updated} ${t('label.custom-property')} ${forPrep}`;
    case ActivityEventType.TestCaseStatusChanged:
      return `${updated} ${t('label.status')} ${onPrep}`;
    case ActivityEventType.PipelineStatusChanged:
      return `${updated} ${t('label.pipeline')} ${t('label.status')} ${onPrep}`;
    case ActivityEventType.EntityUpdated:
    default:
      return activity.fieldName
        ? `${updated} ${activity.fieldName} ${forPrep}`
        : `${updated} ${onPrep}`;
  }
};

// Activity feed scope: "all" shows every conversation; "me" restricts to
// conversations the current user owns or follows.
export type InboxScope = 'all' | 'me';

// Selected date window for the Inbox (Activity + Tasks), passed to the feed/task
// list APIs as startTs/endTs (server-side filtering).
export interface InboxDateRange {
  startTs?: number;
  endTs?: number;
  // Preset key of the selected range (e.g. 'last30days', 'customRange'). Kept so
  // the persisted range can be compared to the default by key rather than by
  // timestamps, which drift between mounts (now-based vs day-aligned millis).
  key?: string;
  // Label the picker shows for this range (e.g. "Custom Range"). Persisted so the
  // dropdown button re-seeds to the selected range after a tab-switch remount
  // instead of falling back to the default preset title.
  title?: string;
}

// Default Inbox window: the last 30 days (start-of-day to now), used by the page
// on first render and by the sidebar inbox-icon count.
export const getDefaultInboxDateRange = (): InboxDateRange => ({
  startTs: getStartOfDayInMillis(
    getEpochMillisForPastDays(PROFILER_FILTER_RANGE.last30days.days)
  ),
  endTs: getEndOfDayInMillis(getCurrentMillis()),
});

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

const INBOX_DATE_TIME_FORMAT = 'dd LLL, yyyy hh:mm a';
const INBOX_DATE_FORMAT = 'dd LLL, yyyy';

// Task-card timestamp in the figma format, e.g. "13 May, 2026 08:45 PM".
export const formatInboxDateTime = (timestamp?: number): string =>
  timestamp
    ? DateTime.fromMillis(timestamp).toFormat(INBOX_DATE_TIME_FORMAT)
    : '';

// Date-only variant, e.g. "13 May, 2026".
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

export interface RelativeDayGroup<T> {
  day: string;
  items: T[];
}

export type ActivityBucketKey = 'today' | 'yesterday' | 'earlier';

export interface ActivityBucket {
  key: ActivityBucketKey;
  // Sub-label shown next to the bucket title, e.g. "Tuesday, July 9" or a
  // "July 4 - July 7" range for the Earlier bucket.
  dateText: string;
  items: Conversation[];
}

// Exported because useInboxActivity sorts the merged activity+conversation list
// by it. createdAt is the Conversation V2 counterpart of the legacy threadTs.
export const getFeedTimestamp = (feed: Conversation): number =>
  feed.createdAt ?? feed.updatedAt ?? 0;

const SINGLE_DAY_FORMAT = 'cccc, LLLL d';
const RANGE_DAY_FORMAT = 'LLLL d';

/**
 * Bucket conversations into Today / Yesterday / Earlier (matching the figma),
 * each with a human date sub-label. Earlier collapses everything older into a
 * single group with a date range. Empty buckets are omitted; order is fixed
 * (today → yesterday → earlier).
 */
export const getActivityBuckets = (feeds: Conversation[]): ActivityBucket[] => {
  const now = DateTime.now();
  const yesterdayStart = now.minus({ days: 1 });
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const earlier: Conversation[] = [];

  feeds.forEach((feed) => {
    const dt = DateTime.fromMillis(getFeedTimestamp(feed));
    if (dt.hasSame(now, 'day')) {
      today.push(feed);
    } else if (dt.hasSame(yesterdayStart, 'day')) {
      yesterday.push(feed);
    } else {
      earlier.push(feed);
    }
  });

  const singleDate = (items: Conversation[]): string =>
    DateTime.fromMillis(getFeedTimestamp(items[0])).toFormat(SINGLE_DAY_FORMAT);

  const buckets: ActivityBucket[] = [];
  if (today.length) {
    buckets.push({ key: 'today', dateText: singleDate(today), items: today });
  }
  if (yesterday.length) {
    buckets.push({
      key: 'yesterday',
      dateText: singleDate(yesterday),
      items: yesterday,
    });
  }
  if (earlier.length) {
    const timestamps = earlier.map(getFeedTimestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const format = (ms: number) =>
      DateTime.fromMillis(ms).toFormat(RANGE_DAY_FORMAT);
    buckets.push({
      key: 'earlier',
      dateText: min === max ? format(min) : `${format(min)} - ${format(max)}`,
      items: earlier,
    });
  }

  return buckets;
};

/**
 * Bucket a list into ordered groups keyed by a relative-calendar day label
 * ("Today", "Yesterday", …) computed from each item's timestamp. Preserves the
 * incoming order so callers control sorting upstream.
 */
export const groupByRelativeDay = <T>(
  items: T[],
  getTimestamp: (item: T) => number | undefined
): RelativeDayGroup<T>[] => {
  const groups: RelativeDayGroup<T>[] = [];

  items.forEach((item) => {
    const day = getRelativeCalendar(getTimestamp(item) || 0);
    const existing = groups.find((group) => group.day === day);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  });

  return groups;
};

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

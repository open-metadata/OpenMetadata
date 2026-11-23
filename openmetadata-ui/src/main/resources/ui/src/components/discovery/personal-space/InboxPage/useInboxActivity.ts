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

import {
  QueryClient,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import { ConversationFilterType } from '../../../../generated/type/conversationFilterType';
import { Reaction } from '../../../../generated/type/reaction';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getActivityEvents,
  getFollowingActivityFeed,
  getMentionsActivityFeed,
  getMyActivityFeed,
  getUserActivity,
} from '../../../../rest/activityAPI';
import { listConversations } from '../../../../rest/conversationsAPI';
import {
  getTaskCommentMentions,
  TaskCommentMention,
} from '../../../../utils/tasks/TaskMentions.utils';
import {
  ActivityFilter,
  ACTIVITY_LIMIT,
  CONVERSATION_LIMIT,
  DEFAULT_INBOX_DATE_PRESET,
  getActivityWindowDays,
  getDefaultInboxDateRange,
  getFeedSortTimestamp,
  InboxCount,
  InboxDateRange,
  isWithinInboxRange,
  pairFieldChanges,
} from './inbox.utils';

export const INBOX_ACTIVITY_QUERY_KEY = 'inbox-activity';

// Short window so the tab list and the badge share one fetch.
const INBOX_ACTIVITY_STALE_TIME = 30 * 1000;

export interface InboxActivityResult {
  activities: ActivityEvent[];
  threads: Conversation[];
  taskMentions?: TaskCommentMention[];
  taskMentionsReadAt?: number;
  // Either list came back a full page, so the window may hold more.
  isCapped: boolean;
  // Where the feed stops being whole: older items may be missing from here on.
  // Unset when the cut can't be placed in the feed's own times.
  cutAt?: number;
}

// An inbox card represents one event, conversation, or task comment.
export interface InboxActivityItem {
  activity?: ActivityEvent;
  feed?: Conversation;
  taskMention?: TaskCommentMention;
}

export const getInboxItemId = (item: InboxActivityItem): string =>
  String(
    item.activity?.id ?? item.feed?.id ?? item.taskMention?.comment.id ?? ''
  );

// When an item happened: an event's timestamp, a conversation's last activity.
export const getInboxItemTimestamp = (item: InboxActivityItem): number =>
  item.activity?.timestamp ??
  item.taskMention?.comment.createdAt ??
  (item.feed ? getFeedSortTimestamp(item.feed) : 0);

// Each sub-tab's activity events. Mentions are the events whose replies name
// the viewer; the conversations that name them come alongside.
const ACTIVITY_REQUEST: Record<ActivityFilter, typeof getActivityEvents> = {
  [ActivityFilter.All]: getActivityEvents,
  [ActivityFilter.MyAssets]: getMyActivityFeed,
  [ActivityFilter.Following]: getFollowingActivityFeed,
  [ActivityFilter.Mentions]: getMentionsActivityFeed,
};

// /activity/user/{id} takes no startTs and counts `days` back from now, so a
// window starting at midnight needs the part-day before it too; clipToWindow
// trims the excess. Capped at that endpoint's @Max(90).
const USER_ACTIVITY_MAX_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const getDaysSince = (startTs: number) =>
  Math.min(
    Math.max(Math.ceil((Date.now() - startTs) / DAY_MS), 1),
    USER_ACTIVITY_MAX_DAYS
  );

interface ActivityWindowParams {
  days: number;
  startTs?: number;
  limit: number;
}

// The same sub-tabs for another user. Their "All" is what they did plus the
// conversations around their assets, not everything the viewer can see.
const SCOPED_ACTIVITY_REQUEST: Record<
  ActivityFilter,
  (
    userId: string,
    params: ActivityWindowParams
  ) => ReturnType<typeof getActivityEvents>
> = {
  [ActivityFilter.All]: (userId, { days, startTs, limit }) =>
    getUserActivity(userId, {
      days: startTs ? getDaysSince(startTs) : days,
      limit,
    }),
  [ActivityFilter.MyAssets]: (userId, params) =>
    getMyActivityFeed({ ...params, userId }),
  [ActivityFilter.Following]: (userId, params) =>
    getFollowingActivityFeed({ ...params, userId }),
  [ActivityFilter.Mentions]: (userId, params) =>
    getMentionsActivityFeed({ ...params, userId }),
};

// "All" is everything the viewer is allowed to see, so no conversation filter.
const CONVERSATION_FILTER: Record<
  ActivityFilter,
  ConversationFilterType | undefined
> = {
  [ActivityFilter.All]: undefined,
  [ActivityFilter.MyAssets]: ConversationFilterType.Owner,
  [ActivityFilter.Following]: ConversationFilterType.Follows,
  [ActivityFilter.Mentions]: ConversationFilterType.Mentions,
};

// Another user's "All" conversations are the ones around them, not every
// conversation the viewer can see.
const getConversationFilter = (filter: ActivityFilter, isScoped: boolean) =>
  isScoped && filter === ActivityFilter.All
    ? ConversationFilterType.OwnerOrFollows
    : CONVERSATION_FILTER[filter];

// The activity API takes whole `days`, so its window reaches back past startTs;
// clip to the exact window the conversations use. Mentions stay as served: that
// window is when the mention was made, so an older event freshly mentioned
// belongs in it.
const clipToWindow = (
  filter: ActivityFilter,
  activities: ActivityEvent[],
  dateRange: InboxDateRange
): ActivityEvent[] =>
  filter === ActivityFilter.Mentions
    ? activities
    : activities.filter(({ timestamp }) =>
        isWithinInboxRange(timestamp, dateRange)
      );

const getEventTimestamp = ({ timestamp }: ActivityEvent) => timestamp ?? 0;

/**
 * A capped list stops at its oldest item, so the other list is cut there too:
 * past it the feed would show one kind alone, as if the other had none.
 * Mentions is left whole: its events carry their own time, not the mention's,
 * so an old event mentioned today would fall before the cut. Its feed is then
 * incomplete from where its conversations stop; where its events stop can't
 * be told in their times.
 * ADR:2026-11-16-a-capped-inbox-feed-is-cut-at-its-oldest-item
 */
const cutToCompleteSpan = (
  filter: ActivityFilter,
  activities: ActivityEvent[],
  threads: Conversation[],
  isActivityCapped: boolean
): InboxActivityResult => {
  const isThreadCapped = threads.length >= CONVERSATION_LIMIT;
  const activityFloor = isActivityCapped
    ? Math.min(...activities.map(getEventTimestamp))
    : 0;
  const threadFloor = isThreadCapped
    ? Math.min(...threads.map(getFeedSortTimestamp))
    : 0;
  const isMentions = filter === ActivityFilter.Mentions;
  const completeFrom = isMentions ? 0 : Math.max(activityFloor, threadFloor);
  const cutAt = isMentions ? threadFloor : completeFrom;

  return {
    activities: activities.filter(
      (activity) => getEventTimestamp(activity) >= completeFrom
    ),
    threads: threads.filter(
      (thread) => getFeedSortTimestamp(thread) >= completeFrom
    ),
    isCapped: isActivityCapped || isThreadCapped,
    cutAt: cutAt || undefined,
  };
};

/**
 * The selected sub-tab's activity events plus its conversations, for the
 * viewer `userId` or, when `isScoped`, for another user `userId`.
 */
const fetchActivityAndConversations = async (
  filter: ActivityFilter,
  userId: string,
  startTs?: number,
  endTs?: number,
  isScoped = false
): Promise<InboxActivityResult> => {
  // startTs gives activity the same lower bound as the conversations: `days` is
  // capped at 30, which falls short of a window starting at the start of a day.
  const days = getActivityWindowDays({ startTs, endTs });
  const params = { days, startTs, limit: ACTIVITY_LIMIT };
  const activityRequest = isScoped
    ? SCOPED_ACTIVITY_REQUEST[filter](userId, params)
    : ACTIVITY_REQUEST[filter](params);
  const filterType = getConversationFilter(filter, isScoped);

  const conversationRequest = listConversations({
    filterType,
    userId: filterType ? userId : undefined,
    limit: CONVERSATION_LIMIT,
    startTs,
    endTs,
  });

  // allSettled, not all: the conversation list is only the fallback shown when
  // there is no activity, so a bad conversation request (a 400 on `limit` once
  // emptied the whole tab) must not blank the activity. A failed activity
  // request does fail the fetch: the conversations alone would read as the
  // whole feed, with counts to match.
  const [activityRes, conversationRes] = await Promise.allSettled([
    activityRequest,
    conversationRequest,
  ]);

  if (activityRes.status === 'rejected') {
    throw activityRes.reason;
  }

  const activities = activityRes.value?.data ?? [];
  const threads =
    conversationRes.status === 'fulfilled'
      ? conversationRes.value.data ?? []
      : [];

  const clipped = clipToWindow(filter, activities, { startTs, endTs });

  // A full page may hold only the newest of more events, unless the clip
  // dropped some: then the page already reached past the window's start, so
  // the window is complete.
  return cutToCompleteSpan(
    filter,
    clipped,
    threads,
    activities.length >= ACTIVITY_LIMIT && clipped.length === activities.length
  );
};

const includesTaskMentions = (filter: ActivityFilter) =>
  filter === ActivityFilter.All || filter === ActivityFilter.Mentions;

const readTaskMentions = (
  mentionedUser: string,
  startTs?: number,
  endTs?: number,
  queryClient?: QueryClient
) => {
  const queryFn = async () => {
    const taskMentionsReadAt = Date.now();
    const taskMentions = await getTaskCommentMentions(mentionedUser, {
      startTs,
      endTs,
      maxResults: CONVERSATION_LIMIT,
    });

    return { taskMentions, taskMentionsReadAt };
  };

  return queryClient
    ? queryClient.fetchQuery({
        queryKey: ['inbox-task-mentions', mentionedUser, startTs, endTs],
        queryFn,
        staleTime: INBOX_ACTIVITY_STALE_TIME,
      })
    : queryFn();
};

const mergeTaskMentions = (
  filter: ActivityFilter,
  window: InboxActivityResult,
  mentionsResult?: Pick<
    InboxActivityResult,
    'taskMentions' | 'taskMentionsReadAt'
  >
): InboxActivityResult => {
  const taskMentions = mentionsResult?.taskMentions;
  const isTaskCapped = (taskMentions?.length ?? 0) >= CONVERSATION_LIMIT;
  const taskFloor = isTaskCapped
    ? Math.min(...(taskMentions ?? []).map(({ comment }) => comment.createdAt))
    : 0;
  const completeFrom = filter === ActivityFilter.Mentions ? 0 : taskFloor;

  return {
    ...window,
    activities: window.activities.filter(
      (activity) => getEventTimestamp(activity) >= completeFrom
    ),
    threads: window.threads.filter(
      (thread) => getFeedSortTimestamp(thread) >= completeFrom
    ),
    ...mentionsResult,
    isCapped: window.isCapped || isTaskCapped,
    cutAt: Math.max(window.cutAt ?? 0, taskFloor) || undefined,
  };
};

export const fetchInboxActivity = async (
  filter: ActivityFilter,
  userId: string | undefined,
  startTs?: number,
  endTs?: number,
  isScoped = false,
  mentionedUser?: string,
  queryClient?: QueryClient
): Promise<InboxActivityResult> => {
  if (!userId) {
    return { activities: [], threads: [], isCapped: false };
  }

  const activityRequest = fetchActivityAndConversations(
    filter,
    userId,
    startTs,
    endTs,
    isScoped
  );
  if (!includesTaskMentions(filter) || !mentionedUser) {
    return activityRequest;
  }

  const [window, mentionsResult] = await Promise.all([
    activityRequest,
    readTaskMentions(mentionedUser, startTs, endTs, queryClient).catch(
      () => undefined
    ),
  ]);

  return mergeTaskMentions(filter, window, mentionsResult);
};

/**
 * Write a card's reactions into every cached sub-tab list that holds it, so a
 * card read back from the cache after switching sub-tab keeps the reaction.
 */
export const writeInboxReactions = (
  queryClient: QueryClient,
  itemId: string,
  reactions: Reaction[]
) =>
  queryClient.setQueriesData<InboxActivityResult>(
    { queryKey: [INBOX_ACTIVITY_QUERY_KEY] },
    (data) =>
      data && {
        ...data,
        activities: data.activities.map((activity) =>
          activity.id === itemId ? { ...activity, reactions } : activity
        ),
        threads: data.threads.map((thread) =>
          thread.id === itemId ? { ...thread, reactions } : thread
        ),
      }
  );

// The user a feed is about: `userId` when given, else the viewer. Scoped only
// when that is someone other than the viewer.
const useFeedSubject = (userId?: string) => {
  const { currentUser } = useApplicationStore();

  return {
    subjectId: userId ?? currentUser?.id,
    isScoped: Boolean(userId) && userId !== currentUser?.id,
    mentionedUser:
      !userId || userId === currentUser?.id ? currentUser?.name : undefined,
  };
};

const getInboxTotal = (data: InboxActivityResult): number =>
  pairFieldChanges(data.activities).length +
  data.threads.length +
  (data.taskMentions?.length ?? 0);

// One query per sub-tab, window and user, so the list and every count share a
// fetch. The user id keys it, so one user's feed never serves another's.
const inboxActivityQuery = (
  filter: ActivityFilter,
  userId: string | undefined,
  dateRange?: InboxDateRange,
  isScoped = false,
  mentionedUser?: string,
  queryClient?: QueryClient
) => ({
  queryKey: [
    INBOX_ACTIVITY_QUERY_KEY,
    filter,
    dateRange?.startTs,
    dateRange?.endTs,
    userId,
    includesTaskMentions(filter) ? mentionedUser : undefined,
  ],
  queryFn: () =>
    fetchInboxActivity(
      filter,
      userId,
      dateRange?.startTs,
      dateRange?.endTs,
      isScoped,
      mentionedUser,
      queryClient
    ),
  enabled: Boolean(userId),
  staleTime: INBOX_ACTIVITY_STALE_TIME,
});

export interface UseInboxActivity extends InboxCount {
  items: InboxActivityItem[];
  // See InboxActivityResult.
  cutAt?: number;
  isLoading: boolean;
  taskMentionsLoaded: boolean;
  taskMentionsReadAt?: number;
  error: unknown;
  refetch: () => void;
}

/**
 * Single source for the Inbox Activity feed, shared by the tab list and the
 * badge (deduped via react-query). Activity events and conversations interleave
 * newest-first — upstream parity, OpenMetadata#30879.
 */
export const useInboxActivity = (
  filter: ActivityFilter,
  dateRange?: InboxDateRange,
  userId?: string
): UseInboxActivity => {
  const { subjectId, isScoped, mentionedUser } = useFeedSubject(userId);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery(
    inboxActivityQuery(
      filter,
      subjectId,
      dateRange,
      isScoped,
      mentionedUser,
      queryClient
    )
  );

  const items: InboxActivityItem[] = useMemo(() => {
    const merged: InboxActivityItem[] = [
      ...pairFieldChanges(data?.activities ?? []).map((activity) => ({
        activity,
      })),
      ...(data?.threads ?? []).map((feed) => ({ feed })),
      ...(data?.taskMentions ?? []).map((taskMention) => ({ taskMention })),
    ];

    // Sort merges newest-first by last activity (updatedAt-first for
    // conversations), matching upstream's ActivityFeedListV1New sort. The id
    // localeCompare tiebreaker mirrors upstream exactly; without it equal-
    // timestamp ordering would fall back to JS sort stability + server order.
    // The id is coerced to a string so a non-string id (e.g. a numeric mock or
    // malformed payload) cannot crash the sort with `localeCompare is not a
    // function`; upstream avoids this by normalizing `id: string` up front.
    return merged.sort(
      (a, b) =>
        getInboxItemTimestamp(b) - getInboxItemTimestamp(a) ||
        getInboxItemId(a).localeCompare(getInboxItemId(b))
    );
  }, [data]);

  return {
    items,
    total: items.length,
    isCapped: data?.isCapped ?? false,
    cutAt: data?.cutAt,
    isLoading,
    taskMentionsLoaded: data?.taskMentions !== undefined,
    taskMentionsReadAt: data?.taskMentionsReadAt,
    // A failed background refresh keeps the cached feed on screen.
    error: data ? null : error,
    refetch,
  };
};

/**
 * Each sub-tab's item count in the window, as its list would show it, and
 * whether that count is a floor.
 * ponytail: a fetch per sub-tab, since the server has no per-feed count; swap
 * for a count endpoint (or unread counts, as the design shows) once one exists.
 */
export const useInboxActivityCounts = (
  dateRange?: InboxDateRange,
  userId?: string
): Partial<Record<ActivityFilter, InboxCount>> => {
  const { subjectId, isScoped, mentionedUser } = useFeedSubject(userId);
  const queryClient = useQueryClient();
  const filters = Object.values(ActivityFilter);
  const results = useQueries({
    queries: filters.map((filter) =>
      inboxActivityQuery(
        filter,
        subjectId,
        dateRange,
        isScoped,
        mentionedUser,
        queryClient
      )
    ),
  });

  return Object.fromEntries(
    filters.flatMap((filter, index) => {
      const data = results[index].data;

      return data
        ? [
            [
              filter,
              {
                total: getInboxTotal(data),
                isCapped: data.isCapped,
              },
            ],
          ]
        : [];
    })
  );
};

/**
 * A user's "All" activity count in the default window: the badge on their
 * Activity tab, sharing its fetch with the tab's list.
 */
export const useUserActivityCount = (
  userId: string | undefined
): number | undefined => {
  const { isScoped, mentionedUser } = useFeedSubject(userId);
  const queryClient = useQueryClient();
  const dateRange = useMemo(
    () => ({ ...getDefaultInboxDateRange(), key: DEFAULT_INBOX_DATE_PRESET }),
    []
  );
  const { data } = useQuery(
    inboxActivityQuery(
      ActivityFilter.All,
      userId,
      dateRange,
      isScoped,
      mentionedUser,
      queryClient
    )
  );

  return data && getInboxTotal(data);
};

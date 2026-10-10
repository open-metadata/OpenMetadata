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

import { QueryClient, useQueries, useQuery } from '@tanstack/react-query';
import { PagingResponse } from 'Models';
import { useMemo } from 'react';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import { ConversationFilterType } from '../../../../generated/type/conversationFilterType';
import { Reaction } from '../../../../generated/type/reaction';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getActivityByEntityLink,
  getActivityEvents,
  getFollowingActivityFeed,
  getMentionsActivityFeed,
  getMyActivityFeed,
  getUserActivity,
} from '../../../../rest/activityAPI';
import { listConversations } from '../../../../rest/conversationsAPI';
import { getUserByName } from '../../../../rest/userAPI';
import {
  ActivityScope,
  getActivityScopeKey,
  INBOX_SCOPE,
  SCOPE_FILTERS,
} from './activityScope';
import {
  ActivityFilter,
  ACTIVITY_LIMIT,
  CONVERSATION_LIMIT,
  getActivityWindowDays,
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
  // Either list came back a full page, so the window may hold more.
  isCapped: boolean;
}

// Exactly one of `activity` or `feed`, matching ActivityFeedItem's props.
export interface InboxActivityItem {
  activity?: ActivityEvent;
  feed?: Conversation;
}

export const getInboxItemId = (item: InboxActivityItem): string =>
  String(item.activity?.id ?? item.feed?.id ?? '');

// When an item happened: an event's timestamp, a conversation's last activity.
export const getInboxItemTimestamp = (item: InboxActivityItem): number =>
  item.activity?.timestamp ?? (item.feed ? getFeedSortTimestamp(item.feed) : 0);

// Each sub-tab's activity events. Mentions are the events whose replies name
// the viewer; the conversations that name them come alongside.
const ACTIVITY_REQUEST: Record<ActivityFilter, typeof getActivityEvents> = {
  [ActivityFilter.All]: getActivityEvents,
  [ActivityFilter.MyAssets]: getMyActivityFeed,
  [ActivityFilter.Following]: getFollowingActivityFeed,
  [ActivityFilter.Mentions]: getMentionsActivityFeed,
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

interface FeedWindow {
  days: number;
  startTs?: number;
  endTs?: number;
}

interface FeedRequests {
  activity: Promise<PagingResponse<ActivityEvent[]>>;
  conversations: Promise<PagingResponse<Conversation[]>>;
}

// A user's own activity has no conversation counterpart: conversations are
// filtered by asset, not by who started them.
const NO_CONVERSATIONS: Promise<PagingResponse<Conversation[]>> =
  Promise.resolve({ data: [], paging: { total: 0 } });

const getInboxRequests = (
  filter: ActivityFilter,
  viewerId: string,
  { days, startTs, endTs }: FeedWindow
): FeedRequests => {
  const filterType = CONVERSATION_FILTER[filter];

  return {
    activity: ACTIVITY_REQUEST[filter]({ days, limit: ACTIVITY_LIMIT }),
    conversations: listConversations({
      filterType,
      userId: filterType ? viewerId : undefined,
      limit: CONVERSATION_LIMIT,
      startTs,
      endTs,
    }),
  };
};

// Everything about one entity, or only what mentions the viewer there.
const getEntityRequests = (
  entityLink: string,
  filter: ActivityFilter,
  viewerId: string,
  { days, startTs, endTs }: FeedWindow
): FeedRequests => {
  const isMentions = filter === ActivityFilter.Mentions;

  return {
    activity: isMentions
      ? getMentionsActivityFeed({ days, limit: ACTIVITY_LIMIT, entityLink })
      : getActivityByEntityLink(entityLink, { days, limit: ACTIVITY_LIMIT }),
    // Its columns' conversations too, as its activity includes their changes.
    conversations: listConversations({
      entityLink,
      includeFields: true,
      filterType: isMentions ? ConversationFilterType.Mentions : undefined,
      userId: isMentions ? viewerId : undefined,
      limit: CONVERSATION_LIMIT,
      startTs,
      endTs,
    }),
  };
};

// The activity API reads a user by id; the link names them.
const getUserRequests = (
  userName: string,
  { days }: FeedWindow
): FeedRequests => ({
  activity: getUserByName(userName).then((user) =>
    getUserActivity(user.id, { days, limit: ACTIVITY_LIMIT })
  ),
  conversations: NO_CONVERSATIONS,
});

const getScopeRequests = (
  scope: ActivityScope,
  filter: ActivityFilter,
  viewerId: string,
  window: FeedWindow
): FeedRequests => {
  switch (scope.type) {
    case 'entity':
      return getEntityRequests(scope.entityLink, filter, viewerId, window);
    case 'user':
      return getUserRequests(scope.userName, window);
    default:
      return getInboxRequests(filter, viewerId, window);
  }
};

/** The selected feed's activity events plus its conversations. */
export const fetchInboxActivity = async (
  filter: ActivityFilter,
  userId: string | undefined,
  startTs?: number,
  endTs?: number,
  scope: ActivityScope = INBOX_SCOPE
): Promise<InboxActivityResult> => {
  if (!userId) {
    return { activities: [], threads: [], isCapped: false };
  }
  const days = getActivityWindowDays({ startTs, endTs });
  const { activity: activityRequest, conversations: conversationRequest } =
    getScopeRequests(scope, filter, userId, { days, startTs, endTs });

  // allSettled, not all: these two feed independent halves of the tab, and the
  // conversation list is only the fallback shown when there is no activity.
  // Failing the pair together let a single bad conversation request blank the
  // activity list as well, which is how a 400 on `limit` emptied the whole tab.
  const [activityRes, conversationRes] = await Promise.allSettled([
    activityRequest,
    conversationRequest,
  ]);

  const activities =
    activityRes.status === 'fulfilled' ? activityRes.value?.data ?? [] : [];
  const threads =
    conversationRes.status === 'fulfilled'
      ? conversationRes.value.data ?? []
      : [];

  const clipped = clipToWindow(filter, activities, { startTs, endTs });

  return {
    activities: clipped,
    threads,
    // A full page may hold only the newest of more events, unless the clip
    // dropped some: then the page already reached past the window's start, so
    // the window is complete.
    isCapped:
      (activities.length >= ACTIVITY_LIMIT &&
        clipped.length === activities.length) ||
      threads.length >= CONVERSATION_LIMIT,
  };
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

// One query per scope, feed and window, so the list and every count share a
// fetch.
const inboxActivityQuery = (
  filter: ActivityFilter,
  userId: string | undefined,
  dateRange?: InboxDateRange,
  scope: ActivityScope = INBOX_SCOPE
) => ({
  queryKey: [
    INBOX_ACTIVITY_QUERY_KEY,
    filter,
    dateRange?.startTs,
    dateRange?.endTs,
    userId,
    getActivityScopeKey(scope),
  ],
  queryFn: () =>
    fetchInboxActivity(
      filter,
      userId,
      dateRange?.startTs,
      dateRange?.endTs,
      scope
    ),
  enabled: Boolean(userId),
  staleTime: INBOX_ACTIVITY_STALE_TIME,
});

export interface UseInboxActivity extends InboxCount {
  items: InboxActivityItem[];
  isLoading: boolean;
}

/**
 * Single source for the Inbox Activity feed, shared by the tab list and the
 * badge (deduped via react-query). Activity events and conversations interleave
 * newest-first — upstream parity, OpenMetadata#30879.
 */
export const useInboxActivity = (
  filter: ActivityFilter,
  dateRange?: InboxDateRange,
  scope: ActivityScope = INBOX_SCOPE
): UseInboxActivity => {
  const { currentUser } = useApplicationStore();
  const userId = currentUser?.id;

  const { data, isLoading } = useQuery(
    inboxActivityQuery(filter, userId, dateRange, scope)
  );

  const items: InboxActivityItem[] = useMemo(() => {
    const merged: InboxActivityItem[] = [
      ...pairFieldChanges(data?.activities ?? []).map((activity) => ({
        activity,
      })),
      ...(data?.threads ?? []).map((feed) => ({ feed })),
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
    isLoading,
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
  scope: ActivityScope = INBOX_SCOPE
): Partial<Record<ActivityFilter, InboxCount>> => {
  const { currentUser } = useApplicationStore();
  const filters = SCOPE_FILTERS[scope.type];
  const results = useQueries({
    queries: filters.map((filter) =>
      inboxActivityQuery(filter, currentUser?.id, dateRange, scope)
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
                total:
                  pairFieldChanges(data.activities).length +
                  data.threads.length,
                isCapped: data.isCapped,
              },
            ],
          ]
        : [];
    })
  );
};

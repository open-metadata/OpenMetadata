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

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import { ConversationFilterType } from '../../../../generated/type/conversationFilterType';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getActivityEvents,
  getFollowingActivityFeed,
  getMyActivityFeed,
} from '../../../../rest/activityAPI';
import { listConversations } from '../../../../rest/conversationsAPI';
import {
  ACTIVITY_LIMIT,
  ActivityFilter,
  CONVERSATION_LIMIT,
  getActivityWindowDays,
  getFeedSortTimestamp,
  InboxDateRange,
  pairFieldChanges,
} from './inbox.utils';

export const INBOX_ACTIVITY_QUERY_KEY = 'inbox-activity';

// Short window so the tab list and the badge share one fetch.
const INBOX_ACTIVITY_STALE_TIME = 30 * 1000;

export interface InboxActivityResult {
  activities: ActivityEvent[];
  threads: Conversation[];
}

// Exactly one of `activity` or `feed`, matching ActivityFeedItem's props.
export interface InboxActivityItem {
  activity?: ActivityEvent;
  feed?: Conversation;
}

// When an item happened: an event's timestamp, a conversation's last activity.
export const getInboxItemTimestamp = (item: InboxActivityItem): number =>
  item.activity?.timestamp ?? (item.feed ? getFeedSortTimestamp(item.feed) : 0);

// Each sub-tab's activity events. Mentions has none: activity events carry no
// mentions yet, so that tab shows the conversations that mention the viewer.
const ACTIVITY_REQUEST: Record<
  ActivityFilter,
  typeof getActivityEvents | undefined
> = {
  [ActivityFilter.All]: getActivityEvents,
  [ActivityFilter.MyAssets]: getMyActivityFeed,
  [ActivityFilter.Following]: getFollowingActivityFeed,
  [ActivityFilter.Mentions]: undefined,
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

/** The selected sub-tab's activity events plus its conversations. */
export const fetchInboxActivity = async (
  filter: ActivityFilter,
  userId: string | undefined,
  startTs?: number,
  endTs?: number
): Promise<InboxActivityResult> => {
  if (!userId) {
    return { activities: [], threads: [] };
  }
  const days = getActivityWindowDays({ startTs, endTs });
  const activityRequest = ACTIVITY_REQUEST[filter]?.({
    days,
    limit: ACTIVITY_LIMIT,
  });
  const filterType = CONVERSATION_FILTER[filter];

  const conversationRequest = listConversations({
    filterType,
    userId: filterType ? userId : undefined,
    limit: CONVERSATION_LIMIT,
    startTs,
    endTs,
  });

  // allSettled, not all: these two feed independent halves of the tab, and the
  // conversation list is only the fallback shown when there is no activity.
  // Failing the pair together let a single bad conversation request blank the
  // activity list as well, which is how a 400 on `limit` emptied the whole tab.
  const [activityRes, conversationRes] = await Promise.allSettled([
    activityRequest,
    conversationRequest,
  ]);

  return {
    activities:
      activityRes.status === 'fulfilled' ? activityRes.value?.data ?? [] : [],
    threads:
      conversationRes.status === 'fulfilled'
        ? conversationRes.value.data ?? []
        : [],
  };
};

export interface UseInboxActivity {
  items: InboxActivityItem[];
  total: number;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Single source for the Inbox Activity feed, shared by the tab list and the
 * badge (deduped via react-query). Activity events and conversations interleave
 * newest-first — upstream parity, OpenMetadata#30879.
 */
export const useInboxActivity = (
  filter: ActivityFilter,
  dateRange?: InboxDateRange
): UseInboxActivity => {
  const { currentUser } = useApplicationStore();
  const userId = currentUser?.id;
  const startTs = dateRange?.startTs;
  const endTs = dateRange?.endTs;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [INBOX_ACTIVITY_QUERY_KEY, filter, startTs, endTs, userId],
    queryFn: () => fetchInboxActivity(filter, userId, startTs, endTs),
    enabled: Boolean(userId),
    staleTime: INBOX_ACTIVITY_STALE_TIME,
  });

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
    const itemId = (item: InboxActivityItem): string =>
      String(item.activity?.id ?? item.feed?.id ?? '');

    return merged.sort(
      (a, b) =>
        getInboxItemTimestamp(b) - getInboxItemTimestamp(a) ||
        itemId(a).localeCompare(itemId(b))
    );
  }, [data]);

  return {
    items,
    total: items.length,
    isLoading,
    refetch: () => {
      refetch();
    },
  };
};

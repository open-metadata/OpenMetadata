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
import { getUserActivity } from '../../../../rest/activityAPI';
import { listConversations } from '../../../../rest/conversationsAPI';
import {
  ACTIVITY_LIMIT,
  CONVERSATION_LIMIT,
  getActivityWindowDays,
  getFeedTimestamp,
  InboxDateRange,
  InboxScope,
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

/**
 * Mirrors OSS ActivityFeedTab: the user's own activity events
 * (`/activity/user/{id}`) plus conversations. Admins see every conversation
 * (no filter); everyone else only owned/followed ones.
 */
export const fetchInboxActivity = async (
  scope: InboxScope,
  userId: string | undefined,
  startTs?: number,
  endTs?: number
): Promise<InboxActivityResult> => {
  if (!userId) {
    return { activities: [], threads: [] };
  }
  const days = getActivityWindowDays({ startTs, endTs });
  const isAll = scope === 'all';

  const activityRequest = getUserActivity(userId, {
    days,
    limit: ACTIVITY_LIMIT,
  });

  const conversationRequest = listConversations({
    filterType: isAll ? undefined : ConversationFilterType.OwnerOrFollows,
    userId: isAll ? undefined : userId,
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
      activityRes.status === 'fulfilled' ? activityRes.value.data ?? [] : [],
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
  scope: InboxScope,
  dateRange?: InboxDateRange
): UseInboxActivity => {
  const { currentUser } = useApplicationStore();
  const userId = currentUser?.id;
  const startTs = dateRange?.startTs;
  const endTs = dateRange?.endTs;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [INBOX_ACTIVITY_QUERY_KEY, scope, startTs, endTs, userId],
    queryFn: () => fetchInboxActivity(scope, userId, startTs, endTs),
    enabled: Boolean(userId),
    staleTime: INBOX_ACTIVITY_STALE_TIME,
  });

  const items: InboxActivityItem[] = useMemo(() => {
    const merged: InboxActivityItem[] = [
      ...(data?.activities ?? []).map((activity) => ({ activity })),
      ...(data?.threads ?? []).map((feed) => ({ feed })),
    ];
    const itemTimestamp = (item: InboxActivityItem) =>
      item.activity?.timestamp ?? (item.feed ? getFeedTimestamp(item.feed) : 0);

    return merged.sort((a, b) => itemTimestamp(b) - itemTimestamp(a));
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

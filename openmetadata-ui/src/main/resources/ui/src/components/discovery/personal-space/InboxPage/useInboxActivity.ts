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
import { FeedFilter } from '../../../../enums/mydata.enum';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { Thread, ThreadType } from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getAllFeeds, getUserActivity } from '../../../../rest/feedsAPI';
import { useMemo } from 'react';
import {
  ACTIVITY_LIMIT,
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
  threads: Thread[];
}

// Exactly one of `activity` or `feed`, matching ActivityFeedItem's props.
export interface InboxActivityItem {
  activity?: ActivityEvent;
  feed?: Thread;
}

/**
 * Mirrors OSS ActivityFeedTab: the user's own activity events
 * (`/activity/user/{id}`) plus conversation threads. Admins see every
 * conversation (FeedFilter.ALL); everyone else only owned/followed threads.
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

  const conversationRequest = getAllFeeds(
    undefined,
    undefined,
    ThreadType.Conversation,
    isAll ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS,
    undefined,
    isAll ? undefined : userId,
    ACTIVITY_LIMIT,
    startTs,
    endTs
  );

  const [activityRes, conversationRes] = await Promise.all([
    activityRequest,
    conversationRequest,
  ]);

  return {
    activities: activityRes.data ?? [],
    threads: conversationRes.data ?? [],
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
 * badge (deduped via react-query). Activity events and conversation threads
 * interleave newest-first — upstream parity, OpenMetadata#30879.
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

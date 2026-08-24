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
import { INBOX_UNREAD_ACTIVITY_COUNT_QUERY_KEY } from '../components/discovery/personal-space/inbox.constants';
import { FeedFilter } from '../enums/mydata.enum';
import { ThreadType } from '../generated/entity/feed/thread';
import { getAllFeeds } from '../rest/feedsAPI';
import { useApplicationStore } from './useApplicationStore';
import { usePersonalSpaceStore } from './usePersonalSpaceStore';

const UNREAD_ACTIVITY_STALE_TIME = 30 * 1000;

/**
 * Count of activity the user has not looked at yet — what the sidebar Inbox
 * badge shows alongside open tasks.
 *
 * <p>Scoped to {@link FeedFilter.MENTIONS} — threads that name this user. Not
 * `ALL`, which would leave an admin permanently lit with everyone else's
 * activity; and not `OWNER_OR_FOLLOWS`, which matches threads the user
 * *created*: the notification's author is the person who shared the chat, so
 * they would be badged for their own action.
 *
 * <p>Feeds carry no server-side read state, so "unread" is everything newer than
 * the locally stored seen-mark. Before the first visit there is no mark and
 * nothing is counted — a brand-new user should not open Collate to a badge for
 * activity that predates them.
 */
export const useUnreadInboxActivity = (): number => {
  const { currentUser } = useApplicationStore();
  const userId = currentUser?.id;
  const seenTs = usePersonalSpaceStore((s) => s.inboxActivitySeenTs);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [...INBOX_UNREAD_ACTIVITY_COUNT_QUERY_KEY, userId, seenTs],
    queryFn: () =>
      getAllFeeds(
        undefined,
        undefined,
        ThreadType.Conversation,
        FeedFilter.MENTIONS,
        undefined,
        userId,
        1,
        seenTs ?? undefined
      )
        .then((res) => res.paging?.total ?? 0)
        .catch(() => 0),
    enabled: Boolean(userId) && seenTs !== null,
    staleTime: UNREAD_ACTIVITY_STALE_TIME,
  });

  return unreadCount;
};

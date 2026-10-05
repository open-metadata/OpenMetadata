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
import { ConversationReply } from '../../../../generated/entity/feed/conversation';
import {
  createActivityReply,
  listActivityReplies,
} from '../../../../rest/activityAPI';
import {
  createConversationReply,
  listConversationReplies,
} from '../../../../rest/conversationsAPI';

export const ACTIVITY_REPLIES_QUERY_KEY = 'inbox-activity-replies';

// The most one replies read returns; the server caps a page at 100.
const REPLIES_LIMIT = 100;
// ponytail: a thread reads at most this many pages (1000 replies); page on
// scroll if threads ever grow past it.
const MAX_REPLY_PAGES = 10;

const REPLIES_STALE_TIME = 30 * 1000;

interface ThreadIds {
  activityId?: string;
  conversationId?: string;
}

// An activity's replies live in a conversation whose id is the activity id
// (open-metadata/OpenMetadata#30909), so once a reply exists, editing and
// deleting it go through the same conversation endpoints as any comment.
const listThreadReplies = (
  { activityId, conversationId }: ThreadIds,
  after?: string
) =>
  activityId
    ? listActivityReplies(activityId, { limit: REPLIES_LIMIT, after })
    : listConversationReplies(conversationId ?? '', {
        limit: REPLIES_LIMIT,
        after,
      });

// Replies come oldest first, a page at a time, so a long thread is read page
// by page to its newest reply; otherwise a reply posted past the first page
// would never show.
const listAllThreadReplies = async (
  ids: ThreadIds,
  after?: string,
  page = 1
): Promise<ConversationReply[]> => {
  const { data = [], paging } = await listThreadReplies(ids, after);
  const isLastPage = !paging?.after || page >= MAX_REPLY_PAGES;

  return isLastPage
    ? data
    : [...data, ...(await listAllThreadReplies(ids, paging.after, page + 1))];
};

export const createThreadReply = (
  message: string,
  { activityId, conversationId }: ThreadIds
) =>
  activityId
    ? createActivityReply(activityId, { message })
    : createConversationReply(conversationId ?? '', { message });

export interface UseActivityReplies {
  threadId?: string;
  replies: ConversationReply[];
  // Whether the replies have been read; until then the list is empty, not zero.
  hasLoaded: boolean;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * A card's replies, read only once its thread is opened, so scrolling the feed
 * fetches nothing.
 */
export const useActivityReplies = (
  ids: ThreadIds,
  enabled: boolean
): UseActivityReplies => {
  const threadId = ids.conversationId ?? ids.activityId;
  const { data, isLoading, refetch } = useQuery({
    queryKey: [ACTIVITY_REPLIES_QUERY_KEY, threadId],
    queryFn: () => listAllThreadReplies(ids),
    enabled: enabled && Boolean(threadId),
    staleTime: REPLIES_STALE_TIME,
  });

  return {
    threadId,
    replies: data ?? [],
    hasLoaded: data !== undefined,
    isLoading: enabled && isLoading,
    refetch: () => {
      refetch();
    },
  };
};

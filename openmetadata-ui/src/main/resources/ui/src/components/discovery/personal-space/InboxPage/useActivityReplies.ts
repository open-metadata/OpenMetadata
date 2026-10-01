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

// The most a replies read returns; also what an activity thread shows.
const REPLIES_LIMIT = 100;

const REPLIES_STALE_TIME = 30 * 1000;

interface ThreadIds {
  activityId?: string;
  conversationId?: string;
}

// An activity's replies live in a conversation whose id is the activity id
// (open-metadata/OpenMetadata#30909), so once a reply exists, editing and
// deleting it go through the same conversation endpoints as any comment.
const listThreadReplies = ({ activityId, conversationId }: ThreadIds) =>
  activityId
    ? listActivityReplies(activityId, { limit: REPLIES_LIMIT })
    : listConversationReplies(conversationId ?? '', { limit: REPLIES_LIMIT });

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
  isLoading: boolean;
  refetch: () => void;
}

/**
 * A card's replies, read once the card is on screen.
 * ponytail: one replies read per visible card, because activity events carry
 * no reply count; drop the read for collapsed cards once the server adds one.
 */
export const useActivityReplies = (
  ids: ThreadIds,
  enabled: boolean
): UseActivityReplies => {
  const threadId = ids.conversationId ?? ids.activityId;
  const { data, isLoading, refetch } = useQuery({
    queryKey: [ACTIVITY_REPLIES_QUERY_KEY, threadId],
    queryFn: () => listThreadReplies(ids).then((res) => res.data ?? []),
    enabled: enabled && Boolean(threadId),
    staleTime: REPLIES_STALE_TIME,
  });

  return {
    threadId,
    replies: data ?? [],
    isLoading: enabled && isLoading,
    refetch: () => {
      refetch();
    },
  };
};

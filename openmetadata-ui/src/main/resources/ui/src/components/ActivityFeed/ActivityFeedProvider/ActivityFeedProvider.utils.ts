/*
 *  Copyright 2023 Collate.
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

import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { ConversationFilterType } from '../../../generated/type/conversationFilterType';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';

export const getConversationFilterType = (filter?: FeedFilter) => {
  switch (filter) {
    case FeedFilter.OWNER:
      return ConversationFilterType.Owner;
    case FeedFilter.FOLLOWS:
      return ConversationFilterType.Follows;
    case FeedFilter.MENTIONS:
      return ConversationFilterType.Mentions;
    case FeedFilter.OWNER_OR_FOLLOWS:
      return ConversationFilterType.OwnerOrFollows;
    default:
      return undefined;
  }
};

export const getConversationsUserId = (
  entityType: EntityType | undefined,
  feedFilterType: FeedFilter,
  user: string | undefined,
  currentUserId: string | undefined
): string | undefined => {
  if (entityType === EntityType.USER) {
    return user;
  }
  if (feedFilterType !== FeedFilter.ALL) {
    return currentUserId;
  }

  return undefined;
};

export const getConversationsEntityLink = (
  entityType: EntityType | undefined,
  fqn: string | undefined
) =>
  entityType !== EntityType.USER && fqn
    ? getEntityFeedLink(entityType, fqn)
    : undefined;

export const getConversationsFilterType = (
  feedFilterType: FeedFilter,
  userId: string | undefined
) =>
  getConversationFilterType(feedFilterType) ??
  (userId ? ConversationFilterType.OwnerOrFollows : undefined);

export const withReply = (
  conversation: Conversation,
  reply: ConversationReply,
  replyLimit?: number
) => {
  const replies = [
    ...(conversation.replies ?? []).filter((item) => item.id !== reply.id),
    reply,
  ];

  return {
    ...conversation,
    replies: replyLimit ? replies.slice(-replyLimit) : replies,
    replyCount: conversation.replyCount + 1,
    updatedAt: reply.createdAt,
  };
};

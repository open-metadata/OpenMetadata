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

import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import { CreateConversation } from '../generated/api/feed/createConversation';
import { CreatePost } from '../generated/api/feed/createPost';
import {
  Conversation,
  ConversationReply,
} from '../generated/entity/feed/conversation';
import { ConversationFilterType } from '../generated/type/conversationFilterType';
import { ReactionType } from '../generated/type/reaction';
import APIClient from './index';

const BASE_URL = '/conversations';

export interface ListConversationsParams {
  entityLink?: string;
  userId?: string;
  filterType?: ConversationFilterType;
  resolved?: boolean;
  startTs?: number;
  endTs?: number;
  limit?: number;
  before?: string;
  after?: string;
}

export interface ListConversationRepliesParams {
  limit?: number;
  before?: string;
  after?: string;
}

export const listConversations = async (params?: ListConversationsParams) => {
  const response = await APIClient.get<PagingResponse<Conversation[]>>(
    BASE_URL,
    { params }
  );

  return response.data;
};

export const createConversation = async (data: CreateConversation) => {
  const response = await APIClient.post<Conversation>(BASE_URL, data);

  return response.data;
};

export const getConversation = async (conversationId: string) => {
  const response = await APIClient.get<Conversation>(
    `${BASE_URL}/${conversationId}`
  );

  return response.data;
};

export const patchConversation = async (
  conversationId: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<Conversation>(
    `${BASE_URL}/${conversationId}`,
    data
  );

  return response.data;
};

export const deleteConversation = async (conversationId: string) => {
  const response = await APIClient.delete<Conversation>(
    `${BASE_URL}/${conversationId}`
  );

  return response.data;
};

export const addConversationReaction = async (
  conversationId: string,
  reactionType: ReactionType
) => {
  const response = await APIClient.put<Conversation>(
    `${BASE_URL}/${conversationId}/reaction/${reactionType}`
  );

  return response.data;
};

export const removeConversationReaction = async (
  conversationId: string,
  reactionType: ReactionType
) => {
  const response = await APIClient.delete<Conversation>(
    `${BASE_URL}/${conversationId}/reaction/${reactionType}`
  );

  return response.data;
};

export const listConversationReplies = async (
  conversationId: string,
  params?: ListConversationRepliesParams
) => {
  const response = await APIClient.get<PagingResponse<ConversationReply[]>>(
    `${BASE_URL}/${conversationId}/replies`,
    { params }
  );

  return response.data;
};

export const createConversationReply = async (
  conversationId: string,
  data: CreatePost
) => {
  const response = await APIClient.post<ConversationReply>(
    `${BASE_URL}/${conversationId}/replies`,
    data
  );

  return response.data;
};

export const patchConversationReply = async (
  conversationId: string,
  replyId: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<ConversationReply>(
    `${BASE_URL}/${conversationId}/replies/${replyId}`,
    data
  );

  return response.data;
};

export const deleteConversationReply = async (
  conversationId: string,
  replyId: string
) => {
  const response = await APIClient.delete<ConversationReply>(
    `${BASE_URL}/${conversationId}/replies/${replyId}`
  );

  return response.data;
};

export const addConversationReplyReaction = async (
  conversationId: string,
  replyId: string,
  reactionType: ReactionType
) => {
  const response = await APIClient.put<ConversationReply>(
    `${BASE_URL}/${conversationId}/replies/${replyId}/reaction/${reactionType}`
  );

  return response.data;
};

export const removeConversationReplyReaction = async (
  conversationId: string,
  replyId: string,
  reactionType: ReactionType
) => {
  const response = await APIClient.delete<ConversationReply>(
    `${BASE_URL}/${conversationId}/replies/${replyId}/reaction/${reactionType}`
  );

  return response.data;
};

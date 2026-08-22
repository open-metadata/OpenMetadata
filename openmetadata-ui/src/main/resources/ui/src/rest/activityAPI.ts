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

import { PagingResponse } from 'Models';
import { CreatePost } from '../generated/api/feed/createPost';
import { ActivityEvent } from '../generated/entity/activity/activityEvent';
import { ConversationReply } from '../generated/entity/feed/conversation';
import { ReactionType } from '../generated/type/reaction';
import APIClient from './index';

const BASE_URL = '/activity';

export interface ListActivityParams {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  domains?: string;
  days?: number;
  limit?: number;
}

export interface ListActivityRepliesParams {
  limit?: number;
  before?: string;
  after?: string;
}

export const getActivityEvents = async (params?: ListActivityParams) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    BASE_URL,
    { params }
  );

  return response.data;
};

export const getEntityActivityById = async (
  entityType: string,
  entityId: string,
  params?: { days?: number; limit?: number; domain?: string }
) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    `${BASE_URL}/entity/${entityType}/${entityId}`,
    { params }
  );

  return response.data;
};

export const getEntityActivityByFqn = async (
  entityType: string,
  fqn: string,
  params?: { days?: number; limit?: number; domain?: string }
) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    `${BASE_URL}/entity/${entityType}/name/${encodeURIComponent(fqn)}`,
    { params }
  );

  return response.data;
};

export const getUserActivity = async (
  userId: string,
  params?: { days?: number; limit?: number; domain?: string }
) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    `${BASE_URL}/user/${userId}`,
    { params }
  );

  return response.data;
};

export const getMyActivityFeed = async (params?: {
  days?: number;
  limit?: number;
  domain?: string;
}) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    `${BASE_URL}/my-feed`,
    { params }
  );

  return response.data;
};

export const getFollowingActivityFeed = async (params?: {
  days?: number;
  limit?: number;
}) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    `${BASE_URL}/following`,
    { params }
  );

  return response.data;
};

export const getActivityByEntityLink = async (
  entityLink: string,
  params?: { days?: number; limit?: number; domain?: string }
) => {
  const response = await APIClient.get<PagingResponse<ActivityEvent[]>>(
    `${BASE_URL}/about`,
    { params: { entityLink, ...params } }
  );

  return response.data;
};

export const getActivityCount = async (params?: {
  days?: number;
  domain?: string;
}) => {
  const response = await APIClient.get<number>(`${BASE_URL}/count`, { params });

  return response.data;
};

export const addActivityReaction = async (
  activityId: string,
  reactionType: ReactionType
) => {
  const response = await APIClient.put<ActivityEvent>(
    `${BASE_URL}/${activityId}/reaction/${reactionType}`
  );

  return response.data;
};

export const removeActivityReaction = async (
  activityId: string,
  reactionType: ReactionType
) => {
  const response = await APIClient.delete<ActivityEvent>(
    `${BASE_URL}/${activityId}/reaction/${reactionType}`
  );

  return response.data;
};

export const listActivityReplies = async (
  activityId: string,
  params?: ListActivityRepliesParams
) => {
  const response = await APIClient.get<PagingResponse<ConversationReply[]>>(
    `${BASE_URL}/${activityId}/replies`,
    { params }
  );

  return response.data;
};

export const createActivityReply = async (
  activityId: string,
  data: CreatePost
) => {
  const response = await APIClient.post<ConversationReply>(
    `${BASE_URL}/${activityId}/replies`,
    data
  );

  return response.data;
};

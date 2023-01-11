/*
 *  Copyright 2022 Collate.
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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { configOptions } from '../constants/constants';
import { TaskOperation } from '../constants/Feeds.constants';
import { FeedFilter } from '../enums/mydata.enum';
import { CreateThread } from '../generated/api/feed/createThread';
import {
  Post,
  TaskDetails,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../generated/entity/feed/thread';
import { Paging } from '../generated/type/paging';
import { EntityFieldThreadCount } from '../interface/feed.interface';
import APIClient from './index';

export const getAllFeeds = async (
  entityLink?: string,
  after?: string,
  type?: ThreadType,
  filterType?: FeedFilter,
  taskStatus?: ThreadTaskStatus,
  userId?: string
) => {
  const isFilterAll = filterType === FeedFilter.ALL;
  const isFilterUndefined = isUndefined(filterType);

  const response = await APIClient.get<{ data: Thread[]; paging: Paging }>(
    `/feed`,
    {
      params: {
        entityLink: entityLink,
        after,
        type,
        filterType: isFilterAll || isFilterUndefined ? undefined : filterType,
        taskStatus,
        userId: isFilterAll || isFilterUndefined ? undefined : userId,
      },
    }
  );

  return response.data;
};

export const getFeedsWithFilter = async (
  userId?: string,
  filterType?: FeedFilter,
  after?: string,
  type?: ThreadType,
  taskStatus?: ThreadTaskStatus
) => {
  const feedFilterType = filterType === FeedFilter.ALL ? undefined : filterType;

  const config = {
    params: {
      userId,
      filterType: feedFilterType,
      after,
      type,
      taskStatus,
    },
  };

  const response = await APIClient.get<{ data: Thread[]; paging: Paging }>(
    `/feed`,
    config
  );

  return response.data;
};

export const getFeedCount = async (
  entityLink?: string,
  type?: ThreadType,
  taskStatus?: ThreadTaskStatus
) => {
  const response = await APIClient.get<{
    totalCount: number;
    counts: EntityFieldThreadCount[];
  }>(`/feed/count`, {
    params: {
      entityLink: entityLink,
      type,
      taskStatus,
    },
  });

  return response.data;
};

export const postThread = async (data: CreateThread) => {
  const response = await APIClient.post<CreateThread, AxiosResponse<Thread>>(
    '/feed',
    data
  );

  return response.data;
};

export const getFeedById = (id: string): Promise<AxiosResponse<Thread>> => {
  return APIClient.get(`/feed/${id}`);
};

export const postFeedById = async (id: string, data: Post) => {
  const response = await APIClient.post<Post, AxiosResponse<Thread>>(
    `/feed/${id}/posts`,
    data
  );

  return response.data;
};

export const deletePostById = (threadId: string, postId: string) => {
  return APIClient.delete<Post>(`/feed/${threadId}/posts/${postId}`);
};

export const updateThread = async (threadId: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Thread>>(
    `/feed/${threadId}`,
    data,
    configOptions
  );

  return response.data;
};

export const updatePost = async (
  threadId: string,
  postId: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Thread>>(
    `/feed/${threadId}/posts/${postId}`,
    data,
    configOptions
  );

  return response.data;
};

export const getTask = async (taskID: string) => {
  const response = await APIClient.get<Thread>(`/feed/tasks/${taskID}`);

  return response.data;
};

export const updateTask = (
  operation: TaskOperation,
  taskId: string,
  taskDetail: TaskDetails
) => {
  return APIClient.put(`/feed/tasks/${taskId}/${operation}`, taskDetail);
};

export const getActiveAnnouncement = async (entityLink: string) => {
  const response = await APIClient.get<{ data: Thread[]; paging: Paging }>(
    '/feed',
    {
      params: {
        entityLink,
        type: ThreadType.Announcement,
        activeAnnouncement: true,
      },
    }
  );

  return response.data;
};

export const deleteThread = async (threadId: string) => {
  const response = await APIClient.delete<Thread>(`/feed/${threadId}`);

  return response.data;
};

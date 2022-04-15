/*
 *  Copyright 2021 Collate
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
import { Post } from 'Models';
import { FeedFilter } from '../enums/mydata.enum';
import { CreateThread } from '../generated/api/feed/createThread';
import APIClient from './index';

export const getAllFeeds: Function = (
  entityLink?: string,
  after?: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/feed`, {
    params: {
      entityLink: entityLink,
      after,
    },
  });
};

export const getFeedsWithFilter: Function = (
  userId?: string,
  filterType?: FeedFilter,
  after?: string
): Promise<AxiosResponse> => {
  let config = {};

  if (filterType !== FeedFilter.ALL) {
    config = {
      params: {
        userId,
        filterType,
        after,
      },
    };
  } else {
    config = {
      params: {
        after,
      },
    };
  }

  return APIClient.get(`/feed`, config);
};

export const getFeedCount: Function = (
  entityLink?: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/feed/count`, {
    params: {
      entityLink: entityLink,
    },
  });
};

export const postThread: Function = (
  data: CreateThread
): Promise<AxiosResponse> => {
  return APIClient.post('/feed', data);
};

export const getFeedById: Function = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/feed/${id}`);
};

export const postFeedById: Function = (
  id: string,
  data: Post
): Promise<AxiosResponse> => {
  return APIClient.post(`/feed/${id}/posts`, data);
};

export const deletePostById: Function = (
  threadId: string,
  postId: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/feed/${threadId}/posts/${postId}`);
};

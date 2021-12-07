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
import { Feed, FeedById } from 'Models';
import APIClient from './index';

export const getAllFeeds: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/feed');
};

export const postFeed: Function = (data: Feed): Promise<AxiosResponse> => {
  return APIClient.post('/feed', data);
};

export const getFeedById: Function = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/feed/${id}`);
};

export const postFeedById: Function = (
  id: string,
  data: FeedById
): Promise<AxiosResponse> => {
  return APIClient.post(`/feed/${id}/posts`, data);
};

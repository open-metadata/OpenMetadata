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
import { CreateWebhook } from '../generated/api/events/createWebhook';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getWebhooks = (
  paging?: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    '/webhook',
    arrQueryFields,
    paging ? paging : undefined
  );

  return APIClient.get(url);
};

export const addWebhook = (data: CreateWebhook): Promise<AxiosResponse> => {
  const url = '/webhook';

  return APIClient.post(url, data);
};

export const updateWebhook = (data: CreateWebhook): Promise<AxiosResponse> => {
  const url = '/webhook';

  return APIClient.put(url, data);
};

export const deleteWebhook = (id: string): Promise<AxiosResponse> => {
  const url = `/webhook/${id}`;

  return APIClient.delete(url);
};

export const getWebhookByName = (name: string): Promise<AxiosResponse> => {
  const url = `/webhook/name/${name}`;

  return APIClient.get(url);
};

export const getWebhookById = (id: string): Promise<AxiosResponse> => {
  const url = `/webhook/${id}`;

  return APIClient.get(url);
};

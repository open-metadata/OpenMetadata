/*
 *  Copyright 2025 Collate.
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
import { CreateNotificationTemplate } from '../../src/generated/api/events/createNotificationTemplate';
import {
  NotificationTemplate,
  ProviderType,
} from '../../src/generated/entity/events/notificationTemplate';
import { Paging } from '../../src/generated/type/paging';
import { ListParams } from '../../src/interface/API.interface';
import APIClient from '../../src/rest/index';
import { getEncodedFqn } from '../../src/utils/StringsUtils';
import { NotificationTemplateValidationResponse } from '../generated/api/events/notificationTemplateRenderResponse';
import { NotificationTemplateSendRequest } from '../generated/api/events/notificationTemplateSendRequest';

const BASE_URL = '/notificationTemplates';

export const createNotificationTemplate = async (
  data: CreateNotificationTemplate
) => {
  const response = await APIClient.post<
    CreateNotificationTemplate,
    AxiosResponse<NotificationTemplate>
  >(BASE_URL, data);

  return response.data;
};

export const patchNotificationTemplate = async (
  id: string,
  patch: Operation[]
) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<NotificationTemplate>
  >(`${BASE_URL}/${id}`, patch);

  return response.data;
};

export const getNotificationTemplateByFqn = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<NotificationTemplate>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params,
    }
  );

  return response.data;
};

export const deleteNotificationTemplate = (id: string) => {
  return APIClient.delete(`${BASE_URL}/${id}`);
};

export const getAllNotificationTemplates = async (
  params?: ListParams & { provider?: ProviderType }
) => {
  const response = await APIClient.get<{
    data: NotificationTemplate[];
    paging: Paging;
  }>(BASE_URL, {
    params,
  });

  return response.data;
};

export const validateNotificationTemplate = async (
  templateSubject: string,
  templateBody: string
) => {
  const response = await APIClient.post<
    { templateSubject: string; templateBody: string },
    AxiosResponse<NotificationTemplateValidationResponse>
  >(`${BASE_URL}/validate`, { templateSubject, templateBody });

  return response.data;
};

export const sendTestNotificationTemplate = async (
  data: NotificationTemplateSendRequest
) => {
  const response = await APIClient.post<
    { templateSubject: string; templateBody: string },
    AxiosResponse<NotificationTemplateValidationResponse>
  >(`${BASE_URL}/send`, data);

  return response.data;
};

export const resetSystemTemplateByFQN = async (fqn: string) => {
  const response = await APIClient.put<
    null,
    AxiosResponse<NotificationTemplate>
  >(`${BASE_URL}/name/${fqn}/reset`);

  return response.data;
};

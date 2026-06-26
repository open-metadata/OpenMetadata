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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { PagingWithoutTotal, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { LlmModel } from '../generated/entity/ai/llmModel';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

const BASE_URL = '/llmModels';

export const getLLMModelVersions = async (id: string) => {
  const response = await APIClient.get<EntityHistory>(
    `${BASE_URL}/${id}/versions`
  );

  return response.data;
};

export const getLLMModelVersion = async (id: string, version?: string) => {
  const response = await APIClient.get<LlmModel>(
    `${BASE_URL}/${id}/versions/${version}`
  );

  return response.data;
};

export const getLLMModelByFqn = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<LlmModel>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.All,
        includeRelations:
          params?.includeRelations ?? 'owners:non-deleted,experts:non-deleted',
      },
    }
  );

  return response.data;
};

export const getLLMModels = async (
  service: string | undefined,
  fields: string,
  paging?: PagingWithoutTotal,
  include: Include = Include.NonDeleted
) => {
  const response = await APIClient.get<{
    data: LlmModel[];
    paging: Paging;
  }>(BASE_URL, {
    params: {
      service,
      fields,
      ...paging,
      include,
    },
  });

  return response.data;
};

export const patchLLMModelDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<LlmModel>>(
    `${BASE_URL}/${id}`,
    data
  );

  return response.data;
};

export const addLLMModelFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${BASE_URL}/${id}/followers`, userId, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const removeLLMModelFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(
    `${BASE_URL}/${id}/followers/${userId}`,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const restoreLLMModel = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<LlmModel>
  >(`${BASE_URL}/restore`, { id });

  return response.data;
};

export const updateLLMModelVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<LlmModel>>(
    `${BASE_URL}/${id}/vote`,
    data
  );

  return response.data;
};

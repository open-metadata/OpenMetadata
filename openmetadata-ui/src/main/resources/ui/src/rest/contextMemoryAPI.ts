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
import { PagingResponse } from '../components/common/AsyncSelect/AsyncSelect';
import { CreateContextMemory } from '../generated/api/context/createContextMemory';
import { ContextMemory } from '../generated/entity/context/contextMemory';
import { ListParams } from '../interface/API.interface';
import APIClient from '../rest/index';

const BASE_URL = '/contextCenter/memories';

export type ContextMemoryListParams = ListParams & {
  sourceFileId?: string;
  sourceEntityId?: string;
};

export const getListContextMemories = async (
  params?: ContextMemoryListParams
) => {
  const response = await APIClient.get<PagingResponse<ContextMemory[]>>(
    BASE_URL,
    { params }
  );

  return response.data;
};

export const createContextMemory = async (data: CreateContextMemory) => {
  const response = await APIClient.post<ContextMemory>(BASE_URL, data);

  return response.data;
};

export const updateContextMemory = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<ContextMemory>
  >(`${BASE_URL}/${id}`, patch, {
    headers: { 'Content-type': 'application/json-patch+json' },
  });

  return response.data;
};

export const deleteContextMemory = async (id: string) => {
  await APIClient.delete(`${BASE_URL}/${id}`);
};

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
import { PagingResponse } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { CreateQuery } from '../generated/api/data/createQuery';
import { Query } from '../generated/entity/data/query';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

export type ListQueriesParams = ListParams & {
  entityId?: string;
};

export type QueryByIdParams = Pick<ListParams, 'fields' | 'include'>;

const BASE_URL = '/queries';

export const getQueriesList = async (params?: ListQueriesParams) => {
  const response = await APIClient.get<PagingResponse<Query[]>>(BASE_URL, {
    params,
  });

  return response.data;
};
export const getQueryById = async (id: string, params?: QueryByIdParams) => {
  const response = await APIClient.get<Query>(`${BASE_URL}/${id}`, {
    params,
  });

  return response.data;
};

export const postQuery = async (query: CreateQuery) => {
  const response = await APIClient.post<CreateQuery, AxiosResponse<Query>>(
    BASE_URL,
    query
  );

  return response.data;
};
export const patchQueries = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Query>>(
    `${BASE_URL}/${id}`,
    patch
  );

  return response.data;
};
export const updateQueryVote = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<Query>>(
    `${BASE_URL}/${id}/vote`,
    data
  );

  return response.data;
};
export const deleteQuery = async (id: string) => {
  const response = await APIClient.delete<AxiosResponse<Query>>(
    `${BASE_URL}/${id}`
  );

  return response.data;
};

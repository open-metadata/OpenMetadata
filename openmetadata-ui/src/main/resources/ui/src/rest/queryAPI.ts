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
import { QueryVote } from 'components/TableQueries/TableQueries.interface';
import { Operation } from 'fast-json-patch';
import { CreateQuery } from 'generated/api/data/createQuery';
import { Query } from 'generated/entity/data/query';
import { Include } from 'generated/type/include';
import { PagingResponse } from 'Models';
import APIClient from './index';

type Params = {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
};

export type ListQueriesParams = Params & {
  entityId?: string;
};

export type QueryByIdParams = Pick<Params, 'fields' | 'include'>;

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
export const getQueryByFqn = async (fqn: string, params?: QueryByIdParams) => {
  const response = await APIClient.get<Query>(`${BASE_URL}/name/${fqn}`, {
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
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Query>>(
    `${BASE_URL}/${id}`,
    patch,
    configOptions
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

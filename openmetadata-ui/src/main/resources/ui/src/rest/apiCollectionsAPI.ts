/*
 *  Copyright 2024 Collate.
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
import { PagingResponse, PagingWithoutTotal, RestoreRequestType } from 'Models';
import { QueryVote as VoteType } from '../components/Database/TableQueries/TableQueries.interface';
import { APICollection } from '../generated/entity/data/apiCollection';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

type GetApiCollectionsType = {
  service: string;
  fields: string;
  paging?: PagingWithoutTotal;
  include?: Include;
};

export const getApiCollections = async (params: GetApiCollectionsType) => {
  const { paging, ...restParams } = params;
  const response = await APIClient.get<PagingResponse<APICollection[]>>(
    `/apiCollections`,
    {
      params: {
        ...restParams,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getApiCollectionByFQN = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<APICollection>(
    `/apiCollections/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.All,
      },
    }
  );

  return response.data;
};

export const patchApiCollection = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<APICollection>
  >(`/apiCollections/${id}`, data);

  return response.data;
};

export const restoreApiCollection = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<APICollection>
  >(`/apiCollections/restore`, { id });

  return response.data;
};

export const getApiCollectionVersions = async (id: string) => {
  const url = `/apiCollections/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getApiCollectionVersion = async (id: string, version: string) => {
  const url = `/apiCollections/${id}/versions/${version}`;

  const response = await APIClient.get<APICollection>(url);

  return response.data;
};

export const updateApiCollectionVote = async (id: string, data: VoteType) => {
  const response = await APIClient.put<VoteType, AxiosResponse<APICollection>>(
    `/apiCollections/${id}/vote`,
    data
  );

  return response.data;
};

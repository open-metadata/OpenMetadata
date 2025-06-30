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
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export type GetApiEndPointsType = {
  service: string;
  apiCollection: string;
  fields?: string;
  paging?: PagingWithoutTotal;
  include?: Include;
};

export const getApiEndPoints = async (params: GetApiEndPointsType) => {
  const { paging, ...restParams } = params;
  const response = await APIClient.get<PagingResponse<APIEndpoint[]>>(
    `/apiEndpoints`,
    {
      params: {
        ...restParams,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getApiEndPointByFQN = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<APIEndpoint>(
    `/apiEndpoints/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.All,
      },
    }
  );

  return response.data;
};

export const patchApiEndPoint = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<APIEndpoint>
  >(`/apiEndpoints/${id}`, data);

  return response.data;
};

export const restoreApiEndPoint = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<APIEndpoint>
  >(`/apiEndpoints/restore`, { id });

  return response.data;
};

export const getApiEndPointVersions = async (id: string) => {
  const url = `/apiEndpoints/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getApiEndPointVersion = async (id: string, version?: string) => {
  const url = `/apiEndpoints/${id}/versions/${version}`;

  const response = await APIClient.get<APIEndpoint>(url);

  return response.data;
};

export const updateApiEndPointVote = async (id: string, data: VoteType) => {
  const response = await APIClient.put<VoteType, AxiosResponse<APIEndpoint>>(
    `/apiEndpoints/${id}/vote`,
    data
  );

  return response.data;
};

export const addApiEndpointFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(
    `/apiEndpoints/${id}/followers`,
    userId,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const removeApiEndpointFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(
    `/apiEndpoints/${id}/followers/${userId}`,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

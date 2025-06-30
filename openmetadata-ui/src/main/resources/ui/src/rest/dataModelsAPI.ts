/*
 *  Copyright 2023 Collate.
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
import { PagingResponse, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Column } from '../generated/entity/data/table';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

const URL = '/dashboard/datamodels';

export const getDataModelByFqn = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<DashboardDataModel>(
    `${URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.NonDeleted,
      },
    }
  );

  return response.data;
};

export const patchDataModelDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<DashboardDataModel>
  >(`${URL}/${id}`, data);

  return response.data;
};

export const addDataModelFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${URL}/${id}/followers`, userId, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const removeDataModelFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`${URL}/${id}/followers/${userId}`, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const getDataModelVersionsList = async (id: string) => {
  const url = `${URL}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getDataModelVersion = async (id: string, version?: string) => {
  const url = `${URL}/${id}/versions/${version}`;

  const response = await APIClient.get<DashboardDataModel>(url);

  return response.data;
};

export const restoreDataModel = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<DashboardDataModel>
  >(`${URL}/restore`, { id });

  return response.data;
};

export const updateDataModelVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<
    QueryVote,
    AxiosResponse<DashboardDataModel>
  >(`${URL}/${id}/vote`, data);

  return response.data;
};

export interface DataModelColumnParams {
  limit?: number;
  offset?: number;
  fields?: string;
  include?: Include;
}

export interface SearchDataModelColumnsParams extends DataModelColumnParams {
  q?: string; // Search query
}

export const getDataModelColumnsByFQN = async (
  fqn: string,
  params?: DataModelColumnParams
) => {
  const response = await APIClient.get<PagingResponse<Column[]>>(
    `${URL}/name/${getEncodedFqn(fqn)}/columns`,
    {
      params: { ...params, include: params?.include ?? Include.All },
    }
  );

  return response.data;
};

export const searchDataModelColumnsByFQN = async (
  fqn: string,
  params?: SearchDataModelColumnsParams
) => {
  const response = await APIClient.get<PagingResponse<Column[]>>(
    `${URL}/name/${getEncodedFqn(fqn)}/columns/search`,
    {
      params: { ...params, include: params?.include ?? Include.All },
    }
  );

  return response.data;
};

export const updateDataModelColumn = async (
  fqn: string,
  column: Partial<Column>
) => {
  const response = await APIClient.put<Column>(
    `/columns/name/${getEncodedFqn(fqn)}?entityType=dashboardDataModel`,
    column
  );

  return response.data;
};

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
import { PagingResponse, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { SystemProfile } from '../generated/api/data/createTableProfile';
import {
  ColumnProfile,
  Table,
  TableProfile,
  TableProfilerConfig,
} from '../generated/entity/data/table';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export type TableListParams = {
  fields?: string;
  database?: string;
  databaseSchema?: string;
  before?: string;
  after?: string;
  include?: Include;
  limit?: number;
  includeEmptyTestSuite?: boolean;
};

const BASE_URL = '/tables';

export const getTableVersions = async (id: string) => {
  const url = `${BASE_URL}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getTableVersion = async (id: string, version: string) => {
  const url = `${BASE_URL}/${id}/versions/${version}`;

  const response = await APIClient.get(url);

  return response.data;
};

export const getTableDetailsByFQN = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<Table>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: { ...params, include: params?.include ?? Include.All },
    }
  );

  return response.data;
};

export const patchTableDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Table>>(
    `${BASE_URL}/${id}`,
    data
  );

  return response.data;
};

export const restoreTable = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Table>
  >(`${BASE_URL}/restore`, { id });

  return response.data;
};

export const addFollower = async (tableId: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(
    `${BASE_URL}/${tableId}/followers`,
    userId,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const removeFollower = async (tableId: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(
    `${BASE_URL}/${tableId}/followers/${userId}`,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const getTableProfilerConfig = async (tableId: string) => {
  const response = await APIClient.get<Table>(
    `${BASE_URL}/${tableId}/tableProfilerConfig`
  );

  return response.data;
};

export const putTableProfileConfig = async (
  tableId: string,
  data: TableProfilerConfig
) => {
  const response = await APIClient.put<
    TableProfilerConfig,
    AxiosResponse<Table>
  >(
    `${BASE_URL}/${tableId}/tableProfilerConfig`,
    data,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const getTableProfilesList = async (
  tableFqn: string,
  params?: {
    startTs?: number;
    endTs?: number;
  }
) => {
  const url = `${BASE_URL}/${getEncodedFqn(tableFqn)}/tableProfile`;

  const response = await APIClient.get<PagingResponse<TableProfile[]>>(url, {
    params,
  });

  return response.data;
};

export const getSystemProfileList = async (
  tableFqn: string,
  params?: {
    startTs?: number;
    endTs?: number;
  }
) => {
  const url = `${BASE_URL}/${getEncodedFqn(tableFqn)}/systemProfile`;

  const response = await APIClient.get<PagingResponse<SystemProfile[]>>(url, {
    params,
  });

  return response.data;
};

export const getColumnProfilerList = async (
  columnFqn: string,
  params?: {
    startTs?: number;
    endTs?: number;
    limit?: number;
    before?: string;
    after?: string;
  }
) => {
  const url = `${BASE_URL}/${getEncodedFqn(columnFqn)}/columnProfile`;

  const response = await APIClient.get<{
    data: ColumnProfile[];
    paging: Paging;
  }>(url, { params });

  return response.data;
};

export const getSampleDataByTableId = async (id: string) => {
  const response = await APIClient.get<Table>(`${BASE_URL}/${id}/sampleData`);

  return response.data;
};

export const getLatestTableProfileByFqn = async (fqn: string) => {
  const encodedFQN = getEncodedFqn(fqn);
  const response = await APIClient.get<Table>(
    `${BASE_URL}/${encodedFQN}/tableProfile/latest`
  );

  return response.data;
};

export const getTableList = async (params?: TableListParams) => {
  const response = await APIClient.get<PagingResponse<Table[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const deleteSampleDataByTableId = async (id: string) => {
  return await APIClient.delete<Table>(`${BASE_URL}/${id}/sampleData`);
};

export const updateTablesVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<Table>>(
    `${BASE_URL}/${id}/vote`,
    data
  );

  return response.data;
};

export const exportTableDetailsInCSV = async (
  fqn: string,
  params?: {
    recursive?: boolean;
  }
) => {
  // FQN should be encoded already and we should not encode the fqn here to avoid double encoding
  const res = await APIClient.get(`tables/name/${fqn}/exportAsync`, {
    params,
  });

  return res.data;
};

export const importTableInCSVFormat = async (
  name: string,
  data: string,
  dryRun = true
) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const res = await APIClient.put(
    `/tables/name/${getEncodedFqn(name)}/import?dryRun=${dryRun}`,
    data,
    configOptions
  );

  return res.data;
};

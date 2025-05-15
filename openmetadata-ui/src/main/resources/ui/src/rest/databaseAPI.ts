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
import { PagingWithoutTotal, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import {
  Database,
  DatabaseProfilerConfig as ProfilerConfig,
} from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { EntityReference } from '../generated/entity/type';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export const getDatabases = async (
  service: string,
  fields: string,
  paging?: PagingWithoutTotal,
  include: Include = Include.NonDeleted
) => {
  const response = await APIClient.get<{
    data: Database[];
    paging: Paging;
  }>(`/databases`, {
    params: {
      service,
      fields,
      ...paging,
      include,
    },
  });

  return response.data;
};

export const getDatabaseDetailsByFQN = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<Database>(
    `/databases/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.NonDeleted,
      },
    }
  );

  return response.data;
};

export const patchDatabaseDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Database>>(
    `/databases/${id}`,
    data
  );

  return response.data;
};

export const patchDatabaseSchemaDetails = async (
  id: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<DatabaseSchema>
  >(`/databaseSchemas/${id}`, data);

  return response.data;
};

export const addFollowers = async (
  id: string,
  userId: string,
  path: string
) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${path}/${id}/followers`, userId, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const removeFollowers = async (
  id: string,
  userId: string,
  path: string
) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`${path}/${id}/followers/${userId}`, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};
export const getDatabaseSchemas = async ({
  include = Include.NonDeleted,
  databaseName,
  after,
  before,
  limit,
  fields,
}: {
  databaseName: string;
} & ListParams) => {
  const response = await APIClient.get<{
    data: DatabaseSchema[];
    paging: Paging;
  }>('/databaseSchemas', {
    params: {
      fields,
      database: databaseName,
      include,
      after,
      before,
      limit,
    },
  });

  return response.data;
};

export const getDatabaseSchemaDetailsByFQN = async (
  databaseSchemaName: string,
  params?: ListParams
) => {
  const response = await APIClient.get<DatabaseSchema>(
    `/databaseSchemas/name/${getEncodedFqn(databaseSchemaName)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.NonDeleted,
      },
    }
  );

  return response.data;
};

export const restoreDatabaseSchema = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<DatabaseSchema>
  >('/databaseSchemas/restore', {
    id,
  });

  return response.data;
};

export const restoreDatabase = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Database>
  >('/databases/restore', {
    id,
  });

  return response.data;
};

export const getDatabaseVersions = async (id: string) => {
  const url = `/databases/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getDatabaseVersionData = async (id: string, version: string) => {
  const url = `/databases/${id}/versions/${version}`;

  const response = await APIClient.get<Database>(url);

  return response.data;
};

export const getDatabaseSchemaVersions = async (id: string) => {
  const url = `/databaseSchemas/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getDatabaseSchemaVersionData = async (
  id: string,
  version: string
) => {
  const url = `/databaseSchemas/${id}/versions/${version}`;

  const response = await APIClient.get<DatabaseSchema>(url);

  return response.data;
};

export const updateDatabaseSchemaVotes = async (
  id: string,
  data: QueryVote
) => {
  const response = await APIClient.put<
    QueryVote,
    AxiosResponse<DatabaseSchema>
  >(`/databaseSchemas/${id}/vote`, data);

  return response.data;
};

export const updateDatabaseVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<Database>>(
    `databases/${id}/vote`,
    data
  );

  return response.data;
};

export const getDatabaseProfilerConfig = async (databaseId: string) => {
  const response = await APIClient.get<Database>(
    `/databases/${databaseId}/databaseProfilerConfig`
  );

  return response.data['databaseProfilerConfig'];
};

export const putDatabaseProfileConfig = async (
  databaseId: string,
  data: ProfilerConfig
) => {
  const response = await APIClient.put<ProfilerConfig, AxiosResponse<Database>>(
    `/databases/${databaseId}/databaseProfilerConfig`,
    data
  );

  return response.data['databaseProfilerConfig'];
};

export const getDatabaseSchemaProfilerConfig = async (
  databaseSchemaId: string
) => {
  const response = await APIClient.get<DatabaseSchema>(
    `/databaseSchemas/${databaseSchemaId}/databaseSchemaProfilerConfig`
  );

  return response.data['databaseSchemaProfilerConfig'];
};

export const putDatabaseSchemaProfileConfig = async (
  databaseSchemaId: string,
  data: ProfilerConfig
) => {
  const response = await APIClient.put<
    ProfilerConfig,
    AxiosResponse<DatabaseSchema>
  >(`/databaseSchemas/${databaseSchemaId}/databaseSchemaProfilerConfig`, data);

  return response.data['databaseSchemaProfilerConfig'];
};

export const exportDatabaseDetailsInCSV = async (
  fqn: string,
  params?: {
    recursive?: boolean;
  }
) => {
  const res = await APIClient.get(
    `databases/name/${getEncodedFqn(fqn)}/exportAsync`,
    {
      params,
    }
  );

  return res.data;
};

export const importDatabaseInCSVFormat = async (
  name: string,
  data: string,
  dryRun = true
) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const res = await APIClient.put(
    `/databases/name/${getEncodedFqn(name)}/import?dryRun=${dryRun}`,
    data,
    configOptions
  );

  return res.data;
};

export const exportDatabaseSchemaDetailsInCSV = async (
  fqn: string,
  params?: {
    recursive?: boolean;
  }
) => {
  const res = await APIClient.get(
    `databaseSchemas/name/${getEncodedFqn(fqn)}/exportAsync`,
    {
      params,
    }
  );

  return res.data;
};

export const importDatabaseSchemaInCSVFormat = async (
  name: string,
  data: string,
  dryRun = true
) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const res = await APIClient.put(
    `/databaseSchemas/name/${getEncodedFqn(name)}/import?dryRun=${dryRun}`,
    data,
    configOptions
  );

  return res.data;
};

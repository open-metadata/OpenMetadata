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
import { QueryVote } from '../components/TableQueries/TableQueries.interface';
import {
  Database,
  DatabaseProfilerConfig as ProfilerConfig,
} from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
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

export const getTables = (id: number): Promise<AxiosResponse> => {
  return APIClient.get('/databases/' + id + '/tables');
};

export const getDatabase = (
  id: string,
  query?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/databases/${id}`, query);

  return APIClient.get(url);
};

export const getDatabaseDetailsByFQN = async (
  fqn: string,
  arrQueryFields: string | string[],
  include: Include = Include.NonDeleted
) => {
  const url = getURLWithQueryFields(`/databases/name/${fqn}`, arrQueryFields);

  const response = await APIClient.get<Database>(url, {
    params: {
      include,
    },
  });

  return response.data;
};

export const patchDatabaseDetails = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Database>>(
    `/databases/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const patchDatabaseSchemaDetails = async (
  id: string,
  data: Operation[]
) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<DatabaseSchema>
  >(`/databaseSchemas/${id}`, data, configOptions);

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
  arrQueryFields?: string | string[],
  qParams?: string
) => {
  const url = `${getURLWithQueryFields(
    `/databaseSchemas/name/${databaseSchemaName}`,
    arrQueryFields,
    qParams
  )}`;

  const response = await APIClient.get<DatabaseSchema>(url);

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

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
import { PagingWithoutTotal } from 'Models';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Paging } from '../generated/type/paging';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getDatabases = async (
  service: string,
  fields: string,
  paging?: PagingWithoutTotal
) => {
  const response = await APIClient.get<{
    data: Database[];
    paging: Paging;
  }>(`/databases`, {
    params: { service, fields, after: paging?.after, before: paging?.before },
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
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(`/databases/name/${fqn}`, arrQueryFields);

  const response = await APIClient.get<Database>(url);

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

export const getDatabaseSchemas = async (
  databaseName: string,
  paging?: string,
  arrQueryFields?: string | string[]
) => {
  const url = `${getURLWithQueryFields(
    `/databaseSchemas`,
    arrQueryFields
  )}&database=${databaseName}${paging ? paging : ''}`;

  const response = await APIClient.get<{
    data: DatabaseSchema[];
    paging: Paging;
  }>(url);

  return response.data;
};
export const getDatabaseSchemaDetailsByFQN = async (
  databaseSchemaName: string,
  arrQueryFields?: string | string[]
) => {
  const url = `${getURLWithQueryFields(
    `/databaseSchemas/name/${databaseSchemaName}`,
    arrQueryFields
  )}`;

  const response = await APIClient.get<DatabaseSchema>(url);

  return response.data;
};

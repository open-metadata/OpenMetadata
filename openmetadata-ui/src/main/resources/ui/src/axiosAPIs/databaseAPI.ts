/*
 *  Copyright 2021 Collate
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
import { Database } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getDatabases: Function = (
  serviceName: string,
  paging: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/databases`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const getTables: Function = (id: number): Promise<AxiosResponse> => {
  return APIClient.get('/databases/' + id + '/tables');
};

export const getDatabase: Function = (
  id: string,
  query?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/databases/${id}`, query);

  return APIClient.get(url);
};

export const getDatabaseDetailsByFQN: Function = (
  fqn: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/databases/name/${fqn}`, arrQueryFields);

  return APIClient.get(url);
};

export const patchDatabaseDetails: Function = (
  id: string,
  data: Database
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/databases/${id}`, data, configOptions);
};

export const patchDatabaseSchemaDetails: Function = (
  id: string,
  data: Database
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/databaseSchemas/${id}`, data, configOptions);
};

export const getDatabaseSchemas: Function = (
  databaseName: string,
  paging: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/databaseSchemas`,
    arrQueryFields
  )}&database=${databaseName}${paging ? paging : ''}`;

  return APIClient.get(url);
};
export const getDatabaseSchemaDetailsByFQN: Function = (
  databaseSchemaName: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/databaseSchemas/name/${databaseSchemaName}`,
    arrQueryFields
  )}`;

  return APIClient.get(url);
};

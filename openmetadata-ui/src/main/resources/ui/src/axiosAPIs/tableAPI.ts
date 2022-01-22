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
import { Table } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTableDetails: Function = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/tables/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const getTableVersions: Function = (
  id: string
): Promise<AxiosResponse> => {
  const url = `/tables/${id}/versions`;

  return APIClient.get(url);
};
export const getTableVersion: Function = (
  id: string,
  version: string
): Promise<AxiosResponse> => {
  const url = `/tables/${id}/versions/${version}`;

  return APIClient.get(url);
};

export const getTableDetailsByFQN: Function = (
  fqn: string,
  arrQueryFields: string,
  include = 'all'
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/tables/name/${fqn}`,
    arrQueryFields,
    `include=${include}`
  );

  return APIClient.get(url);
};

export const getAllTables: Function = (
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/tables', arrQueryFields);

  return APIClient.get(url);
};

export const getDatabaseTables: Function = (
  databaseName: string,
  paging: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/tables`,
    arrQueryFields
  )}&database=${databaseName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const patchTableDetails: Function = (
  id: string,
  data: Table
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/tables/${id}`, data, configOptions);
};

export const addFollower: Function = (
  tableId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.put(`/tables/${tableId}/followers`, userId, configOptions);
};

export const removeFollower: Function = (
  tableId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.delete(
    `/tables/${tableId}/followers/${userId}`,
    configOptions
  );
};

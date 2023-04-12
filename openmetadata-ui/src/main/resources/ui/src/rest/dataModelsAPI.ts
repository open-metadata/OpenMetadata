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
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { EntityHistory } from 'generated/type/entityHistory';
import { EntityReference } from 'generated/type/entityReference';
import { getURLWithQueryFields } from 'utils/APIUtils';
import APIClient from './index';

const URL = '/dashboard/datamodels';

const configOptionsForPatch = {
  headers: { 'Content-type': 'application/json-patch+json' },
};

const configOptions = {
  headers: { 'Content-type': 'application/json' },
};

export const getDataModelDetails = async (
  id: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(`${URL}/${id}`, arrQueryFields);

  const response = await APIClient.get<DashboardDataModel>(url);

  return response.data;
};

export const getDataModelsByName = async (
  name: string,
  fields: string | string[]
) => {
  const response = await APIClient.get<DashboardDataModel>(
    `${URL}/name/${name}?fields=${fields}`
  );

  return response.data;
};

export const getDataModelDetailsByFQN = async (
  databaseSchemaName: string,
  arrQueryFields?: string | string[]
) => {
  const url = `${getURLWithQueryFields(
    `/dashboard/datamodels/name/${databaseSchemaName}`,
    arrQueryFields
  )}`;

  const response = await APIClient.get<DashboardDataModel>(url);

  return response.data;
};

export const patchDataModelDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<DashboardDataModel>
  >(`${URL}/${id}`, data, configOptionsForPatch);

  return response.data;
};

export const addDataModelFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${URL}/${id}/followers`, userId, configOptions);

  return response.data;
};

export const removeDataModelFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`${URL}/${id}/followers/${userId}`, configOptions);

  return response.data;
};

export const getDataModelVersionsList = async (id: string) => {
  const url = `${URL}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getDataModelVersion = async (id: string, version: string) => {
  const url = `${URL}/${id}/versions/${version}`;

  const response = await APIClient.get<DashboardDataModel>(url);

  return response.data;
};

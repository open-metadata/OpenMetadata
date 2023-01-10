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
import { RestoreRequestType } from 'Models';
import { ServicePageData } from 'pages/service';
import { Dashboard } from '../generated/entity/data/dashboard';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Paging } from '../generated/type/paging';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getDashboardVersions = async (id: string) => {
  const url = `/dashboards/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};
export const getDashboardVersion = async (id: string, version: string) => {
  const url = `/dashboards/${id}/versions/${version}`;

  const response = await APIClient.get<Dashboard>(url);

  return response.data;
};

export const getDashboards = async (
  serviceName: string,
  arrQueryFields: string | string[],
  paging?: string
) => {
  const url = `${getURLWithQueryFields(
    `/dashboards`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  const response = await APIClient.get<{
    data: ServicePageData[];
    paging: Paging;
  }>(url);

  return response.data;
};

export const getDashboardDetails = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/dashboards/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const getDashboardByFqn = async (
  fqn: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `/dashboards/name/${fqn}`,
    arrQueryFields,
    'include=all'
  );

  const response = await APIClient.get<Dashboard>(url);

  return response.data;
};

export const addFollower = async (dashboardID: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`/dashboards/${dashboardID}/followers`, userId, configOptions);

  return response.data;
};

export const removeFollower = async (dashboardID: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.delete<{
    changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
  }>(`/dashboards/${dashboardID}/followers/${userId}`, configOptions);

  return response.data;
};

export const patchDashboardDetails = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Dashboard>>(
    `/dashboards/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const restoreDashboard = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Dashboard>
  >('/dashboards/restore', { id });

  return response.data;
};

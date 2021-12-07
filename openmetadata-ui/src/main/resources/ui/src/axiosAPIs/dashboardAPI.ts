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
import { Dashboard } from '../generated/entity/data/dashboard';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getDashboards: Function = (
  serviceName: string,
  paging: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/dashboards`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const getDashboardDetails: Function = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/dashboards/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const getDashboardByFqn: Function = (
  fqn: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/dashboards/name/${fqn}`, arrQueryFields);

  return APIClient.get(url);
};

export const addFollower: Function = (
  dashboardID: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.put(
    `/dashboards/${dashboardID}/followers`,
    userId,
    configOptions
  );
};

export const removeFollower: Function = (
  dashboardID: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.delete(
    `/dashboards/${dashboardID}/followers/${userId}`,
    configOptions
  );
};

export const patchDashboardDetails: Function = (
  id: string,
  data: Dashboard
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/dashboards/${id}`, data, configOptions);
};

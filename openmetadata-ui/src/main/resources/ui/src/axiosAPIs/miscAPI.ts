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
import { isUndefined } from 'lodash';
import { Edge } from '../components/EntityLineage/EntityLineage.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import { getCurrentUserId } from '../utils/CommonUtils';
import APIClient from './index';

export const getOwnershipCount: Function = (
  ownership: string
): Promise<AxiosResponse> => {
  return APIClient.get(
    `/search/query?q=${ownership}:${getCurrentUserId()}&from=${0}&size=${0}`
  );
};

export const fetchAuthenticationConfig: Function =
  (): Promise<AxiosResponse> => {
    return APIClient.get('/config/auth');
  };

export const fetchSandboxConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/sandbox');
};

export const fetchSlackConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/slackChat');
};

export const fetchAirflowConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/airflow');
};

export const getVersion: Function = () => {
  return APIClient.get('/version');
};

export const addLineage: Function = (data: Edge): Promise<AxiosResponse> => {
  return APIClient.put(`/lineage`, data);
};

export const deleteLineageEdge: Function = (
  fromEntity: string,
  fromId: string,
  toEntity: string,
  toId: string
): Promise<AxiosResponse> => {
  return APIClient.delete(
    `/lineage/${fromEntity}/${fromId}/${toEntity}/${toId}`
  );
};

export const getLoggedInUserPermissions: Function =
  (): Promise<AxiosResponse> => {
    return APIClient.get('/permissions');
  };

export const deleteEntity: Function = (
  entityType: string,
  entityId: string,
  isRecursive: boolean,
  isSoftDelete = false
): Promise<AxiosResponse> => {
  let path = '';

  if (isSoftDelete) {
    path = getURLWithQueryFields(`/${entityType}/${entityId}`);
  } else {
    const searchParams = new URLSearchParams({ hardDelete: `true` });
    if (!isUndefined(isRecursive)) {
      searchParams.set('recursive', `${isRecursive}`);
    }
    path = getURLWithQueryFields(
      `/${entityType}/${entityId}`,
      '',
      `${searchParams.toString()}`
    );
  }

  return APIClient.delete(path);
};

export const getAdvancedFieldOptions = (
  q: string,
  index: string,
  field: string | undefined
): Promise<AxiosResponse> => {
  const params = { index, field, q };

  return APIClient.get(`/search/suggest`, { params });
};

export const getEntityCount = (
  path: string,
  database?: string
): Promise<AxiosResponse> => {
  const params = { database, limit: 0 };

  return APIClient.get(`/${path}`, { params });
};

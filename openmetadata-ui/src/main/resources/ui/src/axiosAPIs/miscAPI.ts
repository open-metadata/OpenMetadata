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
import { Edge } from '../components/EntityLineage/EntityLineage.interface';
import { AirflowConfiguration } from '../generated/configuration/airflowConfiguration';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { ResourcePermission } from '../generated/entity/policies/accessControl/resourcePermission';
import { EntitiesCount } from '../generated/entity/utils/entitiesCount';
import { Paging } from '../generated/type/paging';
import APIClient from './index';

export const fetchAuthenticationConfig = async () => {
  const response = await APIClient.get<AuthenticationConfiguration>(
    '/config/auth'
  );

  return response.data;
};

export const fetchSandboxConfig = async () => {
  const response = await APIClient.get<{ sandboxModeEnabled: boolean }>(
    '/config/sandbox'
  );

  return response.data;
};

export const fetchSlackConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/slackChat');
};

export const fetchAirflowConfig = async () => {
  const response = await APIClient.get<AirflowConfiguration>('/config/airflow');

  return response.data;
};

export const getVersion: () => Promise<{ version: string }> = () => {
  return APIClient.get('/version').then((res) => res.data);
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

export const getLoggedInUserPermissions = async () => {
  const params = {
    limit: 100,
  };
  const response = await APIClient.get<{
    data: ResourcePermission[];
    paging: Paging;
  }>('/permissions', { params });

  return response.data;
};

export const deleteEntity = (
  entityType: string,
  entityId: string,
  isRecursive: boolean,
  isHardDelete = true
) => {
  const params = {
    hardDelete: isHardDelete,
    recursive: isRecursive,
  };

  return APIClient.delete(`/${entityType}/${entityId}`, {
    params,
  });
};

export const getEntityCount = async (
  path: string,
  database?: string
): Promise<AxiosResponse<{ paging: Paging }>> => {
  const params = { database, limit: 0 };

  const response = await APIClient.get(`/${path}`, { params });

  return response.data;
};

export const getAllEntityCount = async () => {
  const response = await APIClient.get<EntitiesCount>('/util/entities/count');

  return response.data;
};

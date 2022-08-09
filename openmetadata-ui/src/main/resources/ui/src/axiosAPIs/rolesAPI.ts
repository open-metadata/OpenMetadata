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
import { Operation } from 'fast-json-patch';
import { Role } from '../generated/entity/teams/role';
import { EntityReference } from '../generated/type/entityReference';
import { Policy } from '../pages/RolesPage/role.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getRoles = async (arrQueryFields?: string | string[]) => {
  const url = getURLWithQueryFields('/roles', arrQueryFields);

  const response = await APIClient.get<{ data: Role[] }>(
    `${url}${arrQueryFields ? '&' : '?'}limit=1000000`
  );

  return response.data;
};
export const getRoleByName = async (
  name: string,
  arrQueryFields?: string | string[]
) => {
  const url = getURLWithQueryFields(`/roles/name/${name}`, arrQueryFields);

  const response = await APIClient.get<{ data: Role }>(url);

  return response.data;
};

export const createRole = async (
  data: Record<string, string | Array<EntityReference>>
) => {
  const response = await APIClient.post<unknown, AxiosResponse<Role>>(
    '/roles',
    data
  );

  return response.data;
};

export const updateRole = async (id: string, patch: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Role>>(
    `/roles/${id}`,
    patch,
    configOptions
  );

  return response.data;
};

export const getPolicy = async (
  id: string,
  arrQueryFields?: string | string[]
) => {
  const url = getURLWithQueryFields(`/policies/${id}`, arrQueryFields);

  const response = await APIClient.get<Policy>(url);

  return response.data;
};

export const updatePolicy = async (
  data: Pick<Policy, 'name' | 'policyType' | 'rules'>
) => {
  const response = await APIClient.put<Policy>(`/policies`, data as Policy);

  return response.data;
};

export const getPolicies = async () => {
  const response = await APIClient.get<Policy[]>('/policies');

  return response.data;
};

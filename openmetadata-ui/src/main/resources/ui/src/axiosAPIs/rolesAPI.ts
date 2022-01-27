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
import { Policy } from '../pages/RolesPage/policy.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getRoles = (
  arrQueryFields?: string | string[]
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/roles', arrQueryFields);

  return APIClient.get(`${url}${arrQueryFields ? '&' : '?'}limit=1000000`);
};
export const getRoleByName = (
  name: string,
  arrQueryFields?: string | string[]
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/roles/name/${name}`, arrQueryFields);

  return APIClient.get(url);
};

export const createRole = (
  data: Record<string, string>
): Promise<AxiosResponse> => {
  return APIClient.post('/roles', data);
};

export const updateRole = (
  id: string,
  patch: Operation[]
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/roles/${id}`, patch, configOptions);
};

export const getPolicy = (
  id: string,
  arrQueryFields?: string | string[]
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/policies/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const updatePolicy = (
  data: Pick<Policy, 'name' | 'policyType' | 'rules'>
): Promise<AxiosResponse> => {
  return APIClient.put(`/policies`, data);
};

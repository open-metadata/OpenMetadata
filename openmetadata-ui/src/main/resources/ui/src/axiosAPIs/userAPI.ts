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
import { isUndefined } from 'lodash';
import { UserProfile } from 'Models';
import { SearchIndex } from '../enums/search.enum';
import { CreateUser } from '../generated/api/teams/createUser';
import { User } from '../generated/entity/teams/user';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getUsers = (
  arrQueryFields?: string,
  limit?: number,
  team?: { [key: string]: string }
): Promise<AxiosResponse> => {
  let qParam = '';
  if (!isUndefined(team)) {
    const paramArr = Object.entries(team);
    qParam = paramArr.reduce((pre, curr, index) => {
      return (
        pre + `${curr[0]}=${curr[1]}${index !== paramArr.length - 1 ? '&' : ''}`
      );
    }, '');
  }
  const url =
    `${getURLWithQueryFields('/users', arrQueryFields, qParam)}` +
    (limit
      ? `${arrQueryFields?.length || qParam ? '&' : '?'}limit=${limit}`
      : '');

  return APIClient.get(url);
};

export const updateUserDetail = (
  id: string,
  data: Operation[]
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/users/${id}`, data, configOptions);
};

export const getUserByName = (
  name: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/users/name/' + name, arrQueryFields);

  return APIClient.get(url);
};

export const getLoggedInUser = (arrQueryFields?: string) => {
  const url = getURLWithQueryFields('/users/loggedInUser', arrQueryFields);

  return APIClient.get(url);
};

export const getUserDetails: Function = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/users/${id}`);
};

export const getTeams = (): Promise<AxiosResponse> => {
  return APIClient.get('/teams');
};

export const getRoles: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/roles');
};

export const updateUserRole: Function = (
  id: string,
  options: Array<string>
): Promise<AxiosResponse> => {
  return APIClient.post(`/users/${id}/roles`, options);
};

export const updateUserTeam: Function = (
  id: string,
  options: Array<string>
): Promise<AxiosResponse> => {
  return APIClient.post(`/users/${id}/teams`, options);
};

export const getUserById: Function = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/users/${id}`);
};

export const createUser = (
  userDetails: Record<string, string | Array<string> | UserProfile> | CreateUser
): Promise<AxiosResponse> => {
  return APIClient.post(`/users`, userDetails);
};

export const updateUser = (
  data: Pick<User, 'email' | 'name' | 'displayName' | 'profile' | 'isAdmin'>
): Promise<AxiosResponse> => {
  return APIClient.put('/users', data);
};

export const getUserCounts = () => {
  return APIClient.get(
    `/search/query?q=*&from=0&size=0&index=${SearchIndex.USER}`
  );
};

export const deleteUser = (id: string) => {
  return APIClient.delete(`/users/${id}`);
};

export const getUserToken: Function = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/users/token/${id}`);
};

export const generateUserToken: Function = (
  id: string,
  data: Record<string, string>
): Promise<AxiosResponse> => {
  return APIClient.put(`/users/generateToken/${id}`, data);
};

export const revokeUserToken: Function = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.put(`/users/revokeToken/${id}`);
};

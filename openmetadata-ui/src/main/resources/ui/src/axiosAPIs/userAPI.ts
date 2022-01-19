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
import { UserProfile } from 'Models';
import { User } from '../generated/entity/teams/user';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getUsers = (
  arrQueryFields?: string,
  limit?: number
): Promise<AxiosResponse> => {
  const url =
    `${getURLWithQueryFields('/users', arrQueryFields)}` +
    (limit ? `${arrQueryFields?.length ? '&' : '?'}limit=${limit}` : '');

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

export const createUser = (userDetails: {
  [name: string]: string | Array<string> | UserProfile;
}): Promise<AxiosResponse> => {
  return APIClient.post(`/users`, userDetails);
};

export const updateUser = (
  data: Pick<User, 'email' | 'name' | 'displayName' | 'profile' | 'isAdmin'>
): Promise<AxiosResponse> => {
  return APIClient.put('/users', data);
};

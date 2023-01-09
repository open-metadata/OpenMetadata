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
import { isNil, isUndefined } from 'lodash';
import { PagingResponse } from 'Models';
import { SearchIndex } from '../enums/search.enum';
import {
  AuthenticationMechanism,
  CreateUser,
} from '../generated/api/teams/createUser';
import { JwtAuth } from '../generated/auth/jwtAuth';
import { Bot } from '../generated/entity/bot';
import { Role } from '../generated/entity/teams/role';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/type/entityReference';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getUsers = async (
  arrQueryFields?: string,
  limit?: number,
  team?: { [key: string]: string },
  isAdmin?: boolean,
  isBot?: boolean
) => {
  let qParam = '';
  if (!isUndefined(team)) {
    const paramArr = Object.entries(team);
    qParam = paramArr.reduce((pre, curr, index) => {
      return (
        pre + `${curr[0]}=${curr[1]}${index !== paramArr.length - 1 ? '&' : ''}`
      );
    }, '');
  }
  if (!isUndefined(isAdmin)) {
    qParam = `${qParam}&isAdmin=${isAdmin}`;
  }
  if (!isUndefined(isBot)) {
    qParam = `${qParam}&isBot=${isBot}`;
  }
  const url =
    `${getURLWithQueryFields('/users', arrQueryFields, qParam)}` +
    (!isNil(limit)
      ? `${arrQueryFields?.length || qParam ? '&' : '?'}limit=${limit}`
      : '');

  const response = await APIClient.get<PagingResponse<User[]>>(url);

  return response.data;
};

export const updateUserDetail = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<User>>(
    `/users/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const getUserByName = async (name: string, arrQueryFields?: string) => {
  const url = getURLWithQueryFields('/users/name/' + name, arrQueryFields);

  const response = await APIClient.get<User>(url);

  return response.data;
};

export const getUserById = async (id: string, arrQueryFields?: string) => {
  const url = getURLWithQueryFields(`/users/${id}`, arrQueryFields);

  const response = await APIClient.get<User>(url);

  return response.data;
};

export const getLoggedInUser = async (arrQueryFields?: string) => {
  const url = getURLWithQueryFields('/users/loggedInUser', arrQueryFields);

  const response = await APIClient.get<User>(url);

  return response.data;
};

export const getUserDetails = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/users/${id}`);
};

export const getTeams = (): Promise<AxiosResponse> => {
  return APIClient.get('/teams');
};

export const getRoles = async () => {
  const response = await APIClient.get<PagingResponse<Role[]>>('/roles');

  return response.data;
};

export const updateUserRole = (
  id: string,
  options: Array<string>
): Promise<AxiosResponse> => {
  return APIClient.post(`/users/${id}/roles`, options);
};

export const updateUserTeam = (
  id: string,
  options: Array<string>
): Promise<AxiosResponse> => {
  return APIClient.post(`/users/${id}/teams`, options);
};

export const createUser = async (userDetails: CreateUser) => {
  const response = await APIClient.post<CreateUser, AxiosResponse<User>>(
    `/users`,
    userDetails
  );

  return response.data;
};

export const updateUser = (
  data: User | CreateUser
): Promise<AxiosResponse<User>> => {
  return APIClient.put('/users', data);
};

export const getUserCounts = (): Promise<AxiosResponse<unknown>> => {
  return APIClient.get(
    `/search/query?q=*&from=0&size=0&index=${SearchIndex.USER}`
  );
};

export const deleteUser = (id: string) => {
  return APIClient.delete(`/users/${id}`);
};

export const getUserToken = async (id: string) => {
  const response = await APIClient.get<JwtAuth>(`/users/token/${id}`);

  return response.data;
};

export const generateUserToken = async (id: string, expiry: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };
  const payload = {
    JWTTokenExpiry: expiry,
  };

  const response = await APIClient.put<typeof payload, AxiosResponse<JwtAuth>>(
    `/users/generateToken/${id}`,
    payload,
    configOptions
  );

  return response.data;
};

export const revokeUserToken = async (id: string) => {
  const response = await APIClient.put<{ id: string }, AxiosResponse<User>>(
    '/users/revokeToken',
    { id }
  );

  return response.data;
};

export const getGroupTypeTeams = async () => {
  const response = await APIClient.get<EntityReference[]>(
    `/users/loggedInUser/groupTeams`
  );

  return response.data;
};

export const getAuthMechanismForBotUser = async (botId: string) => {
  const response = await APIClient.get<AuthenticationMechanism>(
    `/users/auth-mechanism/${botId}`
  );

  return response.data;
};

export const getBotByName = async (name: string, arrQueryFields?: string) => {
  const url = getURLWithQueryFields(`/bots/name/${name}`, arrQueryFields);

  const response = await APIClient.get<Bot>(url);

  return response.data;
};

export const updateBotDetail = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Bot>>(
    `/bots/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const createUserWithPut = async (userDetails: CreateUser) => {
  const response = await APIClient.put<CreateUser, AxiosResponse<User>>(
    `/users`,
    userDetails
  );

  return response.data;
};

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

import { PagingResponse, RestoreRequestType } from 'Models';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import {
  AuthenticationMechanism,
  CreateUser,
} from '../generated/api/teams/createUser';
import { JwtAuth } from '../generated/auth/jwtAuth';
import { PersonalAccessToken } from '../generated/auth/personalAccessToken';
import { Bot } from '../generated/entity/bot';
import { Role } from '../generated/entity/teams/role';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export interface UsersQueryParams {
  fields?: string;
  team?: string;
  limit?: number;
  before?: string;
  after?: string;
  isAdmin?: boolean;
  isBot?: boolean;
  include?: Include;
}

export const getUsers = async (params: UsersQueryParams) => {
  const response = await APIClient.get<PagingResponse<User[]>>('/users', {
    params,
  });

  return response.data;
};

export const updateUserDetail = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<User>>(
    `/users/${id}`,
    data
  );

  return response.data;
};

export const getUserByName = async (name: string, params?: ListParams) => {
  const response = await APIClient.get<User>(
    `/users/name/${getEncodedFqn(name)}`,
    { params }
  );

  return response.data;
};

export const getUserById = async (id: string, params?: ListParams) => {
  const response = await APIClient.get<User>(`/users/${id}`, { params });

  return response.data;
};

export const getLoggedInUser = async (params?: ListParams) => {
  const response = await APIClient.get<User>('/users/loggedInUser', { params });

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

export const restoreUser = async (id: string) => {
  const response = await APIClient.put<RestoreRequestType, AxiosResponse<User>>(
    `/users/restore`,
    { id }
  );

  return response.data;
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
  const payload = {
    JWTTokenExpiry: expiry,
  };

  const response = await APIClient.put<typeof payload, AxiosResponse<JwtAuth>>(
    `/users/generateToken/${id}`,
    payload,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
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

export const getBotByName = async (name: string, params?: ListParams) => {
  const response = await APIClient.get<Bot>(
    `/bots/name/${getEncodedFqn(name)}`,
    { params }
  );

  return response.data;
};

export const updateBotDetail = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Bot>>(
    `/bots/${id}`,
    data
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

export const getUserAccessToken = async () => {
  const response = await APIClient.get<{
    data: PersonalAccessToken[];
  }>('/users/security/token');

  return response.data.data;
};

export const updateUserAccessToken = async ({
  JWTTokenExpiry,
  tokenName,
}: {
  JWTTokenExpiry?: string;
  tokenName?: string;
}) => {
  const response = await APIClient.put<
    {
      JWTTokenExpiry?: string;
      tokenName?: string;
    },
    AxiosResponse<PersonalAccessToken>
  >(`/users/security/token`, {
    JWTTokenExpiry,
    tokenName,
  });

  return response.data;
};

export const revokeAccessToken = async (params: string) => {
  const response = await APIClient.put<PersonalAccessToken[]>(
    '/users/security/token/revoke?' + params
  );

  return response.data;
};

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
import {
  AuthenticationMechanism,
  CreateUser,
} from '../generated/api/teams/createUser';
import { PersonalAccessToken } from '../generated/auth/personalAccessToken';
import { Bot } from '../generated/entity/bot';
import { User } from '../generated/entity/teams/user';
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

export interface OnlineUsersQueryParams {
  timeWindow?: number;
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
}

export const getUsers = async (params: UsersQueryParams) => {
  const response = await APIClient.get<PagingResponse<User[]>>('/users', {
    params,
  });

  return response.data;
};

export const getOnlineUsers = async (params: OnlineUsersQueryParams) => {
  const response = await APIClient.get<PagingResponse<User[]>>(
    '/users/online',
    {
      params,
    }
  );

  return response.data;
};

export const updateUserDetail = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<User>>(
    `/users/${id}`,
    data
  );

  return response.data;
};

export const updateLoginTime = async () => {
  const response = await APIClient.put(`/users/updateLoginTime`);

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

export const createUser = async (userDetails: CreateUser) => {
  const response = await APIClient.post<CreateUser, AxiosResponse<User>>(
    `/users`,
    userDetails
  );

  return response.data;
};

export const restoreUser = async (id: string) => {
  const response = await APIClient.put<RestoreRequestType, AxiosResponse<User>>(
    `/users/restore`,
    { id }
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

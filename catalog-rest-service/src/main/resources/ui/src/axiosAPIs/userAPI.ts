/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosResponse } from 'axios';
import { UserProfile } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getUsers = (arrQueryFields?: string): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/users', arrQueryFields);

  return APIClient.get(url);
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
}) => {
  return APIClient.post(`/users`, userDetails);
};

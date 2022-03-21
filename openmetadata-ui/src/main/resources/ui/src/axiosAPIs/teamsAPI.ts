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
import { Team } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTeams = (
  arrQueryFields?: string | string[]
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/teams', arrQueryFields);

  return APIClient.get(`${url}${arrQueryFields ? '&' : '?'}limit=1000000`);
};

export const getTeamByName: Function = (
  name: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/teams/name/${name}`, arrQueryFields);

  return APIClient.get(url);
};

export const createTeam: Function = (data: Team) => {
  return APIClient.post('/teams', data);
};

export const patchTeamDetail: Function = (id: string, data: Team) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/teams/${id}`, data, configOptions);
};

export const deleteTeam = (id: string): Promise<AxiosResponse> => {
  return APIClient.delete(`/teams/${id}`);
};

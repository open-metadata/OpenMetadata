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
import { CreateTeam } from '../generated/api/teams/createTeam';
import { Team } from '../generated/entity/teams/team';
import { TeamHierarchy } from '../generated/entity/teams/teamHierarchy';
import { CSVImportResult } from '../generated/type/csvImportResult';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

export const getTeams = async (
  params?: ListParams & { parentTeam: string }
) => {
  const response = await APIClient.get<PagingResponse<Team[]>>('/teams', {
    params: {
      ...params,
      limit: params?.limit ?? 100000,
    },
  });

  return response.data;
};

export const getTeamsHierarchy = async (isJoinable = false) => {
  const response = await APIClient.get<{ data: TeamHierarchy[] }>(
    '/teams/hierarchy',
    {
      params: {
        isJoinable,
      },
    }
  );

  return response.data;
};

export const getTeamByName = async (name: string, params?: ListParams) => {
  const response = await APIClient.get<Team>(`/teams/name/${name}`, {
    params,
  });

  return response.data;
};

export const createTeam = async (data: CreateTeam) => {
  const response = await APIClient.post<CreateTeam>('/teams', data);

  return response.data;
};

export const patchTeamDetail = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Team>>(
    `/teams/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const deleteTeam = async (id: string) => {
  const response = await APIClient.delete<Team>(`/teams/${id}`);

  return response.data;
};

export const updateTeam = async (data: CreateTeam) => {
  const response = await APIClient.put<CreateTeam, AxiosResponse<Team>>(
    '/teams',
    data
  );

  return response.data;
};

export const restoreTeam = async (id: string) => {
  const response = await APIClient.put<RestoreRequestType, AxiosResponse<Team>>(
    '/teams/restore',
    { id }
  );

  return response.data;
};

export const exportTeam = async (teamName: string) => {
  const response = await APIClient.get<string>(
    `/teams/name/${teamName}/export`
  );

  return response.data;
};

export const exportUserOfTeam = async (team: string) => {
  const response = await APIClient.get<string>(`/users/export`, {
    params: { team },
  });

  return response.data;
};

export const importTeam = async (
  teamName: string,
  data: string,
  dryRun = true
) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
    params: {
      dryRun,
    },
  };
  const response = await APIClient.put<string, AxiosResponse<CSVImportResult>>(
    `/teams/name/${teamName}/import`,
    data,
    configOptions
  );

  return response.data;
};

export const importUserInTeam = async (
  team: string,
  data: string,
  dryRun = true
) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
    params: {
      team,
      dryRun,
    },
  };
  const response = await APIClient.put<string, AxiosResponse<CSVImportResult>>(
    `/users/import`,
    data,
    configOptions
  );

  return response.data;
};

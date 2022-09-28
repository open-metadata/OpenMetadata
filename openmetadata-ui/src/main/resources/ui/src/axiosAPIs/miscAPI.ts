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

import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Edge } from '../components/EntityLineage/EntityLineage.interface';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { AirflowConfiguration } from '../generated/configuration/airflowConfiguration';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { EntitiesCount } from '../generated/entity/utils/entitiesCount';
import { Paging } from '../generated/type/paging';
import { getCurrentUserId } from '../utils/CommonUtils';
import { getSearchAPIQuery } from '../utils/SearchUtils';
import APIClient from './index';

export const searchData: Function = (
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: string,
  onlyDeleted = false,
  trackTotalHits = false
): Promise<AxiosResponse> => {
  return APIClient.get(
    `/search/query?${getSearchAPIQuery(
      queryString,
      from,
      size,
      filters,
      sortField,
      sortOrder,
      searchIndex,
      onlyDeleted,
      trackTotalHits
    )}`
  );
};

export const getOwnershipCount: Function = (
  ownership: string
): Promise<AxiosResponse> => {
  return APIClient.get(
    `/search/query?q=${ownership}:${getCurrentUserId()}&from=${0}&size=${0}`
  );
};

export const fetchAuthenticationConfig = async () => {
  const response = await APIClient.get<AuthenticationConfiguration>(
    '/config/auth'
  );

  return response.data;
};

export const fetchSandboxConfig = async () => {
  const response = await APIClient.get<{ sandboxModeEnabled: boolean }>(
    '/config/sandbox'
  );

  return response.data;
};

export const fetchSlackConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/slackChat');
};

export const fetchAirflowConfig = async () => {
  const response = await APIClient.get<AirflowConfiguration>('/config/airflow');

  return response.data;
};

export const getSuggestions = (
  queryString: string,
  searchIndex?: string
): Promise<AxiosResponse> => {
  const params = {
    q: queryString,
    index:
      searchIndex ??
      `${SearchIndex.DASHBOARD},${SearchIndex.TABLE},${SearchIndex.TOPIC},${SearchIndex.PIPELINE},${SearchIndex.MLMODEL}`,
  };

  return APIClient.get(`/search/suggest`, { params });
};

export const getVersion = async () => {
  const response = await APIClient.get<{ version: string }>('/version');

  return response.data;
};

export const addLineage: Function = (data: Edge): Promise<AxiosResponse> => {
  return APIClient.put(`/lineage`, data);
};

export const deleteLineageEdge: Function = (
  fromEntity: string,
  fromId: string,
  toEntity: string,
  toId: string
): Promise<AxiosResponse> => {
  return APIClient.delete(
    `/lineage/${fromEntity}/${fromId}/${toEntity}/${toId}`
  );
};

export const getInitialEntity = (
  index: SearchIndex,
  params = {} as AxiosRequestConfig
): Promise<AxiosResponse> => {
  return APIClient.get(`/search/query`, {
    params: {
      q: WILD_CARD_CHAR,
      from: 0,
      size: 5,
      index,
      ...params,
    },
  });
};

export const getSuggestedUsers = (
  term: string
  // TODO: improve types below
): Promise<AxiosResponse<unknown>> => {
  return APIClient.get(`/search/suggest?q=${term}&index=${SearchIndex.USER}`);
};

export const getSuggestedTeams = (
  term: string
  // TODO: improve types below
): Promise<AxiosResponse<unknown>> => {
  return APIClient.get(`/search/suggest?q=${term}&index=${SearchIndex.TEAM}`);
};

export const getUserSuggestions = (term: string): Promise<AxiosResponse> => {
  const params = {
    q: term,
    index: `${SearchIndex.USER},${SearchIndex.TEAM}`,
  };

  return APIClient.get(`/search/suggest`, { params });
};

export const getTeamsByQuery = async (params: {
  q: string;
  from?: number;
  size?: number;
}) => {
  const response = await APIClient.get(`/search/query`, {
    params: {
      index: SearchIndex.TEAM,
      ...params,
      // eslint-disable-next-line @typescript-eslint/camelcase
      sort_field: 'name.keyword',
      // eslint-disable-next-line @typescript-eslint/camelcase
      sort_order: 'asc',
    },
  });

  return response.data;
};

export const getTagSuggestions = (term: string): Promise<AxiosResponse> => {
  const params = {
    q: term,
    index: `${SearchIndex.TAG},${SearchIndex.GLOSSARY}`,
  };

  return APIClient.get(`/search/suggest`, { params });
};

export const getSearchedUsers = (
  queryString: string,
  from: number,
  size = 10
): Promise<AxiosResponse> => {
  return searchData(queryString, from, size, '', '', '', SearchIndex.USER);
};

export const getSearchedTeams = (
  queryString: string,
  from: number,
  size = 10
): Promise<AxiosResponse> => {
  return searchData(queryString, from, size, '', '', '', SearchIndex.TEAM);
};

export const getSearchedUsersAndTeams = (
  queryString: string,
  from: number,
  size = 10
): Promise<AxiosResponse> => {
  return searchData(
    queryString,
    from,
    size,
    '',
    '',
    '',
    `${SearchIndex.USER},${SearchIndex.TEAM}`
  );
};

export const deleteEntity = async (
  entityType: string,
  entityId: string,
  isRecursive: boolean,
  isHardDelete = true
) => {
  const params = {
    hardDelete: isHardDelete,
    recursive: isRecursive,
  };

  return APIClient.delete(`/${entityType}/${entityId}`, {
    params,
  });
};

export const getAdvancedFieldOptions = (
  q: string,
  index: string,
  field: string | undefined
): Promise<AxiosResponse> => {
  const params = { index, field, q };

  return APIClient.get(`/search/suggest`, { params });
};

export const getEntityCount = async (
  path: string,
  database?: string
): Promise<AxiosResponse<{ paging: Paging }>> => {
  const params = { database, limit: 0 };

  const response = await APIClient.get(`/${path}`, { params });

  return response.data;
};

export const getAllEntityCount = async () => {
  const response = await APIClient.get<EntitiesCount>('/util/entities/count');

  return response.data;
};

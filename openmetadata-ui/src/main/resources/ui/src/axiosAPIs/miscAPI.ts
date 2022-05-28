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
import { isUndefined } from 'lodash';
import { Edge } from '../components/EntityLineage/EntityLineage.interface';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { getURLWithQueryFields } from '../utils/APIUtils';
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
  onlyDeleted = false
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
      onlyDeleted
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

export const fetchAuthenticationConfig: Function =
  (): Promise<AxiosResponse> => {
    return APIClient.get('/config/auth');
  };

export const fetchSandboxConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/sandbox');
};

export const fetchAirflowConfig = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/airflow');
};

export const getSuggestions: Function = (
  queryString: string,
  searchIndex?: string
): Promise<AxiosResponse> => {
  return APIClient.get(
    `/search/suggest?q=${queryString}&index=${
      searchIndex ??
      `${SearchIndex.DASHBOARD},${SearchIndex.TABLE},${SearchIndex.TOPIC},${SearchIndex.PIPELINE}`
    }
    `
  );
};

export const getVersion: Function = () => {
  return APIClient.get('/version');
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

export const getLoggedInUserPermissions: Function =
  (): Promise<AxiosResponse> => {
    return APIClient.get('/permissions');
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

export const getSuggestedUsers = (term: string): Promise<AxiosResponse> => {
  return APIClient.get(`/search/suggest?q=${term}&index=${SearchIndex.USER}`);
};

export const getSuggestedTeams = (term: string): Promise<AxiosResponse> => {
  return APIClient.get(`/search/suggest?q=${term}&index=${SearchIndex.TEAM}`);
};

export const getUserSuggestions: Function = (
  term: string
): Promise<AxiosResponse> => {
  return APIClient.get(
    `/search/suggest?q=${term}&index=${SearchIndex.USER},${SearchIndex.TEAM}`
  );
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

export const deleteEntity: Function = (
  entityType: string,
  entityId: string,
  isRecursive: boolean,
  isSoftDelete = false
): Promise<AxiosResponse> => {
  let path = '';

  if (isSoftDelete) {
    path = getURLWithQueryFields(`/${entityType}/${entityId}`);
  } else {
    const searchParams = new URLSearchParams({ hardDelete: `true` });
    if (!isUndefined(isRecursive)) {
      searchParams.set('recursive', `${isRecursive}`);
    }
    path = getURLWithQueryFields(
      `/${entityType}/${entityId}`,
      '',
      `${searchParams.toString()}`
    );
  }

  return APIClient.delete(path);
};

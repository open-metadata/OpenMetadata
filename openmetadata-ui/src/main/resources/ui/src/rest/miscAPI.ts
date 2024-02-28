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
import { Edge } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { ExploreSearchIndex } from '../components/Explore/ExplorePage.interface';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { PipelineServiceClientConfiguration } from '../generated/configuration/pipelineServiceClientConfiguration';
import { Paging } from '../generated/type/paging';
import {
  RawSuggestResponse,
  SearchResponse,
} from '../interface/search.interface';
import { getSearchAPIQueryParams } from '../utils/SearchUtils';
import APIClient from './index';

export const searchData = <SI extends SearchIndex>(
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: SI | SI[],
  onlyDeleted = false,
  trackTotalHits = false,
  wildcard = true
) => {
  const { q, ...params } = getSearchAPIQueryParams(
    queryString,
    from,
    size,
    filters,
    sortField,
    sortOrder,
    searchIndex,
    onlyDeleted,
    trackTotalHits,
    wildcard
  );

  return APIClient.get<SearchResponse<SI>>(`/search/query?q=${q}`, {
    params,
  });
};

export const fetchAuthenticationConfig = async () => {
  const response = await APIClient.get<AuthenticationConfiguration>(
    '/system/config/auth'
  );

  return response.data;
};

export const fetchAuthorizerConfig = async () => {
  const response = await APIClient.get<AuthorizerConfiguration>(
    '/system/config/authorizer'
  );

  return response.data;
};

export const fetchSandboxConfig = async () => {
  const response = await APIClient.get<{ sandboxModeEnabled: boolean }>(
    '/system/config/sandbox'
  );

  return response.data;
};

export const fetchAirflowConfig = async () => {
  const response = await APIClient.get<PipelineServiceClientConfiguration>(
    '/system/config/pipeline-service-client'
  );

  return response.data;
};

export const getSuggestions = <T extends SearchIndex>(
  queryString: string,
  searchIndex?: T
) => {
  const params = {
    q: queryString,
    index: searchIndex ?? [
      SearchIndex.DASHBOARD,
      SearchIndex.TABLE,
      SearchIndex.TOPIC,
      SearchIndex.PIPELINE,
      SearchIndex.MLMODEL,
      SearchIndex.CONTAINER,
      SearchIndex.STORED_PROCEDURE,
      SearchIndex.DASHBOARD_DATA_MODEL,
      SearchIndex.GLOSSARY_TERM,
      SearchIndex.TAG,
      SearchIndex.SEARCH_INDEX,
    ],
  };

  if (searchIndex) {
    return APIClient.get<RawSuggestResponse<T>>(`/search/suggest`, {
      params,
    });
  }

  return APIClient.get<RawSuggestResponse<ExploreSearchIndex>>(
    `/search/suggest`,
    {
      params,
    }
  );
};

export const getVersion = async () => {
  const response = await APIClient.get<{ version: string }>('/system/version');

  return response.data;
};

export const postSamlLogout = async (data: { token: string }) => {
  const response = await APIClient.post(`/users/logout`, { ...data });

  return response.data;
};

export const addLineage = (data: Edge): Promise<AxiosResponse> => {
  return APIClient.put(`/lineage`, data);
};

export const deleteLineageEdge = (
  fromEntity: string,
  fromId: string,
  toEntity: string,
  toId: string
): Promise<AxiosResponse> => {
  return APIClient.delete(
    `/lineage/${fromEntity}/${fromId}/${toEntity}/${toId}`
  );
};

export const getSuggestedUsers = (term: string) => {
  return APIClient.get<RawSuggestResponse<SearchIndex.USER>>(
    `/search/suggest?q=${term}&index=${SearchIndex.USER}`
  );
};

export const getSuggestedTeams = (term: string) => {
  return APIClient.get<RawSuggestResponse<SearchIndex.TEAM>>(
    `/search/suggest?q=${term}&index=${SearchIndex.TEAM}`
  );
};

export const getUserSuggestions = (term: string, userOnly = false) => {
  const params = {
    q: term || WILD_CARD_CHAR,
    index: userOnly
      ? SearchIndex.USER
      : `${SearchIndex.USER},${SearchIndex.TEAM}`,
  };

  return APIClient.get<RawSuggestResponse<SearchIndex.USER>>(
    `/search/suggest`,
    { params }
  );
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
      sort_field: 'name.keyword',
      sort_order: 'asc',
    },
  });

  return response.data;
};

export const getSearchedUsers = (
  queryString: string,
  from: number,
  size = 10
) => {
  return searchData(queryString, from, size, '', '', '', SearchIndex.USER);
};

export const getSearchedTeams = (
  queryString: string,
  from: number,
  filter?: string,
  size = 10
) => {
  return searchData(
    queryString,
    from,
    size,
    filter ?? '',
    '',
    '',
    SearchIndex.TEAM
  );
};

export const getSearchedUsersAndTeams = async (
  queryString: string,
  from: number,
  size = 10
) => {
  const response = await searchData(queryString, from, size, '', '', '', [
    SearchIndex.USER,
    SearchIndex.TEAM,
  ]);

  return response.data;
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

  return APIClient.delete<{ version?: number }>(`/${entityType}/${entityId}`, {
    params,
  });
};

export const getAdvancedFieldOptions = (
  q: string,
  index: SearchIndex,
  field: string | undefined
) => {
  const params = { index, field, q };

  return APIClient.get<RawSuggestResponse<typeof index>>(`/search/suggest`, {
    params,
  });
};

/**
 * Retrieves the aggregate field options based on the provided parameters.
 *
 * @param {SearchIndex | SearchIndex[]} index - The search index or array of search indexes.
 * @param {string} field - The field to aggregate on. Example owner.displayName.keyword
 * @param {string} value - The value to filter the aggregation on.
 * @param {string} q - The search query.
 * @return {Promise<SearchResponse<ExploreSearchIndex>>} A promise that resolves to the search response
 * containing the aggregate field options.
 */
export const getAggregateFieldOptions = (
  index: SearchIndex | SearchIndex[],
  field: string,
  value: string,
  q: string
) => {
  const withWildCardValue = value ? `.*${value}.*` : '.*';
  const params = { index, field, value: withWildCardValue, q };

  return APIClient.get<SearchResponse<ExploreSearchIndex>>(
    `/search/aggregate`,
    {
      params,
    }
  );
};

export const getEntityCount = async (
  path: string,
  database?: string
): Promise<{ paging: Paging }> => {
  const params = { database, limit: 0 };

  const response = await APIClient.get(`/${path}`, { params });

  return response.data;
};

export const fetchMarkdownFile = async (filePath: string) => {
  let baseURL;

  try {
    const url = new URL(filePath);
    baseURL = `${url.origin}/`;
  } catch (error) {
    baseURL = '/';
  }

  const response = await APIClient.get<string>(filePath, {
    baseURL,
    headers: {
      'Content-Type': 'text/markdown',
      Accept: 'text/markdown',
    },
  });

  return response.data;
};

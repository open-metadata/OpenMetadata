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
import { PAGE_SIZE } from '../constants/constants';
import { AsyncDeleteJob } from '../context/AsyncDeleteProvider/AsyncDeleteProvider.interface';
import { SearchIndex } from '../enums/search.enum';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { SearchRequest } from '../generated/search/searchRequest';
import { ValidationResponse } from '../generated/system/validationResponse';
import { Paging } from '../generated/type/paging';
import { SearchResponse } from '../interface/search.interface';
import { getSearchAPIQueryParams } from '../utils/SearchUtils';
import { escapeESReservedCharacters } from '../utils/StringsUtils';
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

export const getVersion = async () => {
  const response = await APIClient.get<{ version: string }>('/system/version');

  return response.data;
};

export const postSamlLogout = async () => {
  const response = await APIClient.get(`/saml/logout`);

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

export const getUserAndTeamSearch = (
  term: string,
  userOnly = false,
  size = PAGE_SIZE
) => {
  return searchData(
    term ?? '',
    1,
    size,
    '',
    '',
    '',
    userOnly ? SearchIndex.USER : [SearchIndex.USER, SearchIndex.TEAM]
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

  return APIClient.delete<{ version?: number }>(`/${entityType}/${entityId}`, {
    params,
  });
};

export const deleteAsyncEntity = async (
  entityType: string,
  entityId: string,
  isRecursive: boolean,
  isHardDelete = true
) => {
  const params = {
    hardDelete: isHardDelete,
    recursive: isRecursive,
  };

  const response = await APIClient.delete<AsyncDeleteJob>(
    `/${entityType}/async/${entityId}`,
    {
      params,
    }
  );

  return response.data;
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
  q: string,
  sourceFields?: string
) => {
  const withWildCardValue = value
    ? `.*${escapeESReservedCharacters(value)}.*`
    : '.*';
  const params = {
    index,
    field,
    value: withWildCardValue,
    q,
    sourceFields,
  };

  return APIClient.get<SearchResponse<ExploreSearchIndex>>(
    `/search/aggregate`,
    {
      params,
    }
  );
};

/**
 * Posts aggregate field options request with parameters in the body.
 *
 * @param {SearchIndex | SearchIndex[]} index - The search index or array of search indexes.
 * @param {string} field - The field to aggregate on. Example owner.displayName.keyword
 * @param {string} value - The value to filter the aggregation on.
 * @param {string} q - The search query.
 * @return {Promise<SearchResponse<ExploreSearchIndex>>} A promise that resolves to the search response
 * containing the aggregate field options.
 */
export const postAggregateFieldOptions = (
  index: SearchIndex | SearchIndex[],
  field: string,
  value: string,
  q: string
) => {
  const withWildCardValue = value
    ? `.*${escapeESReservedCharacters(value)}.*`
    : '.*';
  const body: SearchRequest = {
    index: index as string,
    fieldName: field,
    fieldValue: withWildCardValue,
    query: q,
  };

  return APIClient.post<SearchResponse<ExploreSearchIndex>>(
    `/search/aggregate`,
    body
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

export const fetchOMStatus = async () => {
  const response = await APIClient.get<ValidationResponse>('/system/status');

  return response.data;
};

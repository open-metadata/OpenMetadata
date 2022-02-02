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
import { Edge } from '../components/EntityLineage/EntityLineage.interface';
import { SearchIndex } from '../enums/search.enum';
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

export const fetchAuthorizerConfig: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/auth');
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

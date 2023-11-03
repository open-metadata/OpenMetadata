/*
 *  Copyright 2023 Collate.
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
import { PagingResponse, PagingWithoutTotal, RestoreRequestType } from 'Models';
import {
  EntityReference,
  SearchIndex,
} from '../generated/entity/data/searchIndex';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { ServicePageData } from '../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getSearchIndexes = async (args: {
  service: string;
  fields: string;
  paging?: PagingWithoutTotal;
  root?: boolean;
  include: Include;
}) => {
  const { paging, ...rest } = args;

  const response = await APIClient.get<PagingResponse<ServicePageData[]>>(
    `/searchIndexes`,
    {
      params: {
        ...rest,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getSearchIndexDetailsByFQN = async (
  fqn: string,
  arrQueryFields: string | string[],
  include = Include.All
) => {
  const url = getURLWithQueryFields(
    `/searchIndexes/name/${fqn}`,
    arrQueryFields,
    `include=${include}`
  );

  const response = await APIClient.get<SearchIndex>(url);

  return response.data;
};

export const patchSearchIndexDetails = async (
  id: string,
  data: Operation[]
) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<SearchIndex>
  >(`/searchIndexes/${id}`, data, configOptions);

  return response.data;
};

export const restoreSearchIndex = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<SearchIndex>
  >('/searchIndexes/restore', { id });

  return response.data;
};

export const addFollower = async (searchIndexId: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`/searchIndexes/${searchIndexId}/followers`, userId, configOptions);

  return response.data;
};

export const removeFollower = async (searchIndexId: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`/searchIndexes/${searchIndexId}/followers/${userId}`, configOptions);

  return response.data;
};

export const getSampleDataBySearchIndexId = async (id: string) => {
  const response = await APIClient.get<SearchIndex>(
    `/searchIndexes/${id}/sampleData`
  );

  return response.data;
};

export const getSearchIndexVersions = async (id: string) => {
  const url = `/searchIndexes/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getSearchIndexVersion = async (id: string, version: string) => {
  const url = `/searchIndexes/${id}/versions/${version}`;

  const response = await APIClient.get<SearchIndex>(url);

  return response.data;
};

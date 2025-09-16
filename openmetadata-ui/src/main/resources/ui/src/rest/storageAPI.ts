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
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { Container } from '../generated/entity/data/container';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { ListParams, ListParamsWithOffset } from '../interface/API.interface';
import { ServicePageData } from '../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

const BASE_URL = '/containers';

export const getContainers = async (args: {
  service: string;
  fields: string;
  paging?: PagingWithoutTotal;
  root?: boolean;
  include: Include;
}) => {
  const { paging, ...rest } = args;

  const response = await APIClient.get<{
    data: ServicePageData[];
    paging: Paging;
  }>(`${BASE_URL}`, {
    params: {
      ...rest,
      ...paging,
    },
  });

  return response.data;
};

export const getContainerByName = async (name: string, params?: ListParams) => {
  const response = await APIClient.get<Container>(
    `${BASE_URL}/name/${getEncodedFqn(name)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.All,
      },
    }
  );

  return response.data;
};

export const getContainerChildrenByName = async (
  name: string,
  params?: ListParamsWithOffset
) => {
  const response = await APIClient.get<PagingResponse<Container['children']>>(
    `${BASE_URL}/name/${getEncodedFqn(name)}/children`,
    {
      params,
    }
  );

  return response.data;
};

export const patchContainerDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Container>>(
    `${BASE_URL}/${id}`,
    data
  );

  return response.data;
};

export const addContainerFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(
    `${BASE_URL}/${id}/followers`,
    userId,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const restoreContainer = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Container>
  >(`${BASE_URL}/restore`, { id });

  return response.data;
};

export const removeContainerFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(
    `${BASE_URL}/${id}/followers/${userId}`,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const getContainerVersions = async (id: string) => {
  const url = `${BASE_URL}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getContainerVersion = async (id: string, version?: string) => {
  const url = `${BASE_URL}/${id}/versions/${version}`;

  const response = await APIClient.get<Container>(url);

  return response.data;
};

export const getContainerByFQN = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<Container>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: { ...params, include: params?.include ?? Include.All },
    }
  );

  return response.data;
};

export const updateContainerVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<Container>>(
    `${BASE_URL}/${id}/vote`,
    data
  );

  return response.data;
};

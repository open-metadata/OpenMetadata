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
import { PagingWithoutTotal, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/TableQueries/TableQueries.interface';
import { Container } from '../generated/entity/data/container';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { ServicePageData } from '../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

const configOptionsForPatch = {
  headers: { 'Content-type': 'application/json-patch+json' },
};

const configOptions = {
  headers: { 'Content-type': 'application/json' },
};

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

export const getContainerByName = async (
  name: string,
  fields: string | string[],
  include: Include = Include.All
) => {
  const response = await APIClient.get<Container>(
    `${BASE_URL}/name/${name}?fields=${fields}`,
    {
      params: {
        include,
      },
    }
  );

  return response.data;
};

export const patchContainerDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Container>>(
    `${BASE_URL}/${id}`,
    data,
    configOptionsForPatch
  );

  return response.data;
};

export const addContainerFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${BASE_URL}/${id}/followers`, userId, configOptions);

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
  >(`${BASE_URL}/${id}/followers/${userId}`, configOptions);

  return response.data;
};

export const getContainerVersions = async (id: string) => {
  const url = `${BASE_URL}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getContainerVersion = async (id: string, version: string) => {
  const url = `${BASE_URL}/${id}/versions/${version}`;

  const response = await APIClient.get<Container>(url);

  return response.data;
};

export const getContainerByFQN = async (
  fqn: string,
  arrQueryFields: string | string[],
  include = 'all'
) => {
  const url = getURLWithQueryFields(
    `${BASE_URL}/name/${fqn}`,
    arrQueryFields,
    `include=${include}`
  );

  const response = await APIClient.get<Container>(url);

  return response.data;
};

export const updateContainerVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<Container>>(
    `${BASE_URL}/${id}/vote`,
    data
  );

  return response.data;
};

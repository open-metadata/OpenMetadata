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
import { PagingResponse, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import { ServicePageData } from '../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export interface ListStoredProcedureParams {
  databaseSchema?: string;
  fields?: string;
  after?: string;
  before?: string;
  include?: Include;
  limit?: number;
}

const URL = '/storedProcedures';

export const getStoredProceduresList = async (
  params?: ListStoredProcedureParams
) => {
  const response = await APIClient.get<PagingResponse<ServicePageData[]>>(URL, {
    params,
  });

  return response.data;
};

export const getStoredProceduresByFqn = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<StoredProcedure>(
    `${URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.NonDeleted,
      },
    }
  );

  return response.data;
};

export const patchStoredProceduresDetails = async (
  id: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<StoredProcedure>
  >(`${URL}/${id}`, data);

  return response.data;
};

export const addStoredProceduresFollower = async (
  id: string,
  userId: string
) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${URL}/${id}/followers`, userId, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const removeStoredProceduresFollower = async (
  id: string,
  userId: string
) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`${URL}/${id}/followers/${userId}`, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const getStoredProceduresVersionsList = async (id: string) => {
  const url = `${URL}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getStoredProceduresVersion = async (
  id: string,
  version?: string
) => {
  const url = `${URL}/${id}/versions/${version}`;

  const response = await APIClient.get<StoredProcedure>(url);

  return response.data;
};

export const restoreStoredProcedures = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<StoredProcedure>
  >(`${URL}/restore`, { id });

  return response.data;
};

export const updateStoredProcedureVotes = async (
  id: string,
  data: QueryVote
) => {
  const response = await APIClient.put<
    QueryVote,
    AxiosResponse<StoredProcedure>
  >(`${URL}/${id}/vote`, data);

  return response.data;
};

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
import { Operation } from 'fast-json-patch';
import { isNil } from 'lodash';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { EntityReference } from '../generated/type/entityReference';
import { Paging } from '../generated/type/paging';
import { ServicePageData } from '../pages/service';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getMlModelByFQN = async (fqn: string, arrQueryFields: string) => {
  const url = getURLWithQueryFields(`mlmodels/name/${fqn}`, arrQueryFields);

  const response = await APIClient.get<Mlmodel>(url);

  return response.data;
};

export const getMlmodels = async (
  serviceName: string,
  paging: string,
  arrQueryFields: string[]
) => {
  const url = `${getURLWithQueryFields(
    `/mlmodels`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  const response = await APIClient.get<{
    data: ServicePageData[];
    paging: Paging;
  }>(url);

  return response.data;
};

export const getAllMlModal = async (
  paging: string,
  arrQueryFields: string,
  limit?: number
) => {
  const searchParams = new URLSearchParams();

  if (!isNil(limit)) {
    searchParams.set('limit', `${limit}`);
  }

  const url = getURLWithQueryFields(
    `/mlmodels`,
    arrQueryFields,
    `${searchParams.toString()}${paging ? `&${paging}` : ''}`
  );

  const response = await APIClient.get<{ data: Mlmodel; paging: Paging }>(url);

  return response.data;
};

export const patchMlModelDetails = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Mlmodel>>(
    `/mlmodels/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const addFollower = async (mlModelId: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`/mlmodels/${mlModelId}/followers`, userId, configOptions);

  return response.data;
};

export const removeFollower = async (mlModelId: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`/mlmodels/${mlModelId}/followers/${userId}`, configOptions);

  return response.data;
};

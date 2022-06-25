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
import { isNil } from 'lodash';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getMlModelByFQN: Function = (
  fqn: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`mlmodels/name/${fqn}`, arrQueryFields);

  return APIClient.get(url);
};

export const getMlmodels = (
  serviceName: string,
  paging: string,
  arrQueryFields: string[]
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/mlmodels`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const getAllMlModal = (
  paging: string,
  arrQueryFields: string,
  limit?: number
): Promise<AxiosResponse> => {
  const searchParams = new URLSearchParams();

  if (!isNil(limit)) {
    searchParams.set('limit', `${limit}`);
  }

  const url = getURLWithQueryFields(
    `/mlmodels`,
    arrQueryFields,
    `${searchParams.toString()}${paging ? `&${paging}` : ''}`
  );

  return APIClient.get(url);
};

export const patchMlModelDetails: Function = (
  id: string,
  data: Mlmodel
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/mlmodels/${id}`, data, configOptions);
};

export const addFollower: Function = (
  mlModelId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.put(
    `/mlmodels/${mlModelId}/followers`,
    userId,
    configOptions
  );
};

export const removeFollower: Function = (
  mlModelId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.delete(
    `/mlmodels/${mlModelId}/followers/${userId}`,
    configOptions
  );
};

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
import { Dbtmodel } from '../generated/entity/data/dbtmodel';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getDBTModelDetails: Function = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/dbtmodels/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const getDBTModelDetailsByFQN: Function = (
  fqn: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/dbtmodels/name/${fqn}`, arrQueryFields);

  return APIClient.get(url);
};

export const getDatabaseDBTModels: Function = (
  databaseName: string,
  paging: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/dbtmodels`,
    arrQueryFields
  )}&database=${databaseName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const patchDBTModelDetails: Function = (
  id: string,
  data: Dbtmodel
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/dbtmodels/${id}`, data, configOptions);
};

export const addFollower: Function = (
  dbtModelId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.put(
    `/dbtmodels/${dbtModelId}/followers`,
    userId,
    configOptions
  );
};

export const removeFollower: Function = (
  dbtModelId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.delete(
    `/dbtmodels/${dbtModelId}/followers/${userId}`,
    configOptions
  );
};

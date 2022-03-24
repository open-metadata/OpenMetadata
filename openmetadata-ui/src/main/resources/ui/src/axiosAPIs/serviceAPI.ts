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
import { ServiceOption } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getServiceDetails: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/services/');
};

export const getServices: Function = (
  serviceName: string,
  limit?: number
): Promise<AxiosResponse> => {
  let url = `/services/${serviceName}`;
  const searchParams = new URLSearchParams();

  if (!isNil(limit)) {
    searchParams.set('limit', `${limit}`);
  }

  const strSearchParams = searchParams.toString();
  url += strSearchParams ? `?${strSearchParams}` : '';

  return APIClient.get(url);
};

export const getServiceById: Function = (
  serviceName: string,
  id: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/services/${serviceName}/${id}`);
};

export const getServiceByFQN: Function = (
  serviceName: string,
  fqn: string,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/services/${serviceName}/name/${fqn}`,
    arrQueryFields
  );

  return APIClient.get(url);
};

export const postService: Function = (
  serviceName: string,
  options: ServiceOption
): Promise<AxiosResponse> => {
  return APIClient.post(`/services/${serviceName}`, options);
};

export const updateService: Function = (
  serviceName: string,
  _id: string,
  options: ServiceOption
): Promise<AxiosResponse> => {
  return APIClient.put(`/services/${serviceName}`, options);
};

export const deleteService: Function = (
  serviceName: string,
  id: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/services/${serviceName}/${id}`);
};

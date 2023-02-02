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
import { isNil } from 'lodash';
import { ServiceData, ServicesData, ServicesUpdateRequest } from 'Models';
import {
  ConfigData,
  ServiceResponse,
  ServicesType,
} from '../interface/service.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getServiceDetails = async (): Promise<
  AxiosResponse<ServiceData[]>
> => {
  const response = await APIClient.get('/services/');

  return response.data;
};

export const getServices = async (serviceName: string, limit?: number) => {
  let url = `/services/${serviceName}`;
  const searchParams = new URLSearchParams();

  if (!isNil(limit)) {
    searchParams.append('limit', `${limit}`);
  }

  const isPaging =
    serviceName.includes('after') || serviceName.includes('before');

  url += isPaging ? `&${searchParams}` : `?${searchParams}`;

  const response = await APIClient.get<ServiceResponse>(url);

  return response.data;
};

export const getServiceById = async (serviceName: string, id: string) => {
  const response = await APIClient.get<ServicesData>(
    `/services/${serviceName}/${id}`
  );

  return response.data;
};

export const getServiceByFQN = async (
  serviceCat: string,
  fqn: string,
  arrQueryFields: string | string[] = ''
) => {
  const url = getURLWithQueryFields(
    `/services/${serviceCat}/name/${fqn}`,
    arrQueryFields
  );

  const response = await APIClient.get<ServicesType>(url);

  return response.data;
};

export const postService = async (
  serviceCat: string,
  options: ServicesUpdateRequest
) => {
  const response = await APIClient.post<
    ServicesUpdateRequest,
    AxiosResponse<ServiceData>
  >(`/services/${serviceCat}`, options);

  return response.data;
};

export const updateService = async (
  serviceCat: string,
  _id: string,
  options: ServicesUpdateRequest
) => {
  const response = await APIClient.put<
    ServicesUpdateRequest,
    AxiosResponse<ServicesType>
  >(`/services/${serviceCat}`, options);

  return response.data;
};

export const deleteService = (
  serviceCat: string,
  id: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/services/${serviceCat}/${id}`);
};

export const TestConnection = (
  data: ConfigData,
  type: string
): Promise<AxiosResponse> => {
  const payload = {
    connection: { config: data },
    connectionType: type,
  };

  return APIClient.post(`/services/ingestionPipelines/testConnection`, payload);
};

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
import { RestoreRequestType, ServicesUpdateRequest } from 'Models';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import {
  APPLICATION_JSON_CONTENT_TYPE_HEADER,
  PAGE_SIZE,
} from '../constants/constants';
import { TabSpecificField } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { EntityReference } from '../generated/entity/type';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import {
  DomainSupportedServiceTypes,
  ServiceResponse,
  ServicesType,
} from '../interface/service.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';
import { searchData } from './miscAPI';

interface ServiceRequestParams {
  limit?: number;
  serviceName: string;
  after?: string;
  before?: string;
  include?: Include;
}

export const getServices = async ({
  serviceName,
  limit,
  after,
  before,
  include = Include.NonDeleted,
}: ServiceRequestParams) => {
  const url = `/services/${serviceName}`;

  const params = {
    fields: TabSpecificField.OWNERS,
    limit,
    after,
    before,
    include,
  };

  const response = await APIClient.get<ServiceResponse>(url, { params });

  return response.data;
};

export const getServiceByFQN = async (
  serviceCat: string,
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<ServicesType>(
    `/services/${serviceCat}/name/${getEncodedFqn(fqn)}`,
    { params: { ...params, include: params?.include ?? Include.NonDeleted } }
  );

  return response.data;
};

export const getDomainSupportedServiceByFQN = async (
  serviceCat: string,
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<DomainSupportedServiceTypes>(
    `/services/${serviceCat}/name/${getEncodedFqn(fqn)}`,
    { params }
  );

  return response.data;
};

export const postService = async (
  serviceCat: string,
  options: ServicesUpdateRequest
) => {
  const response = await APIClient.post<
    ServicesUpdateRequest,
    AxiosResponse<ServicesType>
  >(`/services/${serviceCat}`, options);

  return response.data;
};

export const addServiceFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(
    `/services/databaseServices/${id}/followers`,
    userId,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const removeServiceFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(
    `/services/databaseServices/${id}/followers/${userId}`,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};
export const patchService = async (
  serviceCat: string,
  id: string,
  options: ServicesUpdateRequest
) => {
  const response = await APIClient.patch<
    ServicesUpdateRequest,
    AxiosResponse<ServicesType>
  >(`/services/${serviceCat}/${id}`, options);

  return response.data;
};

export const patchDomainSupportedService = async (
  serviceCat: string,
  id: string,
  options: ServicesUpdateRequest
) => {
  const response = await APIClient.patch<
    ServicesUpdateRequest,
    AxiosResponse<DomainSupportedServiceTypes>
  >(`/services/${serviceCat}/${id}`, options);

  return response.data;
};

export const getServiceVersions = async (
  serviceCategory: string,
  id: string
) => {
  const url = `/services/${serviceCategory}/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getServiceVersionData = async (
  serviceCategory: string,
  id: string,
  version: string
) => {
  const url = `/services/${serviceCategory}/${id}/versions/${version}`;

  const response = await APIClient.get<ServicesType>(url);

  return response.data;
};

export const searchService = async ({
  search,
  searchIndex,
  currentPage = 1,
  limit = PAGE_SIZE,
  filters,
  deleted = false,
}: {
  search?: string;
  searchIndex: SearchIndex | SearchIndex[];
  limit?: number;
  currentPage?: number;
  filters?: string;
  deleted?: boolean;
}) => {
  const response = await searchData(
    search ?? WILD_CARD_CHAR,
    currentPage,
    limit,
    filters ?? '',
    '',
    '',
    searchIndex,
    deleted
  );

  return response.data;
};

export const restoreService = async (serviceCategory: string, id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<ServicesType>
  >(`/services/${serviceCategory}/restore`, {
    id,
  });

  return response.data;
};

export const exportDatabaseServiceDetailsInCSV = async (
  fqn: string,
  params?: {
    recursive?: boolean;
  }
) => {
  const res = await APIClient.get(
    `services/databaseServices/name/${getEncodedFqn(fqn)}/exportAsync`,
    {
      params,
    }
  );

  return res.data;
};

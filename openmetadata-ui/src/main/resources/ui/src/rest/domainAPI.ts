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
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import { CreateDomain } from '../generated/api/domains/createDomain';
import { Domain } from '../generated/entity/domains/domain';
import { EntityHistory } from '../generated/type/entityHistory';
import { ListParams } from '../interface/API.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

const BASE_URL = '/domains';

export const getDomainList = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<Domain[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const addDomains = async (data: CreateDomain) => {
  const response = await APIClient.post<CreateDomain, AxiosResponse<Domain>>(
    BASE_URL,
    data
  );

  return response.data;
};

export const patchDomains = async (id: string, patch: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Domain>>(
    `/domains/${id}`,
    patch,
    configOptions
  );

  return response.data;
};

export const getDomainByName = async (
  domainName: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `/domains/name/${domainName}`,
    arrQueryFields
  );

  const response = await APIClient.get<Domain>(url);

  return response.data;
};

export const getDomainVersionsList = async (id: string) => {
  const url = `${BASE_URL}/${id}/versions`;
  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getDomainVersionData = async (id: string, version: string) => {
  const url = `${BASE_URL}/${id}/versions/${version}`;
  const response = await APIClient.get<Domain>(url);

  return response.data;
};

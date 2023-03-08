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
import { Container } from 'generated/entity/data/container';
import { Paging } from 'generated/type/paging';
import { ServicePageData } from 'pages/service';
import { getURLWithQueryFields } from 'utils/APIUtils';
import APIClient from './index';

export const getContainers = async (
  serviceName: string,
  arrQueryFields: string | string[],
  paging?: string
) => {
  const url = `${getURLWithQueryFields(
    `/containers`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  const response = await APIClient.get<{
    data: ServicePageData[];
    paging: Paging;
  }>(url);

  return response.data;
};

export const getContainerByName = async (name: string, fields: string) => {
  const response = await APIClient.get<Container>(
    `containers/name/${name}?fields=${fields}`
  );

  return response.data;
};

export const patchContainerDetails = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Container>>(
    `/containers/${id}`,
    data,
    configOptions
  );

  return response.data;
};

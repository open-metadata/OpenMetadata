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
import { IngestionData } from '../components/Ingestion/ingestion.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

const operationsBaseUrl = '/api/operations/v1';

export const addIngestionWorkflow = (
  data: IngestionData
): Promise<AxiosResponse> => {
  const url = '/ingestion';

  return APIClient({
    method: 'post',
    url,
    baseURL: operationsBaseUrl,
    data: data,
  });
};

export const getIngestionWorkflows = (
  arrQueryFields: Array<string>,
  paging?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields('/ingestion', arrQueryFields)}${
    paging ? paging : ''
  }`;

  return APIClient({ method: 'get', url, baseURL: operationsBaseUrl });
};

export const triggerIngestionWorkflowsById = (
  id: string,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/ingestion/trigger/${id}`, arrQueryFields);

  return APIClient({ method: 'post', url, baseURL: operationsBaseUrl });
};

export const deleteIngestionWorkflowsById = (
  id: string,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/ingestion/${id}`, arrQueryFields);

  return APIClient({ method: 'delete', url, baseURL: operationsBaseUrl });
};
export const updateIngestionWorkflow = (
  data: IngestionData
): Promise<AxiosResponse> => {
  const url = `/ingestion/`;

  return APIClient({
    method: 'put',
    url,
    baseURL: operationsBaseUrl,
    data: data,
  });
};

export const patchIngestionWorkflowBtId = (
  id: string,
  data: Array<Operation>
): Promise<AxiosResponse> => {
  const url = `/ingestion/${id}`;

  return APIClient({
    method: 'patch',
    url,
    baseURL: operationsBaseUrl,
    data: data,
    headers: { 'Content-type': 'application/json-patch+json' },
  });
};

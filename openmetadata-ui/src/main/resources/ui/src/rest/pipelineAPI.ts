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
import { PagingResponse, PagingWithoutTotal, RestoreRequestType } from 'Models';
import { ServicePageData } from 'pages/service';
import { Pipeline, PipelineStatus } from '../generated/entity/data/pipeline';
import { EntityHistory } from '../generated/type/entityHistory';
import { EntityReference } from '../generated/type/entityReference';
import { Paging } from '../generated/type/paging';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';
import { ListTestCaseResultsParams } from './testAPI';

export const getPipelineVersions = async (id: string) => {
  const url = `/pipelines/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};
export const getPipelineVersion = async (id: string, version: string) => {
  const url = `/pipelines/${id}/versions/${version}`;

  const response = await APIClient.get<Pipeline>(url);

  return response.data;
};

export const getPipelines = async (
  service: string,
  fields: string,
  paging?: PagingWithoutTotal
) => {
  const response = await APIClient.get<{
    data: ServicePageData[];
    paging: Paging;
  }>(`/pipelines`, {
    params: { service, fields, after: paging?.after, before: paging?.before },
  });

  return response.data;
};

export const getPipelineDetails = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/pipelines/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const getPipelineByFqn = async (
  fqn: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `/pipelines/name/${fqn}`,
    arrQueryFields,
    'include=all'
  );

  const response = await APIClient.get<Pipeline>(url);

  return response.data;
};

export const addFollower = async (pipelineID: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`/pipelines/${pipelineID}/followers`, userId, configOptions);

  return response.data;
};

export const removeFollower = async (pipelineID: string, userId: string) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`/pipelines/${pipelineID}/followers/${userId}`, configOptions);

  return response.data;
};

export const patchPipelineDetails = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Pipeline>>(
    `/pipelines/${id}`,
    data,
    configOptions
  );

  return response.data;
};

export const getPipelineStatus = async (
  fqn: string,
  params?: ListTestCaseResultsParams
) => {
  const url = `/pipelines/${fqn}/status`;

  const response = await APIClient.get<PagingResponse<Array<PipelineStatus>>>(
    url,
    { params }
  );

  return response.data;
};

export const restorePipeline = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Pipeline>
  >('/pipelines/restore', {
    id,
  });

  return response.data;
};

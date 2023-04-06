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
import { IngestionPipelineLogByIdInterface } from 'pages/LogsViewer/LogsViewer.interfaces';
import { CreateIngestionPipeline } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../generated/type/paging';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const addIngestionPipeline = async (data: CreateIngestionPipeline) => {
  const response = await APIClient.post<
    CreateIngestionPipeline,
    AxiosResponse<IngestionPipeline>
  >('/services/ingestionPipelines', data);

  return response.data;
};

export const getIngestionPipelineByFqn = async (
  fqn: string,
  arrQueryFields?: Array<string>
) => {
  const url = getURLWithQueryFields(
    `/services/ingestionPipelines/name/${fqn}`,
    arrQueryFields
  );

  const response = await APIClient.get<IngestionPipeline>(url);

  return response.data;
};

/**
 * "Get an ingestion pipeline by its fully qualified name."
 *
 * The function takes two parameters:
 *
 * * `fqn`: The fully qualified name of the ingestion pipeline.
 * * `arrQueryFields`: An array of query fields to include in the response
 * @param {string} fqn - The fully qualified name of the ingestion pipeline.
 * @param [arrQueryFields] - An array of strings that represent the query fields you want to include in
 * the request.
 * @returns IngestionPipeline
 */
export const getIngestionPipelineByName = async (
  fqn: string,
  arrQueryFields?: Array<string>
) => {
  const url = getURLWithQueryFields(
    `/services/ingestionPipelines/name/${fqn}`,
    arrQueryFields
  );

  const response = await APIClient.get<IngestionPipeline>(url);

  return response.data;
};

export const getIngestionPipelines = async (
  arrQueryFields: Array<string>,
  serviceFilter?: string,
  paging?: string
) => {
  const service = serviceFilter ? `service=${serviceFilter}` : '';
  const url = `${getURLWithQueryFields(
    '/services/ingestionPipelines',
    arrQueryFields,
    service
  )}${paging ? paging : ''}`;

  const response = await APIClient.get<{
    data: IngestionPipeline[];
    paging: Paging;
  }>(url);

  return response.data;
};

export const triggerIngestionPipelineById = async (id: string) => {
  const response = await APIClient.post<
    unknown,
    AxiosResponse<IngestionPipeline>
  >(`/services/ingestionPipelines/trigger/${id}`);

  return response.data;
};

export const deployIngestionPipelineById = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.post(`/services/ingestionPipelines/deploy/${id}`);
};

export const enableDisableIngestionPipelineById = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.post(`/services/ingestionPipelines/toggleIngestion/${id}`);
};

export const deleteIngestionPipelineById = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/services/ingestionPipelines/${id}?hardDelete=true`);
};

export const updateIngestionPipeline = async (
  data: CreateIngestionPipeline
) => {
  const response = await APIClient.put<
    CreateIngestionPipeline,
    AxiosResponse<IngestionPipeline>
  >(`/services/ingestionPipelines`, data);

  return response.data;
};

export const patchIngestionPipeline = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<IngestionPipeline>
  >(`/services/ingestionPipelines/${id}`, data, configOptions);

  return response.data;
};

export const checkAirflowStatus = (): Promise<AxiosResponse> => {
  return APIClient.get('/services/ingestionPipelines/status');
};

export const getPipelineServiceHostIp = async () => {
  const response = await APIClient.get<{ ip?: string }>(
    '/services/ingestionPipelines/ip'
  );

  return response;
};

export const getIngestionPipelineLogById = (id: string, after?: string) => {
  return APIClient.get<IngestionPipelineLogByIdInterface>(
    `/services/ingestionPipelines/logs/${id}/last`,
    {
      params: {
        after,
      },
    }
  );
};

export const postKillIngestionPipelineById = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.post(`/services/ingestionPipelines/kill/${id}`);
};

export const getRunHistoryForPipeline = async (
  id: string,
  params: { startTs: number; endTs: number }
) => {
  const response = await APIClient.get<PagingResponse<PipelineStatus[]>>(
    `/services/ingestionPipelines/${id}/pipelineStatus`,
    {
      params,
    }
  );

  return response.data;
};

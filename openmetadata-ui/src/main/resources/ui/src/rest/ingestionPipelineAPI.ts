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
import {
  CreateIngestionPipeline,
  PipelineType,
} from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  PipelineStatus,
  ProviderType,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { PipelineServiceClientResponse } from '../generated/entity/services/ingestionPipelines/pipelineServiceClientResponse';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import { IngestionPipelineLogByIdInterface } from '../pages/LogsViewerPage/LogsViewerPage.interfaces';
import { getEncodedFqn } from '../utils/StringsUtils';
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
  params?: ListParams
) => {
  const response = await APIClient.get<IngestionPipeline>(
    `/services/ingestionPipelines/name/${getEncodedFqn(fqn)}`,
    { params }
  );

  return response.data;
};

export const getIngestionPipelines = async (data: {
  arrQueryFields: Array<string>;
  serviceFilter?: string;
  paging?: Omit<Paging, 'total'>;
  pipelineType?: PipelineType[];
  provider?: ProviderType;
  testSuite?: string;
  serviceType?: string;
  limit?: number;
  applicationType?: PipelineType;
}) => {
  const { arrQueryFields, serviceFilter, paging, pipelineType, ...rest } = data;

  const params = {
    fields: arrQueryFields.join(','),
    service: serviceFilter,
    pipelineType: pipelineType?.length ? pipelineType.join(',') : undefined,
    ...paging,
    ...rest,
  };

  const response = await APIClient.get<{
    data: IngestionPipeline[];
    paging: Paging;
  }>(`/services/ingestionPipelines`, { params });

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

export const enableDisableIngestionPipelineById = (id: string) => {
  return APIClient.post<unknown, AxiosResponse<IngestionPipeline>>(
    `/services/ingestionPipelines/toggleIngestion/${id}`
  );
};

export const deleteIngestionPipelineById = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/services/ingestionPipelines/${id}?hardDelete=true`);
};

export const updateIngestionPipeline = async (
  id: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<IngestionPipeline>
  >(`/services/ingestionPipelines/${id}`, data);

  return response.data;
};

export const getAirflowStatus = async () => {
  const response = await APIClient.get<PipelineServiceClientResponse>(
    '/services/ingestionPipelines/status'
  );

  return response.data;
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
  fqn: string,
  params: { startTs: number; endTs: number }
) => {
  const response = await APIClient.get<PagingResponse<PipelineStatus[]>>(
    `/services/ingestionPipelines/${getEncodedFqn(fqn)}/pipelineStatus`,
    {
      params,
    }
  );

  return response.data;
};

export const downloadIngestionPipelineLogsById = (id: string) => {
  return APIClient.get(
    `/services/ingestionPipelines/logs/${id}/last/download`,
    {
      responseType: 'blob',
    }
  );
};

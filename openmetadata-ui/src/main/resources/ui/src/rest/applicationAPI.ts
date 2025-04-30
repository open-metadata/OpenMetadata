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
import { PagingResponse, RestoreRequestType } from 'Models';
import { DataInsightLatestRun } from '../components/Settings/Applications/AppDetails/AppDetails.interface';
import { AgentType, App } from '../generated/entity/applications/app';
import { AppRunRecord } from '../generated/entity/applications/appRunRecord';
import { CreateAppRequest } from '../generated/entity/applications/createAppRequest';
import { PipelineStatus } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EntityReference } from '../generated/entity/type';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

const BASE_URL = '/apps';

type AppListParams = ListParams & {
  agentType?: AgentType;
  offset?: number;
  startTs?: number;
  endTs?: number;
};

export const getApplicationList = async (params?: AppListParams) => {
  const response = await APIClient.get<PagingResponse<App[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const getInstalledApplicationList = async () => {
  const response = await APIClient.get<EntityReference[]>(
    `${BASE_URL}/installed`
  );

  return response.data;
};

export const installApplication = (
  data: CreateAppRequest
): Promise<AxiosResponse> => {
  return APIClient.post(`${BASE_URL}`, data);
};

export const getApplicationByName = async (
  appName: string,
  params?: AppListParams
) => {
  const response = await APIClient.get<App>(
    `${BASE_URL}/name/${getEncodedFqn(appName)}`,
    {
      params,
    }
  );

  return response.data;
};

export const getApplicationRuns = async (
  appName: string,
  params?: AppListParams
) => {
  const response = await APIClient.get<PagingResponse<AppRunRecord[]>>(
    `${BASE_URL}/name/${getEncodedFqn(appName)}/status`,
    {
      params,
    }
  );

  return response.data;
};

export const getExternalApplicationRuns = async (
  appName: string,
  params?: AppListParams
) => {
  const response = await APIClient.get<PagingResponse<PipelineStatus[]>>(
    `${BASE_URL}/name/${getEncodedFqn(appName)}/status`,
    {
      params,
    }
  );

  return response.data;
};

export const getLatestApplicationRuns = async (appName: string) => {
  const response = await APIClient.get<DataInsightLatestRun>(
    `${BASE_URL}/name/${getEncodedFqn(appName)}/logs`
  );

  return response.data;
};

export const uninstallApp = (appName: string, hardDelete = false) => {
  return APIClient.delete(`${BASE_URL}/name/${getEncodedFqn(appName)}`, {
    params: { hardDelete },
  });
};

export const patchApplication = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<App>>(
    `${BASE_URL}/${id}`,
    patch
  );

  return response.data;
};

export const triggerOnDemandApp = (
  appName: string,
  data?: Record<string, unknown>
): Promise<AxiosResponse> => {
  return APIClient.post(`${BASE_URL}/trigger/${getEncodedFqn(appName)}`, data);
};

export const deployApp = (appName: string): Promise<AxiosResponse> => {
  return APIClient.post(`${BASE_URL}/deploy/${getEncodedFqn(appName)}`);
};

export const configureApp = (
  appName: string,
  data: Record<string, unknown>
): Promise<AxiosResponse> => {
  return APIClient.post(
    `${BASE_URL}/configure/${getEncodedFqn(appName)}`,
    data
  );
};

export const restoreApp = async (id: string) => {
  const response = await APIClient.put<RestoreRequestType, AxiosResponse<App>>(
    `${BASE_URL}/restore`,
    { id }
  );

  return response.data;
};

export const stopApp = async (name: string) => {
  return await APIClient.post(`${BASE_URL}/stop/${getEncodedFqn(name)}`);
};

export const getApplicationLogs = (appName: string, after?: string) => {
  return APIClient.get(`${BASE_URL}/name/${appName}/logs`, {
    params: {
      after,
    },
  });
};

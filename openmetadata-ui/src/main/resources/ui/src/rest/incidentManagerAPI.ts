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
import { PagingResponse } from 'Models';
import { CreateTestCaseResolutionStatus } from '../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseResolutionStatus } from '../generated/tests/testCaseResolutionStatus';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

const testCaseIncidentUrl = '/dataQuality/testCases/testCaseIncidentStatus';

export type TestCaseIncidentStatusParams = ListParams & {
  startTs: number;
  endTs: number;
  latest?: boolean;
  testCaseResolutionStatusType?: string;
  assignee?: string;
  testCaseFQN?: string;
  offset?: string;
  originEntityFQN?: string;
};

export const getListTestCaseIncidentStatus = async ({
  limit = 10,
  ...params
}: TestCaseIncidentStatusParams) => {
  const response = await APIClient.get<
    PagingResponse<TestCaseResolutionStatus[]>
  >(testCaseIncidentUrl, {
    params: { ...params, limit },
  });

  return response.data;
};

export const getListTestCaseIncidentByStateId = async (
  stateId: string,
  params?: ListParams
) => {
  const response = await APIClient.get<
    PagingResponse<TestCaseResolutionStatus[]>
  >(`${testCaseIncidentUrl}/stateId/${stateId}`, { params });

  return response.data;
};

export const updateTestCaseIncidentById = async (
  id: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<TestCaseResolutionStatus>
  >(`${testCaseIncidentUrl}/${id}`, data);

  return response.data;
};

export const postTestCaseIncidentStatus = async (
  data: CreateTestCaseResolutionStatus
) => {
  const response = await APIClient.post<
    CreateTestCaseResolutionStatus,
    AxiosResponse<TestCaseResolutionStatus>
  >(testCaseIncidentUrl, data);

  return response.data;
};

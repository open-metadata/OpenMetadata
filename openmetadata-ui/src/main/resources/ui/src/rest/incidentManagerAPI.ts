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
import { EntityReference } from '../generated/entity/data/table';
import { TestCaseResolutionStatus } from '../generated/tests/testCaseResolutionStatus';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';
import type { ListTasksParams, ResolveTask, Task } from './tasksAPI';
import { getTaskById, listTasks, resolveTask, TaskCategory } from './tasksAPI';

const testCaseIncidentUrl = '/dataQuality/testCases/testCaseIncidentStatus';

export enum IncidentSeverity {
  Severity1 = 'Severity1',
  Severity2 = 'Severity2',
  Severity3 = 'Severity3',
  Severity4 = 'Severity4',
  Severity5 = 'Severity5',
}

export interface TestCaseResolutionPayload {
  testCaseResolutionStatusId: string;
  testCaseResult?: EntityReference;
  severity?: IncidentSeverity;
  failureReason?: string;
  resolution?: string;
  rootCause?: string;
}

export interface IncidentTaskListParams
  extends Omit<ListTasksParams, 'category'> {
  assignee?: string;
  domain?: string;
}

export type TestCaseIncidentStatusParams = ListParams & {
  startTs?: number;
  endTs?: number;
  latest?: boolean;
  testCaseResolutionStatusType?: string;
  assignee?: string;
  testCaseFQN?: string;
  offset?: number;
  originEntityFQN?: string;
  domain?: string;
  sortField?: string;
  sortType?: 'asc' | 'desc';
  dateField?: 'timestamp' | 'updatedAt';
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

export const getListTestCaseIncidentStatusFromSearch = async ({
  limit = 10,
  offset = 0,
  ...params
}: TestCaseIncidentStatusParams) => {
  const response = await APIClient.get<
    PagingResponse<TestCaseResolutionStatus[]>
  >(`${testCaseIncidentUrl}/search/list`, {
    params: { ...params, limit, offset },
  });

  return response.data;
};

export const listIncidentTasks = async (params?: IncidentTaskListParams) => {
  return listTasks({
    ...params,
    category: TaskCategory.Incident,
    fields: params?.fields ?? 'payload,assignees,about',
  });
};

export const getIncidentTaskByStateId = async (
  stateId: string
): Promise<Task | null> => {
  // In task-first mode, the TCRS stateId equals the Task UUID (set by
  // IncidentTcrsSyncHandler on the backend). Fetch the task directly by id
  // instead of scanning all incident tasks and matching on payload — that
  // field doesn't exist in the new task system.
  try {
    const response = await getTaskById(stateId, {
      fields: 'payload,assignees,about',
    });

    return response.data;
  } catch {
    return null;
  }
};

/**
 * Drive an incident-task transition via the task-first workflow endpoint
 * (POST /api/v1/tasks/{id}/resolve). This replaces the legacy
 * postTestCaseIncidentStatus write path for any caller that has a task ID
 * (which, in task-first mode, equals the TCRS stateId — see
 * IncidentTcrsSyncHandler on the backend).
 */
export const transitionIncident = async (
  taskId: string,
  data: ResolveTask
): Promise<Task> => {
  return resolveTask(taskId, data);
};

export { TaskCategory } from './tasksAPI';
export type { ResolveTask, Task } from './tasksAPI';

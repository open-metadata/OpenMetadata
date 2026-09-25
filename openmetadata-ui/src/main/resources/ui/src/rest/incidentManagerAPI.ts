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
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../generated/tests/testCaseIncidentGroup';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../generated/tests/testCaseResolutionStatus';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import { ListParams } from '../interface/API.interface';
import APIClient from './axiosClient';
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

/**
 * Maximum number of entries the bulk endpoint accepts in a single call
 * (`TestCaseResolutionStatusResource.MAX_BULK_CREATE_SIZE`).
 */
export const MAX_BULK_INCIDENT_UPDATE_SIZE = 100;

/**
 * Transition ids the incident task accepts on `POST /tasks/{id}/resolve`. They
 * are the workflow's own edge names, not the resolution status the transition
 * produces, so they are spelled out once here rather than derived from
 * {@link TestCaseResolutionStatusTypes}.
 */
export const INCIDENT_TRANSITION_ID = {
  New: 'new',
  Ack: 'ack',
  Assign: 'assign',
  Reassign: 'reassign',
  Resolve: 'resolve',
} as const;

export type IncidentTransitionId =
  (typeof INCIDENT_TRANSITION_ID)[keyof typeof INCIDENT_TRANSITION_ID];

/**
 * Cursor returned by the server in `paging.before`/`paging.after`. It is opaque:
 * callers pass the value back verbatim as `offset` and never parse or compute
 * with it.
 */
export type IncidentCursor = string;

/**
 * Incident statuses a group can currently be in. `Resolved` is rejected by the
 * groups endpoint — groups only ever count open incidents.
 */
export type OpenIncidentStatus = Exclude<
  TestCaseResolutionStatusTypes,
  TestCaseResolutionStatusTypes.Resolved
>;

/** Incident timestamp the groups endpoint's `startTs`/`endTs` range applies to. */
export type IncidentDateField = 'createdAt' | 'updatedAt';

export type IncidentSortType = 'asc' | 'desc';

export type TestCaseIncidentStatusParams = ListParams & {
  startTs?: number;
  endTs?: number;
  latest?: boolean;
  testCaseResolutionStatusType?: string;
  assignee?: string;
  testCaseFQN?: string;
  /**
   * The cursor-paginated listing takes an opaque {@link IncidentCursor}; the
   * `/search/list` variant takes a numeric row offset.
   */
  offset?: number | IncidentCursor;
  originEntityFQN?: string;
  domain?: string;
  /** Test definition of the incident's test case, by name or FQN. */
  testDefinition?: string;
  /** Direct owner (user or team name) of the incident's test case. */
  owner?: string;
  sortField?: string;
  sortType?: IncidentSortType;
  dateField?: 'timestamp' | 'updatedAt';
};

export type ListIncidentGroupsParams = {
  /** Dimension to group the open incidents by. Required by the endpoint. */
  groupBy: IncidentGroupBy;
  /** Repeatable filter on the current open status of the incidents. */
  status?: OpenIncidentStatus[];
  assignee?: string;
  testCaseFQN?: string;
  domain?: string;
  dateField?: IncidentDateField;
  startTs?: number;
  endTs?: number;
  limit?: number;
  /** Opaque cursor from a previous `paging.before`/`paging.after`. */
  offset?: IncidentCursor;
  sortType?: IncidentSortType;
};

/**
 * Serialize repeatable query params as `status=New&status=Ack` rather than the
 * client-wide comma format, matching the endpoint's repeatable `status` param.
 */
const repeatableParamsSerializer = { indexes: null } as const;

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

/**
 * List the open incidents grouped by `table`, `testDefinition` or `owner`. The
 * matching individual incidents are listed by passing the group's dimension
 * value back to {@link getListTestCaseIncidentStatus} as `testDefinition`,
 * `owner` or `assignee`.
 */
export const listIncidentGroups = async ({
  limit = 10,
  ...params
}: ListIncidentGroupsParams) => {
  const response = await APIClient.get<PagingResponse<TestCaseIncidentGroup[]>>(
    `${testCaseIncidentUrl}/incidentGroups`,
    {
      params: { ...params, limit },
      paramsSerializer: repeatableParamsSerializer,
    }
  );

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

/**
 * Apply a status/severity change to several incidents in one call. The server
 * validates and authorizes every entry on its own and reports the per-entry
 * outcome in the {@link BulkOperationResult}.
 */
export const bulkCreateResolutionStatus = async (
  entries: CreateTestCaseResolutionStatus[]
) => {
  const response = await APIClient.put<
    CreateTestCaseResolutionStatus[],
    AxiosResponse<BulkOperationResult>
  >(`${testCaseIncidentUrl}/bulk`, entries);

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

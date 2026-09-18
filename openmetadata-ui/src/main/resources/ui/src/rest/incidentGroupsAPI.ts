/*
 *  Copyright 2026 Collate.
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
import { PagingResponse } from 'Models';
import { CreateTestCaseResolutionStatus } from '../generated/api/tests/createTestCaseResolutionStatus';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../generated/tests/testCaseIncidentGroup';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../generated/tests/testCaseResolutionStatus';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import APIClient from './index';

const testCaseIncidentUrl = '/dataQuality/testCases/testCaseIncidentStatus';

/**
 * Maximum number of entries the bulk endpoint accepts in a single call
 * (`TestCaseResolutionStatusResource.MAX_BULK_CREATE_SIZE`).
 */
export const MAX_BULK_INCIDENT_UPDATE_SIZE = 100;

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

/** Incident timestamp the `startTs`/`endTs` range applies to. */
export type IncidentDateField = 'createdAt' | 'updatedAt';

export type IncidentSortType = 'asc' | 'desc';

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

export type ListIncidentsParams = {
  testCaseId?: string;
  testCaseFQN?: string;
  originEntityFQN?: string;
  domain?: string;
  /** Test definition of the incident's test case, by name or FQN. */
  testDefinition?: string;
  /** Direct owner (user or team name) of the incident's test case. */
  owner?: string;
  /** Current assignee of the incident. */
  assignee?: string;
  testCaseResolutionStatusType?: TestCaseResolutionStatusTypes;
  startTs?: number;
  endTs?: number;
  latest?: boolean;
  limit?: number;
  /** Opaque cursor from a previous `paging.before`/`paging.after`. */
  offset?: IncidentCursor;
};

/**
 * Serialize repeatable query params as `status=New&status=Ack` rather than the
 * client-wide comma format, matching the endpoint's repeatable `status` param.
 */
const repeatableParamsSerializer = { indexes: null } as const;

/**
 * List the open incidents grouped by `table`, `testDefinition` or `owner`.
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

/**
 * List the individual incidents behind a group. The `testDefinition`, `owner`
 * and `assignee` filters scope the listing to exactly one group's population.
 */
export const listIncidents = async ({
  limit = 10,
  ...params
}: ListIncidentsParams = {}) => {
  const response = await APIClient.get<
    PagingResponse<TestCaseResolutionStatus[]>
  >(testCaseIncidentUrl, {
    params: { ...params, limit },
  });

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

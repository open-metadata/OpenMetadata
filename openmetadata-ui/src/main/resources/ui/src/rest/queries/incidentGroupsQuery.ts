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
import {
  listIncidentGroups,
  ListIncidentGroupsParams,
} from '../incidentManagerAPI';

/** Every incident group read: invalidated whole once an incident changes. */
export const incidentGroupsQueryKeyPrefix = ['incidentGroups'] as const;

export const incidentGroupsQueryKey = (params: ListIncidentGroupsParams) =>
  [...incidentGroupsQueryKeyPrefix, 'list', params] as const;

export const incidentGroupsQueryFn = (params: ListIncidentGroupsParams) => () =>
  listIncidentGroups(params);

/** One group by its key, which may sit on any page of the listing. */
export const incidentGroupQueryKey = (params: ListIncidentGroupsParams) =>
  [...incidentGroupsQueryKeyPrefix, 'group', params] as const;

export const incidentGroupQueryFn =
  (params: ListIncidentGroupsParams) => async () =>
    (await listIncidentGroups({ ...params, limit: 1 })).data[0] ?? null;

/** A page of one group's incidents, keyed on what selects them. */
export const incidentGroupIncidentsQueryKey = (params: {
  groupKey: string;
  filters: object;
  domain?: string;
  page: number;
  limit: number;
}) => [...incidentGroupsQueryKeyPrefix, 'incidents', params] as const;

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

import { isUndefined, omitBy } from 'lodash';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseIncidentStatusParams } from '../../../../rest/incidentManagerAPI';
import { INCIDENT_GROUP_STATUS_OPTIONS } from './IncidentGroups.constants';
import { IncidentGroupFilters } from './IncidentGroups.types';
import {
  getIncidentGroupsQuery,
  isUnownedIncidentGroup,
} from './IncidentGroups.utils';

const getDimensionFilter = (
  group: TestCaseIncidentGroup
): TestCaseIncidentStatusParams => {
  const value = group.fullyQualifiedName ?? group.name;

  switch (group.groupBy) {
    case IncidentGroupBy.TestDefinition:
      return { testDefinition: value };
    case IncidentGroupBy.Table:
      return { originEntityFQN: value };
    default:
      return isUnownedIncidentGroup(group)
        ? { unowned: true }
        : { owner: group.name };
  }
};

/**
 * Params that list a group's own incidents on the flat endpoint: the group's
 * dimension value plus every filter the groups were fetched with, over the
 * latest record of each open incident — so the list holds what the group
 * counted. The endpoint only honours `latest` over a range, hence one spanning
 * every incident when the page sets none.
 */
export const getIncidentGroupIncidentsQuery = (
  group: TestCaseIncidentGroup,
  filters: IncidentGroupFilters,
  now: number,
  domain?: string
): TestCaseIncidentStatusParams => {
  const { dateField } = getIncidentGroupsQuery(filters);

  return omitBy(
    {
      ...getDimensionFilter(group),
      latest: true,
      startTs: filters.startTs ?? 0,
      endTs: filters.endTs ?? now,
      dateField,
      testCaseResolutionStatusType: (filters.status.length > 0
        ? filters.status
        : INCIDENT_GROUP_STATUS_OPTIONS
      ).join(','),
      testCaseFQN: filters.testCaseFQN,
      assignee: filters.assignee,
      severity:
        filters.severity.length > 0 ? filters.severity.join(',') : undefined,
      domain,
    },
    isUndefined
  );
};

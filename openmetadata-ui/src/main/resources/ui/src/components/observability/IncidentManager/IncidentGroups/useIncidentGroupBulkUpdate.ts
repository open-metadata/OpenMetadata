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

import { uniqBy } from 'lodash';
import { useCallback, useState } from 'react';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { CreateTestCaseResolutionStatus } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseIncidentGroup } from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import { BulkOperationResult } from '../../../../generated/type/bulkOperationResult';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import {
  bulkCreateResolutionStatus,
  getListTestCaseIncidentStatus,
  IncidentCursor,
  MAX_BULK_INCIDENT_UPDATE_SIZE,
  TestCaseIncidentStatusParams,
} from '../../../../rest/incidentManagerAPI';
import {
  buildBulkIncidentEntries,
  chunkBulkIncidentEntries,
  mergeBulkResults,
} from './IncidentGroupBulk.utils';
import { getIncidentGroupIncidentsQuery } from './IncidentGroupIncidents.utils';
import {
  BulkIncidentChange,
  IncidentGroupFilters,
} from './IncidentGroups.types';

/**
 * Every open incident a query lists from `offset` on, read page after page:
 * each page needs the cursor of the one before it.
 */
const fetchIncidentsFrom = async (
  query: TestCaseIncidentStatusParams,
  offset?: IncidentCursor
): Promise<TestCaseResolutionStatus[]> => {
  const { data, paging } = await getListTestCaseIncidentStatus({
    ...query,
    limit: MAX_BULK_INCIDENT_UPDATE_SIZE,
    offset,
  });

  return paging?.after
    ? [...data, ...(await fetchIncidentsFrom(query, paging.after))]
    : data;
};

/** Every open incident of one group. */
const fetchAllGroupIncidents = (
  group: TestCaseIncidentGroup,
  filters: IncidentGroupFilters,
  domain?: string
) =>
  fetchIncidentsFrom(
    getIncidentGroupIncidentsQuery(group, filters, Date.now(), domain)
  );

/**
 * Sends the batches one call after another: the endpoint caps a call at 100
 * entries, and one call at a time keeps the writes off each other.
 */
const sendBatches = async ([
  batch,
  ...rest
]: CreateTestCaseResolutionStatus[][]): Promise<BulkOperationResult[]> =>
  batch
    ? [await bulkCreateResolutionStatus(batch), ...(await sendBatches(rest))]
    : [];

/**
 * Applies one change to every open incident of a selection of groups: their
 * incidents are read under the filters the groups were fetched with, the ones
 * the change would alter are sent in calls the endpoint accepts, and every
 * call's outcome is added up — nothing is dropped on the way.
 */
export const useIncidentGroupBulkUpdate = ({
  filters,
}: {
  filters: IncidentGroupFilters;
}) => {
  const { activeDomain } = useDomainStore();
  const domain =
    activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain;
  const [isApplying, setIsApplying] = useState(false);

  const applyBulkChange = useCallback(
    async (groups: TestCaseIncidentGroup[], change: BulkIncidentChange) => {
      setIsApplying(true);

      try {
        // A test case co-owned by two owners sits in both their groups.
        const incidents = uniqBy(
          (
            await Promise.all(
              groups.map((group) =>
                fetchAllGroupIncidents(group, filters, domain)
              )
            )
          ).flat(),
          'stateId'
        );
        const { entries, unchanged } = buildBulkIncidentEntries(
          incidents,
          change
        );
        const results = await sendBatches(chunkBulkIncidentEntries(entries));

        return {
          total: entries.length,
          unchanged,
          ...mergeBulkResults(results),
        };
      } finally {
        setIsApplying(false);
      }
    },
    [filters, domain]
  );

  return { isApplying, applyBulkChange };
};

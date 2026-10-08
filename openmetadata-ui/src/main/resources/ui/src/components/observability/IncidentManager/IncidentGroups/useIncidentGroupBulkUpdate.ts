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

import { AxiosError } from 'axios';
import { chunk, uniqBy } from 'lodash';
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
  MAX_BULK_INCIDENT_UPDATE_SIZE,
} from '../../../../rest/incidentManagerAPI';
import { fetchAllPages } from '../../../../utils/AsyncUtils';
import { getErrorText } from '../../../../utils/StringUtils';
import {
  buildBulkIncidentEntries,
  chunkBulkIncidentEntries,
  mergeBulkResults,
} from './IncidentGroupBulk.utils';
import { getIncidentGroupIncidentsQuery } from './IncidentGroupIncidents.utils';
import { BULK_GROUP_READ_CONCURRENCY } from './IncidentGroups.constants';
import {
  BulkIncidentChange,
  IncidentGroupFilters,
} from './IncidentGroups.types';

/** Every open incident of one group, read page after page. */
const fetchAllGroupIncidents = async (
  group: TestCaseIncidentGroup,
  filters: IncidentGroupFilters,
  domain?: string
) => {
  const query = getIncidentGroupIncidentsQuery(
    group,
    filters,
    Date.now(),
    domain
  );
  const { data } = await fetchAllPages((offset) =>
    getListTestCaseIncidentStatus({
      ...query,
      limit: MAX_BULK_INCIDENT_UPDATE_SIZE,
      offset,
    })
  );

  return data;
};

/**
 * The incidents of every selected group, a few groups at a time: a selection
 * spanning pages must not open a read per group all at once.
 */
const fetchSelectedIncidents = async (
  groups: TestCaseIncidentGroup[],
  filters: IncidentGroupFilters,
  domain?: string
) => {
  const readGroup = (group: TestCaseIncidentGroup) =>
    fetchAllGroupIncidents(group, filters, domain);
  const incidents: TestCaseResolutionStatus[] = [];

  for (const someGroups of chunk(groups, BULK_GROUP_READ_CONCURRENCY)) {
    const read = await Promise.all(someGroups.map(readGroup)); // NOSONAR
    incidents.push(...read.flat());
  }

  return incidents;
};

/** One call's outcome; a call that fails outright fails every entry it carried. */
const sendBatch = async (
  batch: CreateTestCaseResolutionStatus[]
): Promise<BulkOperationResult> => {
  try {
    return await bulkCreateResolutionStatus(batch);
  } catch (error) {
    const message = getErrorText(error as AxiosError, (error as Error).message);

    return {
      numberOfRowsFailed: batch.length,
      failedRequest: batch.map((request) => ({ request, message })),
    };
  }
};

/**
 * Sends the batches one call after another: the endpoint caps a call at 100
 * entries, and one at a time keeps the writes off each other. A failed call
 * does not stop the rest — the ones before it are written, so the outcome has
 * to say what went through either way.
 */
const sendBatches = async (batches: CreateTestCaseResolutionStatus[][]) => {
  const results: BulkOperationResult[] = [];

  for (const batch of batches) {
    results.push(await sendBatch(batch)); // NOSONAR
  }

  return results;
};

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
          await fetchSelectedIncidents(groups, filters, domain),
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

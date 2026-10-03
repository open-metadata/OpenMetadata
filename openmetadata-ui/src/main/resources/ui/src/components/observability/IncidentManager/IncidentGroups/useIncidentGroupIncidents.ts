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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { TestCaseIncidentGroup } from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import { Paging } from '../../../../generated/type/paging';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { getIncidentGroupIncidentsQuery } from './IncidentGroupIncidents.utils';
import { IncidentGroupFilters } from './IncidentGroups.types';
import { getPageAfterEmptyRead } from './IncidentGroups.utils';
import { useIncidentPaging } from './useIncidentPaging';

interface UseIncidentGroupIncidentsProps {
  /** The group whose incidents to list; nothing is fetched without one. */
  group?: TestCaseIncidentGroup;
  /** The filters the group was fetched with, so the list matches its count. */
  filters: IncidentGroupFilters;
  defaultPageSize: number;
}

const NO_INCIDENTS: TestCaseResolutionStatus[] = [];

/**
 * The incidents of one group, a page at a time. The fetch only runs once a
 * group is handed in, and any response for a group that has since been closed
 * or swapped is dropped on arrival.
 *
 * Rows are kept with the group they were read for: the drawer outlives each
 * preview, and another group's rows must not sit under this one's header while
 * it loads. The fetch is keyed on the group's identity rather than its object,
 * which a re-read of the groups replaces without changing the group.
 */
export const useIncidentGroupIncidents = ({
  group,
  filters,
  defaultPageSize,
}: UseIncidentGroupIncidentsProps) => {
  const { t } = useTranslation();
  const { activeDomain } = useDomainStore();
  const domain =
    activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain;
  const groupKey = group
    ? `${group.groupBy}|${group.id ?? group.fullyQualifiedName ?? group.name}`
    : '';
  const { currentPage, pageSize, setPageSize, goToPage } = useIncidentPaging(
    `${groupKey}|${domain}|${JSON.stringify(filters)}`,
    defaultPageSize
  );
  const [read, setRead] = useState<{
    groupKey: string;
    incidents: TestCaseResolutionStatus[];
    paging: Paging;
  }>();
  const shownRead = read?.groupKey === groupKey ? read : undefined;
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const latestRequest = useRef(0);
  // Bumped to re-read the page in hand, e.g. after an incident on it changed.
  const [refreshKey, setRefreshKey] = useState(0);
  const groupRef = useRef(group);
  groupRef.current = group;

  useEffect(() => {
    const current = groupRef.current;
    if (!current) {
      return;
    }

    latestRequest.current += 1;
    const requestId = latestRequest.current;
    const isCurrent = () => latestRequest.current === requestId;
    setIsLoading(true);
    setIsError(false);

    getListTestCaseIncidentStatus({
      ...getIncidentGroupIncidentsQuery(current, filters, Date.now(), domain),
      limit: pageSize,
      page: currentPage,
    })
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        // Resolving the last incidents on a page leaves it past the end.
        const pageAfterEmptyRead = getPageAfterEmptyRead(
          response.data.length,
          currentPage,
          pageSize,
          response.paging.total
        );
        if (pageAfterEmptyRead === undefined) {
          setRead({
            groupKey,
            incidents: response.data,
            paging: response.paging,
          });
        } else {
          goToPage(pageAfterEmptyRead);
        }
      })
      .catch((error: AxiosError) => {
        if (isCurrent()) {
          setRead(undefined);
          setIsError(true);
          showErrorToast(
            error,
            t('server.entity-fetch-error', {
              entity: t('label.incident-plural'),
            })
          );
        }
      })
      .finally(() => {
        if (isCurrent()) {
          setIsLoading(false);
        }
      });

    return () => {
      latestRequest.current += 1;
    };
  }, [
    groupKey,
    filters,
    domain,
    pageSize,
    currentPage,
    goToPage,
    refreshKey,
    t,
  ]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  return {
    incidents: shownRead?.incidents ?? NO_INCIDENTS,
    paging: shownRead?.paging,
    currentPage,
    pageSize,
    isLoading,
    isError,
    handlePageChange: goToPage,
    handlePageSizeChange: setPageSize,
    refresh,
  };
};

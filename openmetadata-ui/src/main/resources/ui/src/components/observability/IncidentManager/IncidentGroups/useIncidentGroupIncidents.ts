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
import { useIncidentPaging } from './useIncidentPaging';

interface UseIncidentGroupIncidentsProps {
  /** The group whose incidents to list; nothing is fetched without one. */
  group?: TestCaseIncidentGroup;
  /** The filters the group was fetched with, so the list matches its count. */
  filters: IncidentGroupFilters;
  defaultPageSize: number;
}

/**
 * The incidents of one group, a page at a time. The fetch only runs once a
 * group is handed in, and any response for a group that has since been closed
 * or swapped is dropped on arrival.
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
  const [incidents, setIncidents] = useState<TestCaseResolutionStatus[]>([]);
  const [paging, setPaging] = useState<Paging>();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const latestRequest = useRef(0);
  // Bumped to re-read the page in hand, e.g. after an incident on it changed.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!group) {
      return;
    }

    latestRequest.current += 1;
    const requestId = latestRequest.current;
    const isCurrent = () => latestRequest.current === requestId;
    setIsLoading(true);
    setIsError(false);

    getListTestCaseIncidentStatus({
      ...getIncidentGroupIncidentsQuery(group, filters, Date.now(), domain),
      limit: pageSize,
      page: currentPage,
    })
      .then((response) => {
        if (isCurrent()) {
          setIncidents(response.data);
          setPaging(response.paging);
        }
      })
      .catch((error: AxiosError) => {
        if (isCurrent()) {
          setIncidents([]);
          setPaging(undefined);
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
  }, [group, filters, domain, pageSize, currentPage, refreshKey, t]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  return {
    incidents,
    paging,
    currentPage,
    pageSize,
    isLoading,
    isError,
    handlePageChange: goToPage,
    handlePageSizeChange: setPageSize,
    refresh,
  };
};

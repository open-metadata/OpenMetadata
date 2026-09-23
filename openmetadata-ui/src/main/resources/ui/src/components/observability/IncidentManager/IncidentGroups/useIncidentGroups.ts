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
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { Paging } from '../../../../generated/type/paging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import {
  IncidentSortType,
  listIncidentGroups,
} from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  DEFAULT_INCIDENT_SORT_TYPE,
  INCIDENT_GROUPS_PAGE_SIZE,
  INCIDENT_GROUP_BY_PARAM,
} from './IncidentGroups.constants';
import { parseIncidentGroupBy } from './IncidentGroups.utils';

/**
 * Owns the grouped incident listing: the grouping dimension is read from and
 * written to the URL, and every change to it refires the fetch. The cursors the
 * server hands back are kept untouched so the pagination added on top of this
 * can pass them straight back as `offset`.
 *
 * `refreshKey` is the caller's way of saying the groups it is showing are out
 * of date — a new value refires the fetch once, which is how an incident
 * changed elsewhere on the page reaches these rows without a reload. That
 * re-read runs in the background: the rows stay put until the new ones land.
 */
export const useIncidentGroups = ({
  refreshKey,
}: { refreshKey?: number } = {}) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () =>
      QueryString.parse(
        location.search.startsWith('?')
          ? location.search.substring(1)
          : location.search
      ),
    [location.search]
  );

  const groupBy = parseIncidentGroupBy(searchParams[INCIDENT_GROUP_BY_PARAM]);

  const [incidentGroups, setIncidentGroups] = useState<TestCaseIncidentGroup[]>(
    []
  );
  const [paging, setPaging] = useState<Paging>();
  /**
   * Ordering of the incident count. Local rather than in the URL: unlike the
   * dimension it is a view preference the endpoint defaults on its own, so a
   * shared link carries the groups without having to carry their order too.
   */
  const [sortType, setSortType] = useState<IncidentSortType>(
    DEFAULT_INCIDENT_SORT_TYPE
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // Guards against a slow response for a dimension the user already left.
  const latestRequest = useRef(0);
  // The key the rows on screen were last fetched for, so a fetch can tell a
  // refresh of what is already displayed from a load of something new.
  const fetchedRefreshKey = useRef(refreshKey);

  const fetchIncidentGroups = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    // A new key means the caller is only saying the rows are stale, so they
    // stay on screen while they are re-read: no loader swapped in for the table
    // the user is reading, and no wipe if the re-read fails.
    const isBackground = fetchedRefreshKey.current !== refreshKey;
    fetchedRefreshKey.current = refreshKey;

    if (!isBackground) {
      setIsLoading(true);
    }
    setIsError(false);

    try {
      const response = await listIncidentGroups({
        groupBy,
        limit: INCIDENT_GROUPS_PAGE_SIZE,
        sortType,
      });

      if (latestRequest.current !== requestId) {
        return;
      }

      setIncidentGroups(response.data);
      setPaging(response.paging);
    } catch (error) {
      if (latestRequest.current !== requestId) {
        return;
      }

      if (!isBackground) {
        setIncidentGroups([]);
        setPaging(undefined);
        setIsError(true);
      }
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.incident-plural') })
      );
    } finally {
      if (latestRequest.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [groupBy, sortType, refreshKey, t]);

  useEffect(() => {
    fetchIncidentGroups();

    // Invalidates the in-flight request so a response landing after the view is
    // gone cannot raise a toast the user has no context for.
    return () => {
      latestRequest.current += 1;
    };
  }, [fetchIncidentGroups]);

  const handleGroupByChange = useCallback(
    (updatedGroupBy: IncidentGroupBy) => {
      if (updatedGroupBy === groupBy) {
        return;
      }

      navigate(
        {
          search: QueryString.stringify({
            ...searchParams,
            [INCIDENT_GROUP_BY_PARAM]: updatedGroupBy,
          }),
        },
        { replace: true }
      );
    },
    [groupBy, navigate, searchParams]
  );

  return {
    groupBy,
    incidentGroups,
    paging,
    sortType,
    isLoading,
    isError,
    handleGroupByChange,
    handleSortTypeChange: setSortType,
  };
};

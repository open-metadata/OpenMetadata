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
import { pick } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { Paging } from '../../../../generated/type/paging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import {
  IncidentSortType,
  listIncidentGroups,
} from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  DEFAULT_INCIDENT_SORT_TYPE,
  INCIDENT_GROUPS_PAGE_SIZE,
  INCIDENT_GROUP_BY_PARAM,
  INCIDENT_GROUP_FILTER_KEYS,
} from './IncidentGroups.constants';
import { IncidentGroupFilters } from './IncidentGroups.types';
import {
  getIncidentGroupsQuery,
  parseIncidentGroupBy,
  parseIncidentGroupFilters,
} from './IncidentGroups.utils';

interface IncidentGroupsPage {
  /** The query the page belongs to; a page of another query is page 1. */
  queryKey: string;
  currentPage: number;
}

/**
 * Owns the grouped incident listing: the grouping dimension and the filters are
 * read from and written to the URL, and every change to them refires the fetch
 * from the first page. Pages are walked with the cursors the server hands back,
 * passed straight back as `offset` and never decoded.
 *
 * `refreshKey` is the caller's way of saying the groups it is showing are out
 * of date — a new value refires the fetch once, which is how an incident
 * changed elsewhere on the page reaches these rows without a reload. That
 * re-read runs in the background whenever there are rows to keep: they stay put
 * until the new ones land.
 */
export const useIncidentGroups = ({
  refreshKey,
}: { refreshKey?: number } = {}) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { activeDomain } = useDomainStore();
  // The groups follow the domain scope picked in the app nav, like every other listing.
  const domain =
    activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain;

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

  // Keyed on the filter params alone: the incident table on the same page
  // writes its own paging params into this query string, and those must not
  // refetch the groups.
  const filtersSearch = QueryString.stringify(
    pick(searchParams, INCIDENT_GROUP_FILTER_KEYS)
  );
  const filters = useMemo(
    () => parseIncidentGroupFilters(QueryString.parse(filtersSearch)),
    [filtersSearch]
  );

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
  const [pageSize, setPageSize] = useState(INCIDENT_GROUPS_PAGE_SIZE);
  /**
   * Any change to what is listed starts over from the first page. The page is
   * therefore tagged with its query, and read as page 1 once the query moves
   * on — no reset effect, so no extra fetch of the stale page.
   */
  const queryKey = `${groupBy}|${sortType}|${pageSize}|${domain}|${filtersSearch}`;
  const [page, setPage] = useState<IncidentGroupsPage>({
    queryKey,
    currentPage: 1,
  });
  const activePage: IncidentGroupsPage =
    page.queryKey === queryKey ? page : { queryKey, currentPage: 1 };
  const { currentPage } = activePage;
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // Guards against a slow response for a dimension the user already left.
  const latestRequest = useRef(0);
  // The key and the dimension the rows on screen were last fetched for, so a
  // fetch can tell a refresh of what is already displayed from a load of
  // something new.
  const fetchedRefreshKey = useRef(refreshKey);
  const fetchedGroupBy = useRef(groupBy);
  // Whether the rows on screen are ones a settled fetch put there. A dimension
  // switch still in flight, or a read that failed, leaves the table empty —
  // there is then nothing for a re-read to preserve.
  const hasSettledGroups = useRef(false);

  const fetchIncidentGroups = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    // A new dimension means the rows on screen describe something else: kept,
    // they would render under the new dimension's column header and badge, and
    // the header stats would describe the dimension the user just left.
    const isDimensionChange = fetchedGroupBy.current !== groupBy;
    // A new key over a settled table means the caller is only saying the rows
    // are stale, so they stay on screen while they are re-read: no loader
    // swapped in for the table the user is reading, and no wipe if the re-read
    // fails. With nothing settled to keep, the re-read has to report itself
    // like any first read — it supersedes whatever it raced, so it is the only
    // request left to fill the section.
    const isBackground =
      !isDimensionChange &&
      hasSettledGroups.current &&
      fetchedRefreshKey.current !== refreshKey;
    fetchedRefreshKey.current = refreshKey;
    fetchedGroupBy.current = groupBy;

    if (isDimensionChange) {
      hasSettledGroups.current = false;
      setIncidentGroups([]);
      setPaging(undefined);
    }

    if (!isBackground) {
      setIsLoading(true);
      // Only a foreground read owns the error flag. A background one that
      // clears it up front and then fails leaves the section on the empty
      // placeholder, with nothing left to put the error back.
      setIsError(false);
    }

    try {
      const response = await listIncidentGroups({
        groupBy,
        limit: pageSize,
        sortType,
        page: currentPage,
        domain,
        ...getIncidentGroupsQuery(filters),
      });

      if (latestRequest.current !== requestId) {
        return;
      }

      hasSettledGroups.current = true;
      setIncidentGroups(response.data);
      setPaging(response.paging);
      setIsError(false);
    } catch (error) {
      if (latestRequest.current !== requestId) {
        return;
      }

      if (isBackground) {
        // The rows stay on screen, so a toast is the only sign the re-read
        // failed; a foreground failure says so in the section itself.
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.incident-plural') })
        );
      } else {
        hasSettledGroups.current = false;
        setIncidentGroups([]);
        setPaging(undefined);
        setIsError(true);
      }
    } finally {
      if (latestRequest.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [groupBy, sortType, pageSize, currentPage, filters, domain, refreshKey, t]);

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

  const handleFiltersChange = useCallback(
    (changes: Partial<IncidentGroupFilters>) => {
      navigate(
        {
          search: QueryString.stringify(
            { ...searchParams, ...changes },
            { arrayFormat: 'repeat' }
          ),
        },
        { replace: true }
      );
    },
    [navigate, searchParams]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => setPage({ queryKey, currentPage: nextPage }),
    [queryKey]
  );

  return {
    groupBy,
    filters,
    incidentGroups,
    paging,
    sortType,
    currentPage,
    pageSize,
    isLoading,
    isError,
    retry: fetchIncidentGroups,
    handleGroupByChange,
    handleFiltersChange,
    handleSortTypeChange: setSortType,
    handlePageChange,
    handlePageSizeChange: setPageSize,
  };
};

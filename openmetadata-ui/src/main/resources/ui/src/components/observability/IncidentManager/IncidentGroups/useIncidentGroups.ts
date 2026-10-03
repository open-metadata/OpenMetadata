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
import { isString, omit, pick } from 'lodash';
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
  INCIDENT_GROUP_DETAIL_PARAM,
  INCIDENT_GROUP_FILTER_KEYS,
} from './IncidentGroups.constants';
import { IncidentGroupFilters } from './IncidentGroups.types';
import {
  getIncidentGroupFilterKey,
  getIncidentGroupsQuery,
  getPageAfterEmptyRead,
  parseIncidentGroupBy,
  parseIncidentGroupFilters,
} from './IncidentGroups.utils';
import { useIncidentPaging } from './useIncidentPaging';

/**
 * Owns the grouped incident listing: the grouping dimension and the filters are
 * read from and written to the URL, and every change to them refires the fetch
 * from the first page, which the server is asked for by number.
 *
 * `refreshKey` is the caller's way of saying the groups it is showing are out
 * of date — a new value refires the fetch once, which is how an incident
 * changed elsewhere on the page reaches these rows without a reload. That
 * re-read runs in the background whenever there are rows to keep: they stay put
 * until the new ones land.
 *
 * The open drill-down is in the URL too, and its group is read on its own: the
 * one a link names may sit on any page of the listing.
 */
export const useIncidentGroups = ({
  refreshKey: externalRefreshKey,
}: { refreshKey?: number } = {}) => {
  // The view's own reason to re-read, e.g. after a bulk change, adds to the
  // caller's; both refresh in the background alike.
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const refreshKey = (externalRefreshKey ?? 0) + localRefreshKey;
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
  const detailParam = searchParams[INCIDENT_GROUP_DETAIL_PARAM];
  const detailKey = isString(detailParam) ? detailParam : undefined;
  // The group last read for the drill-down, with the key it was read for.
  const [detail, setDetail] = useState<{
    key: string;
    group?: TestCaseIncidentGroup;
  }>();

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
  const { currentPage, pageSize, setPageSize, goToPage } = useIncidentPaging(
    `${groupBy}|${sortType}|${domain}|${filtersSearch}`,
    INCIDENT_GROUPS_PAGE_SIZE
  );
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
    const previousRefreshKey = fetchedRefreshKey.current;
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

      // A refresh can leave the page past the end, e.g. once the last groups
      // on it were resolved. Shown as is, it would read as no groups at all,
      // with no pager back to the pages that still hold some.
      const pageAfterEmptyRead = getPageAfterEmptyRead(
        response.data.length,
        currentPage,
        pageSize,
        response.paging.total
      );
      if (pageAfterEmptyRead !== undefined) {
        // The earlier page is read the way this one was: a refresh stays in
        // the background, keeping the rows on screen if that read fails too.
        fetchedRefreshKey.current = previousRefreshKey;
        goToPage(pageAfterEmptyRead);

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
  }, [
    groupBy,
    sortType,
    pageSize,
    currentPage,
    goToPage,
    filters,
    domain,
    refreshKey,
    t,
  ]);

  useEffect(() => {
    fetchIncidentGroups();

    // Invalidates the in-flight request so a response landing after the view is
    // gone cannot raise a toast the user has no context for.
    return () => {
      latestRequest.current += 1;
    };
  }, [fetchIncidentGroups]);

  useEffect(() => {
    if (detailKey === undefined) {
      return;
    }
    let isCurrent = true;
    listIncidentGroups({
      groupBy,
      group: detailKey,
      limit: 1,
      domain,
      ...getIncidentGroupsQuery(filters),
    })
      .then(({ data }) => {
        if (isCurrent) {
          setDetail({ key: detailKey, group: data[0] });
        }
      })
      .catch((error: AxiosError) => {
        if (isCurrent) {
          setDetail({ key: detailKey });
          showErrorToast(
            error,
            t('server.entity-fetch-error', {
              entity: t('label.incident-plural'),
            })
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [detailKey, groupBy, domain, filters, refreshKey, t]);

  // A group opened from a row is on screen already, so it shows at once; the
  // read above then keeps it current.
  const loadedDetailGroup =
    detailKey === undefined
      ? undefined
      : incidentGroups.find(
          (group) => getIncidentGroupFilterKey(group) === detailKey
        );
  const hasReadDetail = detailKey !== undefined && detail?.key === detailKey;
  const detailGroup = hasReadDetail ? detail?.group : loadedDetailGroup;

  const openGroup = useCallback(
    (group: TestCaseIncidentGroup) =>
      navigate(
        {
          search: QueryString.stringify(
            {
              ...searchParams,
              [INCIDENT_GROUP_DETAIL_PARAM]: getIncidentGroupFilterKey(group),
            },
            { arrayFormat: 'repeat' }
          ),
        },
        { state: { fromGroups: true } }
      ),
    [navigate, searchParams]
  );

  // Back from a drill-down opened here retraces that step, so the browser's
  // Back cannot return to it; one reached by a link has nothing to retrace.
  const closeGroup = useCallback(() => {
    if ((location.state as { fromGroups?: boolean } | null)?.fromGroups) {
      navigate(-1);
    } else {
      navigate(
        {
          search: QueryString.stringify(
            omit(searchParams, INCIDENT_GROUP_DETAIL_PARAM),
            { arrayFormat: 'repeat' }
          ),
        },
        { replace: true }
      );
    }
  }, [location.state, navigate, searchParams]);

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
    (nextPage: number) => goToPage(nextPage),
    [goToPage]
  );

  const refresh = useCallback(() => setLocalRefreshKey((key) => key + 1), []);

  return {
    refresh,
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
    detailKey,
    detailGroup,
    isDetailLoading: detailKey !== undefined && !hasReadDetail && !detailGroup,
    openGroup,
    closeGroup,
    handleGroupByChange,
    handleFiltersChange,
    handleSortTypeChange: setSortType,
    handlePageChange,
    handlePageSizeChange: setPageSize,
  };
};

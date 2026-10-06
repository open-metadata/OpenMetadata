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
import { omit, pick } from 'lodash';
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
  IncidentCursor,
  IncidentSortType,
  listIncidentGroups,
} from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  DEFAULT_INCIDENT_SORT_TYPE,
  INCIDENT_GROUPS_CURSOR_PARAM,
  INCIDENT_GROUPS_FILTER_PARAMS,
  INCIDENT_GROUPS_PAGE_PARAM,
  INCIDENT_GROUPS_PAGE_SIZE,
  INCIDENT_GROUPS_PAGE_SIZE_PARAM,
  INCIDENT_GROUPS_PAGING_PARAMS,
  INCIDENT_GROUP_BY_PARAM,
} from './IncidentGroups.constants';
import { IncidentGroupsFilters } from './IncidentGroups.types';
import {
  buildIncidentGroupsParams,
  getIncidentGroupsPageCount,
  hasActiveIncidentGroupsFilters,
  parseIncidentGroupBy,
  parseIncidentGroupsFilters,
  parseIncidentGroupsPaging,
} from './IncidentGroups.utils';

const FILTER_PARAM_KEYS = Object.values(INCIDENT_GROUPS_FILTER_PARAMS);

/**
 * Owns the grouped incident listing: the grouping dimension, the filters and
 * the pager position all live in the URL, and every change to them refires the
 * fetch. Whatever changes what is being paged — a filter, the dimension, the
 * ordering or the page size — drops the pager back to page 1, as a cursor only
 * means something for the query that produced it.
 *
 * The server's cursors are kept untouched: the next and previous pages are
 * reached by handing `paging.after`/`paging.before` back verbatim as `offset`.
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

  // Keyed on the serialized params the groups read, so a change to one only
  // the flat listing below reads does not refetch the groups.
  const filterSearch = QueryString.stringify(
    pick(searchParams, FILTER_PARAM_KEYS)
  );
  const filters = useMemo(
    () => parseIncidentGroupsFilters(QueryString.parse(filterSearch)),
    [filterSearch]
  );

  const pagingSearch = QueryString.stringify(
    pick(searchParams, [
      INCIDENT_GROUPS_PAGE_SIZE_PARAM,
      ...INCIDENT_GROUPS_PAGING_PARAMS,
    ])
  );
  const pagingState = useMemo(
    () => parseIncidentGroupsPaging(QueryString.parse(pagingSearch)),
    [pagingSearch]
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
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // Guards against a slow response for a query the user already left.
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

  /**
   * Writes params into the query string, leaving the rest of it — the flat
   * listing's own filters among them — as it is. Unless the change only moves
   * the pager, the pager position is dropped with it.
   */
  const updateSearchParams = useCallback(
    (
      updates: Record<string, unknown>,
      { keepPaging = false }: { keepPaging?: boolean } = {}
    ) => {
      const nextParams = { ...searchParams, ...updates };

      navigate(
        {
          search: QueryString.stringify(
            keepPaging
              ? nextParams
              : omit(nextParams, INCIDENT_GROUPS_PAGING_PARAMS),
            { arrayFormat: 'repeat' }
          ),
        },
        { replace: true }
      );
    },
    [navigate, searchParams]
  );

  const goToPage = useCallback(
    (page: number, cursor?: IncidentCursor) =>
      updateSearchParams(
        page > 1 && cursor
          ? {
              [INCIDENT_GROUPS_PAGE_PARAM]: page,
              [INCIDENT_GROUPS_CURSOR_PARAM]: cursor,
            }
          : {
              [INCIDENT_GROUPS_PAGE_PARAM]: undefined,
              [INCIDENT_GROUPS_CURSOR_PARAM]: undefined,
            },
        { keepPaging: true }
      ),
    [updateSearchParams]
  );

  /**
   * Readies the section for a read and says whether it runs in the background,
   * i.e. over rows that stay on screen until it lands.
   */
  const beginRead = useCallback(() => {
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

    return isBackground;
  }, [groupBy, refreshKey]);

  const fetchIncidentGroups = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    const isBackground = beginRead();

    try {
      const response = await listIncidentGroups(
        buildIncidentGroupsParams({
          groupBy,
          filters,
          paging: pagingState,
          sortType,
        })
      );

      if (latestRequest.current !== requestId) {
        return;
      }

      // A page past the first can empty out under the user — its incidents
      // resolved since the cursor was handed out. Rather than an empty table
      // over a pager still counting pages, start over from the first.
      if (response.data.length === 0 && pagingState.page > 1) {
        goToPage(1);

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

      if (!isBackground) {
        hasSettledGroups.current = false;
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
  }, [groupBy, filters, pagingState, sortType, beginRead, goToPage, t]);

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

      updateSearchParams({ [INCIDENT_GROUP_BY_PARAM]: updatedGroupBy });
    },
    [groupBy, updateSearchParams]
  );

  const handleSortTypeChange = useCallback(
    (updatedSortType: IncidentSortType) => {
      setSortType(updatedSortType);
      updateSearchParams({});
    },
    [updateSearchParams]
  );

  /** Merges into the active filters; an `undefined` value clears that one. */
  const handleFiltersChange = useCallback(
    (updatedFilters: Partial<IncidentGroupsFilters>) =>
      updateSearchParams(updatedFilters),
    [updateSearchParams]
  );

  const clearFilters = useCallback(
    () =>
      updateSearchParams(
        Object.fromEntries(FILTER_PARAM_KEYS.map((key) => [key, undefined]))
      ),
    [updateSearchParams]
  );

  /**
   * Cursors only step one page at a time, so any other page asked for — a
   * page number clicked or typed further away — moves one page towards it.
   * Page 1 needs no cursor and is always one step away.
   *
   * Ignored while a page is loading: the cursors in hand then belong to the
   * page being left, and stepping from them would land on the wrong page.
   */
  const handlePageChange = useCallback(
    (requestedPage: number) => {
      const { page } = pagingState;

      if (requestedPage === page || isLoading) {
        return;
      }

      if (requestedPage === 1 || (requestedPage < page && page === 2)) {
        goToPage(1);

        return;
      }

      const cursor = requestedPage > page ? paging?.after : paging?.before;

      if (cursor) {
        goToPage(requestedPage > page ? page + 1 : page - 1, cursor);
      }
    },
    [goToPage, isLoading, paging?.after, paging?.before, pagingState]
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) =>
      updateSearchParams({
        [INCIDENT_GROUPS_PAGE_SIZE_PARAM]:
          pageSize === INCIDENT_GROUPS_PAGE_SIZE ? undefined : pageSize,
      }),
    [updateSearchParams]
  );

  return {
    groupBy,
    filters,
    hasActiveFilters: hasActiveIncidentGroupsFilters(filters),
    incidentGroups,
    paging,
    currentPage: pagingState.page,
    pageSize: pagingState.pageSize,
    pageCount: getIncidentGroupsPageCount(
      pagingState.page,
      pagingState.pageSize,
      paging
    ),
    sortType,
    isLoading,
    isError,
    handleGroupByChange,
    handleSortTypeChange,
    handleFiltersChange,
    clearFilters,
    handlePageChange,
    handlePageSizeChange,
  };
};

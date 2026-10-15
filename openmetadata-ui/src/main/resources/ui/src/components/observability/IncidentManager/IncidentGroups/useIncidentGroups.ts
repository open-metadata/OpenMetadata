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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { isString, omit, pick } from 'lodash';
import { PagingResponse } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { ListIncidentGroupsParams } from '../../../../rest/incidentManagerAPI';
import {
  incidentGroupQueryFn,
  incidentGroupQueryKey,
  incidentGroupsQueryFn,
  incidentGroupsQueryKey,
  incidentGroupsQueryKeyPrefix,
} from '../../../../rest/queries/incidentGroupsQuery';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  DEFAULT_INCIDENT_GROUP_SORT,
  INCIDENT_GROUPS_PAGE_SIZE,
  INCIDENT_GROUP_BY_PARAM,
  INCIDENT_GROUP_DETAIL_PARAM,
  INCIDENT_GROUP_FILTER_KEYS,
} from './IncidentGroups.constants';
import {
  IncidentGroupFilters,
  IncidentGroupSort,
} from './IncidentGroups.types';
import {
  getIncidentGroupFilterKey,
  getIncidentGroupSortQuery,
  getIncidentGroupsQuery,
  getPageAfterEmptyRead,
  parseIncidentGroupBy,
  parseIncidentGroupFilters,
} from './IncidentGroups.utils';
import { useIncidentPaging } from './useIncidentPaging';

const NO_GROUPS: TestCaseIncidentGroup[] = [];

type GroupsResponse = PagingResponse<TestCaseIncidentGroup[]>;

/**
 * The page on screen: the one just read, else — while another loads or after
 * a re-read failed — the last one that settled under the same dimension.
 */
const getShownGroups = (
  settled: GroupsResponse | undefined,
  kept: { groupBy: IncidentGroupBy; response: GroupsResponse } | undefined,
  groupBy: IncidentGroupBy,
  isForegroundFailure: boolean
) => {
  if (settled || isForegroundFailure) {
    return settled;
  }

  return kept?.groupBy === groupBy ? kept.response : undefined;
};

/**
 * Toasts a failed re-read of rows that stay on screen, once per failure: a
 * failed read stays cached, and coming back to it must not toast again.
 */
const useBackgroundFailureToast = (
  isBackgroundFailure: boolean,
  error: unknown,
  errorUpdatedAt: number
) => {
  const { t } = useTranslation();
  const toastedAt = useRef(errorUpdatedAt);

  useEffect(() => {
    if (isBackgroundFailure && errorUpdatedAt !== toastedAt.current) {
      toastedAt.current = errorUpdatedAt;
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.incident-plural') })
      );
    }
  }, [isBackgroundFailure, errorUpdatedAt, error, t]);
};

/**
 * Reads one page of groups. The last page that settled under the dimension
 * stays on screen while another loads — the next page, filter or ordering, or
 * the page a refresh steps back to — but not across a dimension switch: those
 * rows would render under the new dimension's column and badge.
 *
 * A re-read of rows on screen, like the read of the page a refresh stepped
 * back to, keeps them when it fails, so a toast is the only sign; any other
 * read that fails says so in the section itself.
 */
const useIncidentGroupsRead = ({
  params,
  goToPage,
}: {
  params: ListIncidentGroupsParams & { page: number; limit: number };
  goToPage: (page: number) => void;
}) => {
  const query = useQuery({
    queryKey: incidentGroupsQueryKey(params),
    queryFn: incidentGroupsQueryFn(params),
  });
  const { data, isError, isRefetchError, error, errorUpdatedAt, refetch } =
    query;
  const kept = useRef<{
    groupBy: IncidentGroupBy;
    response: GroupsResponse;
  }>();
  const steppedBackKey = useRef<string>();
  const paramsKey = JSON.stringify(params);

  // A refresh can leave the page past the end, e.g. once the last groups on it
  // were resolved. Shown as is, it would read as no groups at all, with no
  // pager back to the pages that still hold some.
  const pageAfterEmptyRead =
    data &&
    getPageAfterEmptyRead(
      data.data.length,
      params.page,
      params.limit,
      data.paging.total
    );
  const settled = pageAfterEmptyRead === undefined ? data : undefined;
  if (settled) {
    kept.current = { groupBy: params.groupBy, response: settled };
  }
  const isBackgroundFailure =
    isRefetchError || (isError && steppedBackKey.current === paramsKey);

  useEffect(() => {
    if (pageAfterEmptyRead !== undefined) {
      steppedBackKey.current = JSON.stringify({
        ...JSON.parse(paramsKey),
        page: pageAfterEmptyRead,
      });
      goToPage(pageAfterEmptyRead);
    }
  }, [pageAfterEmptyRead, paramsKey, goToPage]);

  useBackgroundFailureToast(isBackgroundFailure, error, errorUpdatedAt);

  const isForegroundFailure = isError && !isBackgroundFailure;
  const response = getShownGroups(
    settled,
    kept.current,
    params.groupBy,
    isForegroundFailure
  );

  return {
    incidentGroups: response?.data ?? NO_GROUPS,
    paging: response?.paging,
    isLoading: !settled && !isError,
    isError: isForegroundFailure,
    retry: () => {
      refetch();
    },
  };
};

/**
 * The group a drill-down names, read on its own. One opened from a row is on
 * screen already, so it shows at once; the read then keeps it current, and the
 * row's copy stands in for it if that read fails.
 */
const useIncidentGroupDetail = ({
  groupBy,
  detailKey,
  domain,
  filters,
  incidentGroups,
}: {
  groupBy: IncidentGroupBy;
  detailKey?: string;
  domain?: string;
  filters: IncidentGroupFilters;
  incidentGroups: TestCaseIncidentGroup[];
}) => {
  const params: ListIncidentGroupsParams = {
    groupBy,
    group: detailKey,
    domain,
    ...getIncidentGroupsQuery(filters),
  };
  const detailQuery = useQuery({
    queryKey: incidentGroupQueryKey(params),
    queryFn: incidentGroupQueryFn(params),
    enabled: detailKey !== undefined,
  });
  const loadedGroup =
    detailKey === undefined
      ? undefined
      : incidentGroups.find(
          (group) => getIncidentGroupFilterKey(group) === detailKey
        );
  // A read that finds no group means none of its incidents is open any more:
  // the row's older copy must not stand in for it.
  const detailGroup =
    detailKey && detailQuery.data !== null
      ? detailQuery.data ?? loadedGroup
      : undefined;

  return {
    detailGroup,
    isDetailLoading:
      detailKey !== undefined && detailQuery.isPending && !detailGroup,
    isDetailError: detailQuery.isError && !detailGroup,
    retryDetail: () => {
      detailQuery.refetch();
    },
  };
};

/**
 * Owns the grouped incident listing: the grouping dimension and the filters are
 * read from and written to the URL, and every change to them refetches from the
 * first page, which the server is asked for by number.
 *
 * `refresh` says the groups on screen are out of date, e.g. after a bulk
 * change: their reads are invalidated and re-run in the background, the rows
 * staying put until the new ones land.
 *
 * The open drill-down is in the URL too, and its group is read on its own: the
 * one a link names may sit on any page of the listing.
 */
export const useIncidentGroups = () => {
  const queryClient = useQueryClient();
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

  // Keyed on the filter params alone: the drill-down writes its own param into
  // this query string, and opening a group must not refetch the groups.
  const filtersSearch = QueryString.stringify(
    pick(searchParams, INCIDENT_GROUP_FILTER_KEYS)
  );
  const filters = useMemo(
    () => parseIncidentGroupFilters(QueryString.parse(filtersSearch)),
    [filtersSearch]
  );
  const detailParam = searchParams[INCIDENT_GROUP_DETAIL_PARAM];
  const detailKey = isString(detailParam) ? detailParam : undefined;

  /**
   * Ordering of the groups. Local rather than in the URL: unlike the dimension
   * it is a view preference the endpoint defaults on its own, so a shared link
   * carries the groups without having to carry their order too.
   */
  const [sort, setSort] = useState<IncidentGroupSort>(
    DEFAULT_INCIDENT_GROUP_SORT
  );
  const { currentPage, pageSize, setPageSize, goToPage } = useIncidentPaging(
    `${groupBy}|${sort.field}|${sort.type}|${domain}|${filtersSearch}`,
    INCIDENT_GROUPS_PAGE_SIZE
  );

  const listParams = {
    groupBy,
    limit: pageSize,
    ...getIncidentGroupSortQuery(sort),
    page: currentPage,
    domain,
    ...getIncidentGroupsQuery(filters),
  };
  const { incidentGroups, paging, isLoading, isError, retry } =
    useIncidentGroupsRead({ params: listParams, goToPage });

  const { detailGroup, isDetailLoading, isDetailError, retryDetail } =
    useIncidentGroupDetail({
      groupBy,
      detailKey,
      domain,
      filters,
      incidentGroups,
    });

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
  const closeGroup = useCallback(
    () =>
      (location.state as { fromGroups?: boolean } | null)?.fromGroups
        ? navigate(-1)
        : navigate(
            {
              search: QueryString.stringify(
                omit(searchParams, INCIDENT_GROUP_DETAIL_PARAM),
                { arrayFormat: 'repeat' }
              ),
            },
            { replace: true }
          ),
    [location.state, navigate, searchParams]
  );

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
    (changes: Partial<IncidentGroupFilters>) =>
      navigate(
        {
          search: QueryString.stringify(
            { ...searchParams, ...changes },
            { arrayFormat: 'repeat' }
          ),
        },
        { replace: true }
      ),
    [navigate, searchParams]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => goToPage(nextPage),
    [goToPage]
  );

  const refresh = useCallback(async () => {
    // A first read still on its way began before the change, and invalidating
    // would hand back that read: cancel it, so it starts again.
    await queryClient.cancelQueries({ queryKey: incidentGroupsQueryKeyPrefix });
    await queryClient.invalidateQueries({
      queryKey: incidentGroupsQueryKeyPrefix,
    });
  }, [queryClient]);

  return {
    refresh,
    groupBy,
    filters,
    incidentGroups,
    paging,
    sort,
    currentPage,
    pageSize,
    isLoading,
    isError,
    retry,
    detailKey,
    detailGroup,
    isDetailLoading,
    isDetailError,
    retryDetail,
    openGroup,
    closeGroup,
    handleGroupByChange,
    handleFiltersChange,
    handleSortChange: setSort,
    handlePageChange,
    handlePageSizeChange: setPageSize,
  };
};

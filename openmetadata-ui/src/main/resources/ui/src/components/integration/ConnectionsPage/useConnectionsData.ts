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

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ServiceHealth,
  ServiceSummary,
} from '../../../generated/api/services/servicesOverview';
import { Include } from '../../../generated/type/include';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useRouteActivation } from '../../platform/ai-shell/context/useRouteActivation';
import {
  CATEGORY_TO_ENTITY_TYPE,
  ConnectionsServiceCategory,
  CONNECTIONS_ENTITY_TYPES,
  ENTITY_TYPE_TO_CATEGORY,
  LIST_PAGE_SIZE_OPTIONS,
  SERVICES_ESTATE_LIMIT,
} from './ConnectionsPage.constants';
import {
  ESTATE_PARAMS,
  getServicesOverviewQueryOptions,
  SERVICES_OVERVIEW_QUERY_KEY,
} from './useServicesOverview';

export type ConnectionsCategory = ConnectionsServiceCategory | 'all';
export type ConnectionsSortOrder = 'asc' | 'desc';
export type ConnectionsListRow = ServiceSummary;
export type ConnectionsCategoryCounts = Partial<
  Record<ConnectionsServiceCategory, number>
>;

/** How long the server-mode query waits after the last keystroke. */
const SERVER_SEARCH_DEBOUNCE_MS = 500;

/** A filter option and how many services carry it, ready to render in a dropdown. */
export interface ConnectionsFilterOption {
  value: string;
  count: number;
}

interface UseConnectionsDataArgs {
  searchTerm: string;
  category: ConnectionsCategory;
  serviceTypes: string[];
  healthStates: ServiceHealth[];
  /** Show soft-deleted services instead of live ones, matching the classic service list. */
  showDeleted?: boolean;
  pageSizeOptions?: number[];
}

/** An empty selection means "no filter", never "match nothing". */
const matchesSelection = <T>(selected: T[], value: T | undefined) =>
  selected.length === 0 || (value !== undefined && selected.includes(value));

const matchesTerm = (row: ConnectionsListRow, term: string) => {
  const needle = term.trim().toLowerCase();

  return (
    needle === '' ||
    row.name.toLowerCase().includes(needle) ||
    (row.displayName ?? '').toLowerCase().includes(needle)
  );
};

const byValue = (
  first: ConnectionsFilterOption,
  second: ConnectionsFilterOption
) => first.value.localeCompare(second.value);

/** Flattens a per-entity-type count map into one option list for the scopes given. */
const toFilterOptions = (
  nested: Record<string, Record<string, number>> | undefined,
  entityTypes: string[]
): ConnectionsFilterOption[] => {
  const totals = new Map<string, number>();
  entityTypes.forEach((entityType) =>
    Object.entries(nested?.[entityType] ?? {}).forEach(([value, count]) =>
      totals.set(value, (totals.get(value) ?? 0) + count)
    )
  );

  return [...totals.entries()]
    .map(([value, count]) => ({ count, value }))
    .sort(byValue);
};

const tallyBy = (
  rows: ConnectionsListRow[],
  pick: (row: ConnectionsListRow) => string | undefined
): ConnectionsFilterOption[] => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const value = pick(row);
    if (value !== undefined) {
      totals.set(value, (totals.get(value) ?? 0) + 1);
    }
  });

  return [...totals.entries()]
    .map(([value, count]) => ({ count, value }))
    .sort(byValue);
};

const toCategoryCounts = (
  counts: Record<string, number> | undefined
): ConnectionsCategoryCounts => {
  const result: ConnectionsCategoryCounts = {};
  Object.entries(counts ?? {}).forEach(([entityType, count]) => {
    const category = ENTITY_TYPE_TO_CATEGORY[entityType];
    if (category) {
      result[category] = count;
    }
  });

  return result;
};

const countByCategory = (
  rows: ConnectionsListRow[]
): ConnectionsCategoryCounts => {
  const result: ConnectionsCategoryCounts = {};
  rows.forEach((row) => {
    const category = ENTITY_TYPE_TO_CATEGORY[row.entityType];
    if (category) {
      result[category] = (result[category] ?? 0) + 1;
    }
  });

  return result;
};

/**
 * Backs the Connections page off `GET /v1/services/overview`.
 *
 * Below {@link SERVICES_ESTATE_LIMIT} services the whole estate arrives in one request and every
 * subsequent interaction — tab, connector filter, health filter, search, sort, paging — is a
 * `useMemo` over it, costing no network at all. Above it the same endpoint serves a page at a time
 * and those filters go back to the server.
 *
 * The mode is derived from the response's own `total`, which is universe-wide, so `total <= limit`
 * is exactly "this response already holds everything". No probe request and no guess.
 *
 * The two modes are kept behaviourally identical on purpose, because the boundary is invisible to
 * the user: search matches name/displayName case-insensitively in both (the endpoint's `q` is the
 * same predicate), and neither the connector nor the health selection narrows the sidebar badges
 * or either dropdown's own option list — only the search term does.
 */
/* eslint-disable sonarjs/cyclomatic-complexity, sonarjs/cognitive-complexity */
export const useConnectionsData = ({
  searchTerm,
  category,
  serviceTypes,
  healthStates,
  showDeleted = false,
  pageSizeOptions = LIST_PAGE_SIZE_OPTIONS,
}: UseConnectionsDataArgs) => {
  /* eslint-enable sonarjs/cyclomatic-complexity, sonarjs/cognitive-complexity */
  const queryClient = useQueryClient();
  const {
    currentPage: page,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging(pageSizeOptions[0]);
  const [sortOrder, setSortOrder] = useState<ConnectionsSortOrder>('asc');

  // Any change to what is being queried invalidates the current page number. usePaging restores
  // currentPage from the URL rather than resetting it, so without this, switching tab or filter
  // from page 3 stays on page 3: client mode slices past the end and shows an empty list beside a
  // non-zero count, and server mode asks for an offset the narrowed result set no longer has.
  // Sort order is deliberately absent — reordering does not change which rows match.
  const queryKey = [
    category,
    String(showDeleted),
    searchTerm.trim(),
    [...serviceTypes].sort().join(','),
    [...healthStates].sort().join(','),
  ].join(' ');
  const lastQueryKey = useRef(queryKey);
  useEffect(() => {
    if (lastQueryKey.current !== queryKey) {
      lastQueryKey.current = queryKey;
      handlePageChange(1);
    }
  }, [queryKey, handlePageChange]);

  // Only the server query is debounced. Client-side filtering runs over an in-memory list bounded
  // by SERVICES_ESTATE_LIMIT, so delaying it buys nothing and costs the user a lag between typing
  // and seeing results; above the threshold each keystroke would otherwise be a request.
  const [serverSearchTerm, setServerSearchTerm] = useState(searchTerm.trim());
  const commitServerSearch = useMemo(
    () => debounce(setServerSearchTerm, SERVER_SEARCH_DEBOUNCE_MS),
    []
  );

  useEffect(() => {
    commitServerSearch(searchTerm.trim());
  }, [searchTerm, commitServerSearch]);

  useEffect(() => () => commitServerSearch.cancel(), [commitServerSearch]);

  const include = showDeleted ? Include.Deleted : Include.NonDeleted;
  const estate = useQuery(
    getServicesOverviewQueryOptions({ ...ESTATE_PARAMS, include })
  );
  const isClientMode = (estate.data?.total ?? 0) <= SERVICES_ESTATE_LIMIT;

  const pageQuery = useQuery({
    ...getServicesOverviewQueryOptions({
      entityType: CONNECTIONS_ENTITY_TYPES,
      excludeProvider: 'system',
      health: healthStates.length > 0 ? healthStates : undefined,
      include,
      includeHealth: true,
      limit: pageSize,
      listEntityType:
        category === 'all' ? undefined : [CATEGORY_TO_ENTITY_TYPE[category]],
      offset: (page - 1) * pageSize,
      q: serverSearchTerm || undefined,
      serviceType: serviceTypes.length > 0 ? serviceTypes : undefined,
      sortOrder,
    }),
    enabled: !estate.isPending && !isClientMode,
    placeholderData: keepPreviousData,
  });

  const activeResponse = isClientMode ? estate.data : pageQuery.data;

  // Every count below is faceted: it reflects each filter *except* the one it describes. A tab
  // badge answers "how many would I see if I switched to this tab, keeping my filters"; a
  // dropdown option answers "how many would I get if I picked this", which is why it must ignore
  // its own dimension — narrowing a control by its own selection would delete the options next to
  // the chosen one and strand the user.
  const searchScoped = useMemo(
    () =>
      (estate.data?.data ?? []).filter((row) => matchesTerm(row, searchTerm)),
    [estate.data, searchTerm]
  );

  const optionScoped = useMemo(
    () =>
      category === 'all'
        ? searchScoped
        : searchScoped.filter(
            (row) => ENTITY_TYPE_TO_CATEGORY[row.entityType] === category
          ),
    [searchScoped, category]
  );

  // The tab's rows narrowed by one selector each, so the other selector's counts can be taken
  // from them. Together with `visible` these are the three faceted views.
  const healthFacet = useMemo(
    () =>
      optionScoped.filter((row) =>
        matchesSelection(serviceTypes, row.serviceType)
      ),
    [optionScoped, serviceTypes]
  );

  const connectorFacet = useMemo(
    () =>
      optionScoped.filter((row) => matchesSelection(healthStates, row.health)),
    [optionScoped, healthStates]
  );

  // Both selectors applied, minus the tab — what the sidebar badges count.
  const filteredIgnoringTab = useMemo(
    () =>
      searchScoped.filter(
        (row) =>
          matchesSelection(serviceTypes, row.serviceType) &&
          matchesSelection(healthStates, row.health)
      ),
    [searchScoped, serviceTypes, healthStates]
  );

  const visible = useMemo(() => {
    const scoped = optionScoped.filter(
      (row) =>
        matchesSelection(serviceTypes, row.serviceType) &&
        matchesSelection(healthStates, row.health)
    );

    // The endpoint returns a total (name, id) order, so descending is a reverse rather than a
    // re-sort — no client comparator can disagree with the server's collation.
    return sortOrder === 'asc' ? scoped : [...scoped].reverse();
  }, [optionScoped, serviceTypes, healthStates, sortOrder]);

  const rows = useMemo(
    () =>
      isClientMode
        ? visible.slice((page - 1) * pageSize, page * pageSize)
        : pageQuery.data?.data ?? [],
    [isClientMode, visible, page, pageSize, pageQuery.data]
  );

  const optionEntityTypes = useMemo(
    () =>
      category === 'all'
        ? CONNECTIONS_ENTITY_TYPES
        : [CATEGORY_TO_ENTITY_TYPE[category]],
    [category]
  );

  // Counted over the rows the *other* selector already narrowed, so picking a health state
  // updates the connector counts and vice versa, while neither shrinks its own list.
  //
  // Server mode keeps the endpoint's unfaceted maps: they deliberately ignore both selectors, and
  // faceting them would need a query per combination. Above the threshold the counts are therefore
  // estate-wide rather than filter-aware.
  const serviceTypeOptions = useMemo(
    () =>
      isClientMode
        ? tallyBy(connectorFacet, (row) => row.serviceType)
        : toFilterOptions(activeResponse?.serviceTypeCounts, optionEntityTypes),
    [isClientMode, connectorFacet, activeResponse, optionEntityTypes]
  );

  const healthOptions = useMemo(
    () =>
      isClientMode
        ? tallyBy(healthFacet, (row) => row.health)
        : toFilterOptions(activeResponse?.healthCounts, optionEntityTypes),
    [isClientMode, healthFacet, activeResponse, optionEntityTypes]
  );

  // Connectors present on this tab regardless of the search term. serviceTypeOptions is search
  // narrowed on purpose (it drives the dropdown's counts), but pruning against it would delete a
  // selected connector the moment a search excluded it, and clearing the search would not bring it
  // back. The estate request carries no `q`, so its counts are the unsearched view in both modes.
  const serviceTypesInTab = useMemo(
    () =>
      toFilterOptions(estate.data?.serviceTypeCounts, optionEntityTypes).map(
        (option) => option.value
      ),
    [estate.data, optionEntityTypes]
  );

  // Derived, never stored. A stored total survives a tab change and paints the new tab's title
  // beside the previous tab's count for a frame; a derived one recomputes in the same commit that
  // changes the tab, so the two can never disagree.
  const totalRows = isClientMode
    ? visible.length
    : pageQuery.data?.paging?.total ?? 0;

  const categoryCounts = isClientMode
    ? countByCategory(filteredIgnoringTab)
    : toCategoryCounts(activeResponse?.counts);

  // The unnarrowed size of the estate — unlike `totalConnections`, which the search and filters
  // narrow in client mode. Exposed so an onboarding contribution can reuse this query's answer.
  const estateTotal = estate.data?.total ?? 0;

  const totalConnections = isClientMode
    ? filteredIgnoringTab.length
    : activeResponse?.total ?? 0;

  // Returning to a kept-alive page revalidates rather than unconditionally refetching — the TTL
  // decides. A websocket 'dirty' signal or an aged-out cache still forces a fresh read, which is
  // what makes a service created moments ago show up on return.
  useRouteActivation((reason) => {
    if (reason === 'dirty' || reason === 'maxAge') {
      void queryClient.invalidateQueries({
        queryKey: SERVICES_OVERVIEW_QUERY_KEY,
      });

      return;
    }
    void queryClient.prefetchQuery(
      getServicesOverviewQueryOptions({ ...ESTATE_PARAMS, include })
    );
  });

  const toggleSortOrder = () => {
    setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  // Narrow wrappers, not direct re-exports: handlePageChange/handlePageSizeChange's inferred
  // types reference usePaging's unexported CursorState, which breaks declaration emit (TS4023)
  // for this exported hook if returned as-is.
  const setPage = (nextPage: number) => {
    handlePageChange(nextPage);
  };

  const setPageSize = (nextPageSize: number) => {
    handlePageSizeChange(nextPageSize);
  };

  return {
    categoryCounts,
    countsLoading: estate.isPending,
    estateTotal,
    // A failed fetch must not look like an empty estate. Without this the page renders "no data
    // available", which reads as "you have no services" rather than "we could not load them".
    isError: isClientMode
      ? estate.isError
      : estate.isError || pageQuery.isError,
    // keepPreviousData means isPending goes false for good after the first load, so a tab, page or
    // filter change in server mode shows the previous page's rows with nothing to say a new fetch
    // is in flight. This is what the results container reflects while it waits.
    isRefreshing: isClientMode
      ? estate.isFetching && !estate.isPending
      : pageQuery.isFetching && !pageQuery.isPending,
    healthOptions,
    // Not just isPending: placeholderData keeps the previous page's data in place while the new
    // key loads, so isPending stays false and the header would show the new title beside the old
    // tab's count — precisely what deriving totalRows was meant to prevent.
    isCountReady: isClientMode
      ? !estate.isPending
      : !pageQuery.isPending && !pageQuery.isPlaceholderData,
    isLoading: isClientMode ? estate.isPending : pageQuery.isPending,
    page,
    pageSize,
    rows,
    serviceTypeOptions,
    serviceTypesInTab,
    setPage,
    setPageSize,
    sortOrder,
    toggleSortOrder,
    totalConnections,
    totalRows,
  };
};

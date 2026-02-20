/*
 *  Copyright 2024 Collate.
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

import { useCallback, useEffect } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { getAggregations } from '../../../../utils/ExploreUtils';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import { useDataFetching } from '../data/useDataFetching';
import { useSelectionState } from '../data/useSelectionState';
import { useUrlState } from '../data/useUrlState';
import { usePaginationState } from '../pagination/usePaginationState';
import { CellRenderer, ColumnConfig, ListingData } from '../shared/types';
import { useActionHandlers } from './useActionHandlers';

interface UseListingDataProps<T> {
  searchIndex: SearchIndex;
  baseFilter?: string;
  pageSize?: number;
  filterKeys: string[];
  filterConfigs?: ExploreQuickFilterField[];
  columns: ColumnConfig<T>[];
  renderers?: CellRenderer<T>;
  basePath?: string;
  getEntityPath?: (entity: T) => string;
  addPath?: string;
  onCustomEntityClick?: (entity: T) => void;
  onCustomAddClick?: () => void;
  searchKey?: string;
}

export const useListingData = <
  T extends { id: string; name?: string; fullyQualifiedName?: string }
>(
  props: UseListingDataProps<T>
): ListingData<T> => {
  const {
    searchIndex,
    baseFilter = '',
    pageSize = 10,
    filterKeys,
    filterConfigs,
    columns,
    renderers = {},
    basePath,
    getEntityPath,
    addPath,
    onCustomEntityClick,
    onCustomAddClick,
    searchKey,
  } = props;

  const urlStateHook = useUrlState({
    searchKey,
    filterKeys,
    filterConfigs,
    defaultPageSize: pageSize,
  });
  const {
    urlState,
    parsedFilters,
    setSearchQuery,
    setFilters,
    setCurrentPage,
    setPageSize,
  } = urlStateHook;

  const effectivePageSize = urlState.pageSize || pageSize;

  const dataFetching = useDataFetching<T>({
    searchIndex,
    baseFilter,
    pageSize: effectivePageSize,
  });

  const paginationState = usePaginationState({
    currentPage: urlState.currentPage,
    totalEntities: dataFetching.totalEntities,
    pageSize: effectivePageSize,
    onPageChange: setCurrentPage,
  });

  const selectionState = useSelectionState(dataFetching.entities);

  const actionHandlers = useActionHandlers<
    T & { name?: string; fullyQualifiedName?: string }
  >({
    basePath,
    getEntityPath,
    addPath,
    onCustomEntityClick,
    onCustomAddClick,
  });

  useEffect(() => {
    dataFetching.searchEntities(
      urlState.currentPage,
      urlState.searchQuery,
      urlState.filters
    );
  }, [
    urlState.currentPage,
    urlState.searchQuery,
    urlState.filters,
    urlState.pageSize,
    // Note: dataFetching.searchEntities intentionally excluded - we always want the latest version
  ]);

  useEffect(() => {
    selectionState.clearSelection();
  }, [urlState.currentPage, urlState.searchQuery, urlState.filters]);
  // Note: selectionState.clearSelection intentionally excluded - we always want the latest version

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      // Selection will be cleared by the useEffect that watches these changes
    },
    [setSearchQuery]
  );

  const handleFilterChange = useCallback(
    (filters: ExploreQuickFilterField[]) => {
      setFilters(filters);
      // Selection will be cleared by the useEffect that watches these changes
    },
    [setFilters]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      // Selection will be cleared by the useEffect that watches these changes
    },
    [setCurrentPage]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
    },
    [setPageSize]
  );

  // selectedEntities should be an array of IDs, not entities
  const selectedEntities = selectionState.selectedEntities;

  // Refetch function to reload data with current filters
  const refetch = useCallback(() => {
    dataFetching.searchEntities(
      urlState.currentPage,
      urlState.searchQuery,
      urlState.filters
    );
  }, [
    urlState.currentPage,
    urlState.searchQuery,
    urlState.filters,
    dataFetching,
  ]);

  return {
    entities: dataFetching.entities,
    loading: dataFetching.loading,
    totalEntities: dataFetching.totalEntities,
    currentPage: paginationState.currentPage,
    totalPages: paginationState.totalPages,
    pageSize: paginationState.pageSize,
    columns,
    renderers,
    selectedEntities,
    isAllSelected: selectionState.isAllSelected,
    isIndeterminate: selectionState.isIndeterminate,
    handleSelectAll: selectionState.handleSelectAll,
    handleSelect: selectionState.handleSelect,
    isSelected: selectionState.isSelected,
    clearSelection: selectionState.clearSelection,
    urlState,
    parsedFilters,
    actionHandlers,
    filterOptions: {},
    aggregations: getAggregations(dataFetching.aggregations || {}),
    handleSearchChange,
    handleFilterChange,
    handlePageChange,
    handlePageSizeChange,
    refetch,
  };
};

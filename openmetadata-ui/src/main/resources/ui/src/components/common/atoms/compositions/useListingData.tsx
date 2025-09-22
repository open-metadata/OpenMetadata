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

import { useCallback, useEffect, useMemo } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { useDataFetching } from '../data/useDataFetching';
import { useFilterOptions } from '../data/useFilterOptions';
import { useSelectionState } from '../data/useSelectionState';
import { useUrlState } from '../data/useUrlState';
import { usePaginationState } from '../pagination/usePaginationState';
import {
  CellRenderer,
  ColumnConfig,
  FilterField,
  ListingData,
} from '../shared/types';
import { useActionHandlers } from './useActionHandlers';

interface UseListingDataProps<T> {
  searchIndex: SearchIndex;
  baseFilter?: string;
  pageSize?: number;
  filterKeys: string[];
  filterFields: FilterField[];
  queryConfig: Record<string, string>;
  columns: ColumnConfig<T>[];
  renderers?: CellRenderer<T>;
  basePath?: string;
  getEntityPath?: (entity: T) => string;
  addPath?: string;
  onCustomEntityClick?: (entity: T) => void;
  onCustomAddClick?: () => void;
}

export const useListingData = <T extends { id: string }>(
  props: UseListingDataProps<T>
): ListingData<T> => {
  const {
    searchIndex,
    baseFilter = '',
    pageSize = 10,
    filterKeys,
    filterFields,
    queryConfig,
    columns,
    renderers = {},
    basePath,
    getEntityPath,
    addPath,
    onCustomEntityClick,
    onCustomAddClick,
  } = props;

  const urlStateHook = useUrlState({ filterKeys });
  const { urlState, setSearchQuery, setFilters, setCurrentPage } = urlStateHook;

  const dataFetching = useDataFetching<T>({
    searchIndex,
    baseFilter,
    pageSize,
    queryFieldMapping: queryConfig,
  });

  const paginationState = usePaginationState({
    currentPage: urlState.currentPage,
    totalEntities: dataFetching.totalEntities,
    pageSize,
    onPageChange: setCurrentPage,
  });

  const selectionState = useSelectionState(dataFetching.entities);

  const filterOptionsHook = useFilterOptions({
    searchIndex,
    filterFields,
  });

  const actionHandlers = useActionHandlers<T>({
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
    (key: string, values: string[]) => {
      setFilters(key, values);
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

  // Map selected IDs to actual entity objects
  const selectedEntities = useMemo(
    () =>
      dataFetching.entities.filter((entity) =>
        selectionState.selectedEntities.includes(entity.id)
      ),
    [dataFetching.entities, selectionState.selectedEntities]
  );

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
    actionHandlers,
    filterOptions: filterOptionsHook.filterOptions,
    handleSearchChange,
    handleFilterChange,
    handlePageChange,
    searchFilterOptions: filterOptionsHook.searchFilterOptions,
    refetch,
  };
};

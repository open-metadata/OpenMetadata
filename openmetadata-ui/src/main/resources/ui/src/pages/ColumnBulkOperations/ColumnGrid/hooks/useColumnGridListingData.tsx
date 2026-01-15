/*
 *  Copyright 2025 Collate.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelectionState } from '../../../../components/common/atoms/data/useSelectionState';
import { usePaginationState } from '../../../../components/common/atoms/pagination/usePaginationState';
import {
  CellRenderer,
  ColumnConfig,
  ListingData,
} from '../../../../components/common/atoms/shared/types';
import { ExploreQuickFilterField } from '../../../../components/Explore/ExplorePage.interface';
import { TABLE_CARD_PAGE_SIZE } from '../../../../constants/constants';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { ColumnGridItem } from '../../../../generated/api/data/columnGridResponse';
import { getColumnGrid } from '../../../../rest/columnAPI';
import { ColumnGridFilters, ColumnGridRowData } from '../ColumnGrid.interface';

const PAGE_SIZE = TABLE_CARD_PAGE_SIZE;

interface UseColumnGridListingDataProps {
  externalFilters?: ColumnGridFilters;
  transformGridItemsToRows: (
    items: ColumnGridItem[],
    expandedRows: Set<string>,
    expandedStructRows: Set<string>
  ) => ColumnGridRowData[];
  columns: ColumnConfig<ColumnGridRowData>[];
  renderers: CellRenderer<ColumnGridRowData>;
}

export const useColumnGridListingData = (
  props: UseColumnGridListingDataProps
): ListingData<ColumnGridRowData> & {
  totalUniqueColumns: number;
  totalOccurrences: number;
  expandedRows: Set<string>;
  setExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedStructRows: Set<string>;
  setExpandedStructRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  allRows: ColumnGridRowData[];
  setAllRows: React.Dispatch<React.SetStateAction<ColumnGridRowData[]>>;
  gridItems: ColumnGridItem[];
  setGridItems: React.Dispatch<React.SetStateAction<ColumnGridItem[]>>;
} => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [serverFilters] = useState<ColumnGridFilters>(
    props.externalFilters || {}
  );
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<ColumnGridRowData[]>([]);
  const [totalUniqueColumns, setTotalUniqueColumns] = useState(0);
  const [totalOccurrences, setTotalOccurrences] = useState(0);
  const [gridItems, setGridItems] = useState<ColumnGridItem[]>([]);
  const [allRows, setAllRows] = useState<ColumnGridRowData[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedStructRows, setExpandedStructRows] = useState<Set<string>>(
    new Set()
  );
  const [_cursor, setCursor] = useState<string | undefined>();
  const [_hasMore, setHasMore] = useState(false);
  // Use ref to store cursors to avoid infinite loops
  const cursorsByPageRef = useRef<Map<number, string>>(new Map());
  // Store items per page to avoid accumulating across pages
  const itemsByPageRef = useRef<Map<number, ColumnGridItem[]>>(new Map());
  const previousFiltersRef = useRef<string>('');
  // Store the total from first page - this is the overall total for pagination
  const totalUniqueColumnsRef = useRef<number>(0);
  const totalOccurrencesRef = useRef<number>(0);
  // Removed accumulation logic - we'll just filter current page data

  // URL state management
  const urlState = useMemo(() => {
    const searchQuery = searchParams.get('q') || '';
    const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Number.parseInt(
      searchParams.get('size') || String(PAGE_SIZE),
      10
    );

    const filters: Record<string, string[]> = {};
    const filterKeys = [EntityFields.ENTITY_TYPE, EntityFields.SERVICE];
    filterKeys.forEach((key) => {
      const filterValue = searchParams.get(key);
      filters[key] = filterValue ? filterValue.split(',').filter(Boolean) : [];
    });

    // Get dataType and metadataStatus from URL params (not EntityFields, so handled separately)
    const dataType = searchParams.get('dataType') || undefined;
    const metadataStatusParam = searchParams.get('metadataStatus');
    const metadataStatus = metadataStatusParam
      ? metadataStatusParam.split(',').filter(Boolean)
      : undefined;

    return {
      searchQuery,
      filters,
      currentPage,
      pageSize,
      dataType,
      metadataStatus,
    };
  }, [searchParams]);

  const parsedFilters: ExploreQuickFilterField[] = useMemo(() => {
    return [
      {
        key: EntityFields.ENTITY_TYPE,
        label: 'label.asset-type',
        value: (urlState.filters[EntityFields.ENTITY_TYPE] || []).map((v) => ({
          key: v,
          label: v,
        })),
      },
      {
        key: EntityFields.SERVICE,
        label: 'label.service',
        value: (urlState.filters[EntityFields.SERVICE] || []).map((v) => ({
          key: v,
          label: v,
        })),
      },
    ];
  }, [urlState.filters]);

  // Selection state
  const selectionState = useSelectionState(entities);

  // Pagination state - use backend total (client-side filters work on current page only)
  const effectiveTotal = totalUniqueColumnsRef.current || totalUniqueColumns;

  const paginationState = usePaginationState({
    currentPage: urlState.currentPage,
    totalEntities: effectiveTotal,
    pageSize: urlState.pageSize,
    onPageChange: (page) => {
      const newParams = new URLSearchParams(searchParams);
      if (page > 1) {
        newParams.set('page', page.toString());
      } else {
        newParams.delete('page');
      }
      setSearchParams(newParams);
    },
  });

  // Convert URL filters to ColumnGridFilters
  // Note: dataType and metadataStatus are NOT sent to backend (not supported yet)
  // They are applied client-side only on the loaded data
  const columnGridFilters = useMemo<ColumnGridFilters>(() => {
    const filters: ColumnGridFilters = {
      ...serverFilters,
      entityTypes: urlState.filters[EntityFields.ENTITY_TYPE],
      serviceName: urlState.filters[EntityFields.SERVICE]?.[0],
      // dataType and metadataStatus are filtered client-side, not sent to backend
    };

    return filters;
  }, [
    serverFilters,
    urlState.filters,
    // Note: urlState.dataType and urlState.metadataStatus are intentionally excluded
    // as they are not supported by the backend API and are filtered client-side
  ]);

  // Load data function - adapts cursor-based to page-based
  // Backend API: Uses cursor-based pagination
  // - Page 1 (no cursor): Returns overall totalUniqueColumns and totalOccurrences
  // - Subsequent pages (with cursor): May return remaining counts, not overall totals
  // Solution: Always use the total from page 1 for pagination calculations
  const loadData = useCallback(
    async (
      page: number,
      _searchQuery: string,
      filters: ColumnGridFilters,
      pageSize: number
    ) => {
      setLoading(true);
      try {
        // For page 1, start fresh (no cursor). For other pages, use stored cursor from previous page
        const pageCursor =
          page === 1 ? undefined : cursorsByPageRef.current.get(page - 1);

        // Build API request with all filters
        const apiParams = {
          size: pageSize,
          cursor: pageCursor,
          ...filters,
        };

        // Log the API request for debugging
        // Uncomment for debugging:
        // console.log('ColumnGrid API Request:', {
        //   url: '/columns/grid',
        //   params: apiParams,
        //   queryString: new URLSearchParams(
        //     Object.entries(apiParams).reduce((acc, [key, value]) => {
        //       if (value !== undefined && value !== null) {
        //         if (Array.isArray(value)) {
        //           acc[key] = value.join(',');
        //         } else {
        //           acc[key] = String(value);
        //         }
        //       }
        //       return acc;
        //     }, {} as Record<string, string>)
        //   ).toString(),
        // });

        const response = await getColumnGrid(apiParams);

        // Store items for this specific page
        itemsByPageRef.current.set(page, response.columns);

        // Store cursor for next page (this page's response cursor is for page + 1)
        // The cursor is stored at the current page index, so page 1's cursor is at index 1
        if (response.cursor) {
          cursorsByPageRef.current.set(page, response.cursor);
        }

        // Set grid items - when client-side filters are active, this will trigger accumulation
        // When not using client-side filters, this is the current page's items
        setGridItems(response.columns);

        // Backend behavior:
        // - Page 1 (no cursor): Returns overall totals (e.g., totalUniqueColumns: 489)
        // - Page 2+ (with cursor): May return remaining totals (e.g., totalUniqueColumns: 9)
        // We always use the overall total from page 1 for pagination UI
        if (page === 1) {
          // Store the overall total from first page - this is the true total for pagination
          totalUniqueColumnsRef.current = response.totalUniqueColumns;
          totalOccurrencesRef.current = response.totalOccurrences;
          setTotalUniqueColumns(response.totalUniqueColumns);
          setTotalOccurrences(response.totalOccurrences);
        } else {
          // For subsequent pages, keep using the stored overall total from page 1
          // Don't update with the page-specific (remaining) total from backend
          setTotalUniqueColumns(totalUniqueColumnsRef.current);
          setTotalOccurrences(totalOccurrencesRef.current);
        }

        setCursor(response.cursor);
        setHasMore(!!response.cursor);
      } catch (error) {
        // Clear data on error - will show no data placeholder
        setGridItems([]);
        setEntities([]);
        setAllRows([]);
        setTotalUniqueColumns(0);
        setTotalOccurrences(0);

        // Error handling - can be logged to error tracking service
        // In production, this should be sent to an error tracking service
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Error loading column grid:', error);
        }
      } finally {
        setLoading(false);
      }
    },
    [] // No dependencies - all values passed as parameters
  );

  // Helper function to apply client-side filters
  const applyClientSideFilters = useCallback(
    (rows: ColumnGridRowData[]): ColumnGridRowData[] => {
      let filtered = rows;

      // Apply search filter
      if (urlState.searchQuery) {
        const searchLower = urlState.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (row) =>
            row.columnName?.toLowerCase().includes(searchLower) ||
            row.displayName?.toLowerCase().includes(searchLower) ||
            row.description?.toLowerCase().includes(searchLower) ||
            row.dataType?.toLowerCase().includes(searchLower)
        );
      }

      // Apply dataType filter
      if (urlState.dataType) {
        filtered = filtered.filter(
          (row) =>
            row.dataType?.toUpperCase() === urlState.dataType?.toUpperCase()
        );
      }

      // Apply metadataStatus filter
      if (urlState.metadataStatus && urlState.metadataStatus.length > 0) {
        filtered = filtered.filter((row) => {
          // Determine metadata status based on description presence
          const hasDescription =
            row.description && row.description.trim().length > 0;
          const status = hasDescription ? 'COMPLETE' : 'MISSING';

          // Check if row matches any of the selected statuses
          return urlState.metadataStatus?.some((selectedStatus) => {
            const statusUpper = selectedStatus.toUpperCase();
            if (statusUpper === 'COMPLETE') {
              return hasDescription;
            }
            if (statusUpper === 'MISSING' || statusUpper === 'INCOMPLETE') {
              return !hasDescription;
            }

            // For other statuses (PARTIAL, REVIEWED, APPROVED), we'd need more logic
            // based on additional metadata fields
            return statusUpper === status;
          });
        });
      }

      return filtered;
    },
    [urlState.searchQuery, urlState.dataType, urlState.metadataStatus]
  );

  // Transform grid items to rows and apply filtering
  useEffect(() => {
    if (gridItems.length > 0) {
      const transformedRows = props.transformGridItemsToRows(
        gridItems,
        expandedRows,
        expandedStructRows
      );
      setAllRows(transformedRows);

      // Apply filters (search + client-side filters if active)
      const filtered = applyClientSideFilters(transformedRows);

      setEntities(filtered);
    } else {
      setAllRows([]);
      setEntities([]);
    }
  }, [
    gridItems,
    urlState.searchQuery,
    urlState.dataType,
    urlState.metadataStatus,
    expandedRows,
    expandedStructRows,
    props.transformGridItemsToRows,
    applyClientSideFilters,
  ]);

  // Load data when filters or page changes - similar to domain list pattern
  useEffect(() => {
    // Check if filters have changed by comparing stringified version
    const currentFiltersString = JSON.stringify({
      ...columnGridFilters,
      dataType: urlState.dataType,
      metadataStatus: urlState.metadataStatus,
    });
    const filtersChanged = previousFiltersRef.current !== currentFiltersString;

    // Reset cursors and items when filters change
    if (filtersChanged) {
      cursorsByPageRef.current = new Map();
      itemsByPageRef.current = new Map();
      totalUniqueColumnsRef.current = 0;
      totalOccurrencesRef.current = 0;
      setGridItems([]); // Clear current items
      setTotalUniqueColumns(0);
      setTotalOccurrences(0);
      previousFiltersRef.current = currentFiltersString;
    }

    // Always use normal backend pagination
    // Client-side filters (dataType, metadataStatus) are applied to the loaded data only
    // This prevents infinite API calls
    const cachedItems = itemsByPageRef.current.get(urlState.currentPage);
    if (cachedItems && !filtersChanged) {
      // Use cached items for this page
      setGridItems(cachedItems);
    } else {
      // Load data when URL state changes (page, search, filters, pageSize)
      // Note: dataType and metadataStatus are NOT sent to backend (filtered client-side)
      loadData(
        urlState.currentPage,
        urlState.searchQuery,
        columnGridFilters,
        urlState.pageSize
      );
    }
  }, [
    urlState.currentPage,
    urlState.searchQuery,
    urlState.pageSize,
    columnGridFilters,
    loadData,
  ]);

  // Clear selection when filters/search change
  useEffect(() => {
    selectionState.clearSelection();
  }, [urlState.currentPage, urlState.searchQuery, urlState.filters]);

  const handleSearchChange = useCallback(
    (query: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (query) {
        newParams.set('q', query);
      } else {
        newParams.delete('q');
      }
      newParams.delete('page');
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (filters: ExploreQuickFilterField[]) => {
      const newParams = new URLSearchParams(searchParams);
      filters.forEach((filter) => {
        const values = filter.value?.map((v) => v.key) || [];
        if (values.length > 0) {
          newParams.set(filter.key, values.join(','));
        } else {
          newParams.delete(filter.key);
        }
      });
      newParams.delete('page');
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const newParams = new URLSearchParams(searchParams);
      if (page > 1) {
        newParams.set('page', page.toString());
      } else {
        newParams.delete('page');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      const newParams = new URLSearchParams(searchParams);
      if (size !== PAGE_SIZE) {
        newParams.set('size', size.toString());
      } else {
        newParams.delete('size');
      }
      newParams.delete('page');
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const refetch = useCallback(() => {
    loadData(
      urlState.currentPage,
      urlState.searchQuery,
      columnGridFilters,
      urlState.pageSize
    );
  }, [
    urlState.currentPage,
    urlState.searchQuery,
    urlState.pageSize,
    columnGridFilters,
    loadData,
  ]);

  return {
    entities,
    loading,
    totalEntities: totalUniqueColumns,
    currentPage: paginationState.currentPage,
    totalPages: paginationState.totalPages,
    pageSize: paginationState.pageSize,
    columns: props.columns,
    renderers: props.renderers,
    selectedEntities: selectionState.selectedEntities,
    isAllSelected: selectionState.isAllSelected,
    isIndeterminate: selectionState.isIndeterminate,
    handleSelectAll: selectionState.handleSelectAll,
    handleSelect: selectionState.handleSelect,
    isSelected: selectionState.isSelected,
    clearSelection: selectionState.clearSelection,
    urlState,
    parsedFilters,
    actionHandlers: {
      onEntityClick: () => {},
    },
    filterOptions: {},
    aggregations: null,
    handleSearchChange,
    handleFilterChange,
    handlePageChange,
    handlePageSizeChange,
    refetch,
    // Custom properties for ColumnGrid
    totalUniqueColumns,
    totalOccurrences,
    expandedRows,
    setExpandedRows,
    expandedStructRows,
    setExpandedStructRows,
    allRows,
    setAllRows,
    gridItems,
    setGridItems,
  };
};

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
import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { ColumnGridItem } from '../../../../generated/api/data/columnGridResponse';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { getColumnGrid } from '../../../../rest/columnAPI';
import { ColumnGridFilters, ColumnGridRowData } from '../ColumnGrid.interface';
import {
  COLUMN_GLOSSARY_FIELD,
  COLUMN_GRID_FILTERS,
  COLUMN_TAG_FIELD,
  convertFilterValuesToOptions,
} from '../constants/ColumnGrid.constants';

const PAGE_SIZE = PAGE_SIZE_MEDIUM;

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
  clearEditedValues: () => void;
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

  // Local pagination state (cursor-based, not in URL)
  const [currentPage, setCurrentPage] = useState(1);

  // URL state management (search and filters only, pagination is local)
  const urlState = useMemo(() => {
    const searchQuery = searchParams.get('q') || '';

    const filters: Record<string, string[]> = {};
    const filterKeys = [
      EntityFields.ENTITY_TYPE,
      EntityFields.SERVICE,
      EntityFields.DOMAINS,
      'metadataStatus',
      COLUMN_TAG_FIELD,
      COLUMN_GLOSSARY_FIELD,
    ];
    filterKeys.forEach((key) => {
      const filterValue = searchParams.get(key);
      filters[key] = filterValue ? filterValue.split(',').filter(Boolean) : [];
    });

    return {
      searchQuery,
      filters,
      currentPage,
      pageSize: PAGE_SIZE,
    };
  }, [searchParams, currentPage]);

  const parsedFilters: ExploreQuickFilterField[] = useMemo(() => {
    return COLUMN_GRID_FILTERS.map((filter) => ({
      ...filter,
      value: convertFilterValuesToOptions(
        filter.key,
        urlState.filters[filter.key] || []
      ),
    }));
  }, [urlState.filters]);

  // Selection state
  const selectionState = useSelectionState(entities);

  // Pagination state - use backend total (client-side filters work on current page only)
  const effectiveTotal = totalUniqueColumnsRef.current || totalUniqueColumns;

  const paginationState = usePaginationState({
    currentPage: urlState.currentPage,
    totalEntities: effectiveTotal,
    pageSize: urlState.pageSize,
    onPageChange: setCurrentPage,
  });

  // Convert URL filters to ColumnGridFilters
  const columnGridFilters = useMemo<ColumnGridFilters>(() => {
    const filters: ColumnGridFilters = {
      ...serverFilters,
      entityTypes: urlState.filters[EntityFields.ENTITY_TYPE],
      serviceName: urlState.filters[EntityFields.SERVICE]?.[0],
      domainId: urlState.filters[EntityFields.DOMAINS]?.[0],
      metadataStatus: urlState.filters['metadataStatus'],
      tags: urlState.filters[COLUMN_TAG_FIELD],
      glossaryTerms: urlState.filters[COLUMN_GLOSSARY_FIELD],
    };

    return filters;
  }, [serverFilters, urlState.filters]);

  // Load data function - adapts cursor-based to page-based
  // Backend API: Uses cursor-based pagination
  // - Page 1 (no cursor): Returns overall totalUniqueColumns and totalOccurrences
  // - Subsequent pages (with cursor): May return remaining counts, not overall totals
  // Solution: Always use the total from page 1 for pagination calculations
  const loadData = useCallback(
    async (
      page: number,
      searchQuery: string,
      filters: ColumnGridFilters,
      pageSize: number
    ) => {
      setLoading(true);
      try {
        // For page 1, start fresh (no cursor). For other pages, use stored cursor from previous page
        const pageCursor =
          page === 1 ? undefined : cursorsByPageRef.current.get(page - 1);

        const apiParams: ColumnGridFilters & { size: number; cursor?: string } =
          {
            size: pageSize,
            cursor: pageCursor,
            ...filters,
            ...(searchQuery && { columnNamePattern: searchQuery }),
          };

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

  const applyClientSideFilters = useCallback(
    (rows: ColumnGridRowData[]): ColumnGridRowData[] => {
      return rows;
    },
    []
  );

  // Ref to track edited values across row regenerations
  const editedValuesRef = useRef<
    Map<
      string,
      {
        editedDisplayName?: string;
        editedDescription?: string;
        editedTags?: TagLabel[];
      }
    >
  >(new Map());

  // Transform grid items to rows and apply filtering
  // IMPORTANT: Preserve edited values when rows are regenerated (e.g., on expand/collapse)
  useEffect(() => {
    if (gridItems.length > 0) {
      const transformedRows = props.transformGridItemsToRows(
        gridItems,
        expandedRows,
        expandedStructRows
      );

      // Merge edited values from ref into transformed rows
      const rowsWithEdits =
        editedValuesRef.current.size > 0
          ? transformedRows.map((row) => {
              const editedValues = editedValuesRef.current.get(row.id);
              if (editedValues) {
                return { ...row, ...editedValues };
              }

              return row;
            })
          : transformedRows;

      setAllRows(rowsWithEdits);
      setEntities(applyClientSideFilters(rowsWithEdits));
    } else {
      setAllRows([]);
      setEntities([]);
    }
  }, [
    gridItems,
    urlState.searchQuery,
    urlState.filters,
    expandedRows,
    expandedStructRows,
    props.transformGridItemsToRows,
    applyClientSideFilters,
  ]);

  // Track edited values in ref when allRows changes
  // This ensures edits persist across row regenerations
  useEffect(() => {
    allRows.forEach((row) => {
      if (
        row.editedDisplayName !== undefined ||
        row.editedDescription !== undefined ||
        row.editedTags !== undefined
      ) {
        editedValuesRef.current.set(row.id, {
          editedDisplayName: row.editedDisplayName,
          editedDescription: row.editedDescription,
          editedTags: row.editedTags,
        });
      } else {
        // Remove from ref if no edited values
        editedValuesRef.current.delete(row.id);
      }
    });
  }, [allRows]);

  useEffect(() => {
    const currentFiltersString = JSON.stringify({
      ...columnGridFilters,
      searchQuery: urlState.searchQuery,
    });
    const filtersChanged = previousFiltersRef.current !== currentFiltersString;

    // Reset cursors, items, and edited values when filters change
    if (filtersChanged) {
      cursorsByPageRef.current = new Map();
      itemsByPageRef.current = new Map();
      totalUniqueColumnsRef.current = 0;
      totalOccurrencesRef.current = 0;
      editedValuesRef.current = new Map(); // Clear edited values
      setGridItems([]); // Clear current items
      setTotalUniqueColumns(0);
      setTotalOccurrences(0);
      previousFiltersRef.current = currentFiltersString;
    }

    const cachedItems = itemsByPageRef.current.get(urlState.currentPage);
    if (cachedItems && !filtersChanged) {
      setGridItems(cachedItems);
    } else {
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
      setSearchParams(newParams);
      setCurrentPage(1);
    },
    [searchParams, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (filters: ExploreQuickFilterField[]) => {
      const newParams = new URLSearchParams(searchParams);

      // Get the filter keys that are being updated
      const filterKeysToUpdate = filters.map((f) => f.key);

      // Clear only the filters that are being updated
      filterKeysToUpdate.forEach((key) => {
        newParams.delete(key);
      });

      // Then set the new filter values
      filters.forEach((filter) => {
        const values = filter.value?.map((v) => v.key) || [];
        if (values.length > 0) {
          newParams.set(filter.key, values.join(','));
        }
      });

      setSearchParams(newParams);
      setCurrentPage(1);
    },
    [searchParams, setSearchParams]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((_size: number) => {
    setCurrentPage(1);
  }, []);

  const refetch = useCallback(() => {
    // Clear ALL caches to ensure fresh data is fetched from the server
    // This is especially important after bulk updates when the search index
    // has been refreshed with new data
    cursorsByPageRef.current = new Map();
    itemsByPageRef.current = new Map();
    totalUniqueColumnsRef.current = 0;
    totalOccurrencesRef.current = 0;

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

  // Clear all edited values (call after successful bulk update)
  const clearEditedValues = useCallback(() => {
    editedValuesRef.current = new Map();
  }, []);

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
    clearEditedValues,
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

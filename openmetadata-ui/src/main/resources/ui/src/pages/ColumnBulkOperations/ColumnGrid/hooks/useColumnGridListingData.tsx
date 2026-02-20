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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { showErrorToast } from '../../../../utils/ToastUtils';
import { ColumnGridFilters, ColumnGridRowData } from '../ColumnGrid.interface';
import {
  COLUMN_GLOSSARY_FIELD,
  COLUMN_GRID_FILTERS,
  COLUMN_TAG_FIELD,
  convertFilterValuesToOptions,
  MAX_REFETCH_CHAIN_PAGES,
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
  const { t } = useTranslation();
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
  const refetchInProgressRef = useRef(false);
  const needsRefetchAgainRef = useRef(false);
  const latestRequestIdRef = useRef(0);

  // Local pagination state (cursor-based, not in URL)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // URL state management (search and filters only, pagination is local)
  const urlState = useMemo(() => {
    const searchQuery = searchParams.get('q') || '';

    const filters: Record<string, string[]> = {};
    const filterKeys = [
      EntityFields.ENTITY_TYPE,
      EntityFields.SERVICE,
      EntityFields.SERVICE_TYPE,
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
      pageSize,
    };
  }, [searchParams, currentPage, pageSize]);

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
      serviceTypes: urlState.filters[EntityFields.SERVICE_TYPE],
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
      pageSize: number,
      options?: {
        /** When true, fetch and store cursor/totals but do not update grid - used when chaining to reach page N */
        skipGridItemsUpdate?: boolean;
        /** When true, rethrow on error so caller can handle (e.g. fallback when cached cursor is invalid) */
        rethrowOnError?: boolean;
      }
    ) => {
      const requestId = ++latestRequestIdRef.current;
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

        // Ignore stale out-of-order responses when a newer search/filter/page
        // request is already in flight.
        if (requestId !== latestRequestIdRef.current) {
          return;
        }

        // Store items for this specific page
        itemsByPageRef.current.set(page, response.columns);

        // Store cursor for next page (this page's response cursor is for page + 1)
        // The cursor is stored at the current page index, so page 1's cursor is at index 1
        if (response.cursor) {
          cursorsByPageRef.current.set(page, response.cursor);
        }

        if (!options?.skipGridItemsUpdate) {
          setGridItems(response.columns);
        }

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
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        if (!options?.rethrowOnError) {
          showErrorToast(
            error as AxiosError,
            t('server.entity-fetch-error', {
              entity: t('label.column-lowercase-plural'),
            })
          );
        }
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Error loading column grid:', error);
        }
        if (options?.rethrowOnError) {
          throw error;
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const applyClientSideFilters = useCallback(
    (rows: ColumnGridRowData[]): ColumnGridRowData[] => {
      return rows;
    },
    []
  );

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

  useEffect(() => {
    if (gridItems.length > 0) {
      const transformedRows = props.transformGridItemsToRows(
        gridItems,
        expandedRows,
        expandedStructRows
      );

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
    } else {
      setAllRows([]);
    }
  }, [
    gridItems,
    urlState.searchQuery,
    urlState.filters,
    expandedRows,
    expandedStructRows,
    props.transformGridItemsToRows,
  ]);

  useEffect(() => {
    setEntities(applyClientSideFilters(allRows));
  }, [allRows, applyClientSideFilters]);

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
        editedValuesRef.current.delete(row.id);
      }
    });
  }, [allRows]);

  useEffect(() => {
    const currentFiltersString = JSON.stringify(
      urlState.searchQuery + JSON.stringify(urlState.filters)
    );
    const filtersChanged = previousFiltersRef.current !== currentFiltersString;
    previousFiltersRef.current = currentFiltersString;

    if (filtersChanged) {
      cursorsByPageRef.current = new Map();
      itemsByPageRef.current = new Map();
      totalUniqueColumnsRef.current = 0;
      totalOccurrencesRef.current = 0;
      editedValuesRef.current = new Map();
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

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    cursorsByPageRef.current = new Map();
    itemsByPageRef.current = new Map();
    totalUniqueColumnsRef.current = 0;
    totalOccurrencesRef.current = 0;
  }, []);

  /**
   * Refetch after bulk update (WebSocket job complete).
   * 1) Load page 1 (totals + cursor). 2) If target page > 1: try cached cursor, else chain pages 2..N.
   * 3) On any error: toast + fallback to page 1. 4) If target > MAX_REFETCH_CHAIN_PAGES: show page 1 + toast.
   * 5) Concurrent calls are queued via needsRefetchAgainRef.
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (refetchInProgressRef.current) {
      needsRefetchAgainRef.current = true;

      return;
    }
    refetchInProgressRef.current = true;

    const clearCaches = () => {
      cursorsByPageRef.current = new Map();
      itemsByPageRef.current = new Map();
      totalUniqueColumnsRef.current = 0;
      totalOccurrencesRef.current = 0;
    };

    const loadPage1 = (skipGrid = false) =>
      loadData(1, urlState.searchQuery, columnGridFilters, urlState.pageSize, {
        skipGridItemsUpdate: skipGrid,
        rethrowOnError: true,
      });

    const recoverToPage1 = () => {
      showErrorToast(t('server.unexpected-response'));
      setCurrentPage(1);

      return loadData(
        1,
        urlState.searchQuery,
        columnGridFilters,
        urlState.pageSize
      );
    };

    try {
      const pageToRestore = urlState.currentPage;
      const savedCursors = new Map(cursorsByPageRef.current);
      clearCaches();

      const skipGrid = { skipGridItemsUpdate: true };

      try {
        await loadPage1(pageToRestore > 1);

        const total = totalUniqueColumnsRef.current;
        const newTotalPages = Math.max(1, Math.ceil(total / urlState.pageSize));
        const effectivePage = Math.min(pageToRestore, newTotalPages);

        if (effectivePage !== pageToRestore) {
          setCurrentPage(effectivePage);
        }

        if (effectivePage > MAX_REFETCH_CHAIN_PAGES) {
          setCurrentPage(1);
          const page1Items = itemsByPageRef.current.get(1);
          if (page1Items) {
            setGridItems(page1Items);
          }
          showErrorToast(t('message.please-refresh-the-page'));
        } else if (effectivePage > 1) {
          const cachedCursor = savedCursors.get(effectivePage - 1);
          let usedCachedCursor = false;

          if (cachedCursor) {
            try {
              cursorsByPageRef.current.set(effectivePage - 1, cachedCursor);
              await loadData(
                effectivePage,
                urlState.searchQuery,
                columnGridFilters,
                urlState.pageSize,
                { rethrowOnError: true }
              );
              usedCachedCursor = true;
            } catch {
              cursorsByPageRef.current.delete(effectivePage - 1);
            }
          }

          if (!usedCachedCursor) {
            for (let page = 2; page < effectivePage; page++) {
              await loadData(
                page,
                urlState.searchQuery,
                columnGridFilters,
                urlState.pageSize,
                { ...skipGrid, rethrowOnError: true }
              );
            }
            await loadData(
              effectivePage,
              urlState.searchQuery,
              columnGridFilters,
              urlState.pageSize
            );
          }
        } else if (pageToRestore > 1) {
          const page1Items = itemsByPageRef.current.get(1);
          if (page1Items) {
            setGridItems(page1Items);
          }
        }
      } catch {
        await recoverToPage1();
      }
    } finally {
      refetchInProgressRef.current = false;
      if (needsRefetchAgainRef.current) {
        needsRefetchAgainRef.current = false;
        setTimeout(() => refetch(), 0);
      }
    }
  }, [
    urlState.currentPage,
    urlState.searchQuery,
    urlState.pageSize,
    columnGridFilters,
    loadData,
    t,
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

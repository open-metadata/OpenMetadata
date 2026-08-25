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

import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../../../enums/search.enum';
import { useListingData } from './useListingData';

// Mock dependencies
jest.mock('../data/useUrlState');
jest.mock('../data/useDataFetching');
jest.mock('../data/useSelectionState');
jest.mock('../pagination/usePaginationState');
jest.mock('./useActionHandlers');

import { useDataFetching } from '../data/useDataFetching';
import { useSelectionState } from '../data/useSelectionState';
import { useUrlState } from '../data/useUrlState';
import { usePaginationState } from '../pagination/usePaginationState';
import { useActionHandlers } from './useActionHandlers';

const mockSetPageSize = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockSetFilters = jest.fn();
const mockSetCurrentPage = jest.fn();

const mockUseUrlState = useUrlState as jest.MockedFunction<typeof useUrlState>;
const mockUseDataFetching = useDataFetching as jest.MockedFunction<
  typeof useDataFetching
>;
const mockUseSelectionState = useSelectionState as jest.MockedFunction<
  typeof useSelectionState
>;
const mockUsePaginationState = usePaginationState as jest.MockedFunction<
  typeof usePaginationState
>;
const mockUseActionHandlers = useActionHandlers as jest.MockedFunction<
  typeof useActionHandlers
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useListingData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseUrlState.mockReturnValue({
      urlState: {
        searchQuery: '',
        filters: {},
        currentPage: 1,
        pageSize: 10,
      },
      parsedFilters: [],
      setSearchQuery: mockSetSearchQuery,
      setFilters: mockSetFilters,
      setCurrentPage: mockSetCurrentPage,
      setPageSize: mockSetPageSize,
      resetFilters: jest.fn(),
      resetAll: jest.fn(),
    });

    mockUseDataFetching.mockReturnValue({
      entities: [],
      loading: false,
      error: null,
      totalEntities: 0,
      refetch: jest.fn(),
      searchEntities: jest.fn(),
      aggregations: {},
    });

    mockUseSelectionState.mockReturnValue({
      selectedEntities: [],
      isAllSelected: false,
      isIndeterminate: false,
      handleSelectAll: jest.fn(),
      handleSelect: jest.fn(),
      clearSelection: jest.fn(),
      isSelected: jest.fn(),
    });

    mockUsePaginationState.mockReturnValue({
      currentPage: 1,
      totalPages: 1,
      pageSize: 10,
      totalEntities: 0,
      setCurrentPage: jest.fn(),
    });

    mockUseActionHandlers.mockReturnValue({
      onEntityClick: jest.fn(),
      onAddClick: jest.fn(),
      onDeleteClick: jest.fn(),
      onEditClick: jest.fn(),
    });
  });

  describe('handlePageSizeChange', () => {
    it('should call setPageSize with the provided size', () => {
      const { result } = renderHook(
        () =>
          useListingData({
            searchIndex: SearchIndex.TABLE,
            filterKeys: [],
            columns: [],
            pageSize: 10,
          }),
        { wrapper }
      );

      act(() => {
        result.current.handlePageSizeChange?.(25);
      });

      expect(mockSetPageSize).toHaveBeenCalledWith(25);
      expect(mockSetPageSize).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple page size changes', () => {
      const { result } = renderHook(
        () =>
          useListingData({
            searchIndex: SearchIndex.TABLE,
            filterKeys: [],
            columns: [],
            pageSize: 10,
          }),
        { wrapper }
      );

      act(() => {
        result.current.handlePageSizeChange?.(25);
      });

      act(() => {
        result.current.handlePageSizeChange?.(50);
      });

      act(() => {
        result.current.handlePageSizeChange?.(10);
      });

      expect(mockSetPageSize).toHaveBeenCalledTimes(3);
      expect(mockSetPageSize).toHaveBeenNthCalledWith(1, 25);
      expect(mockSetPageSize).toHaveBeenNthCalledWith(2, 50);
      expect(mockSetPageSize).toHaveBeenNthCalledWith(3, 10);
    });

    it('should delegate to setPageSize which resets page to 1', () => {
      mockSetPageSize.mockImplementation(() => {
        // Simulate the behavior of setPageSize in useUrlState
        // which sets page to '1' when page size changes
      });

      const { result } = renderHook(
        () =>
          useListingData({
            searchIndex: SearchIndex.TABLE,
            filterKeys: [],
            columns: [],
            pageSize: 10,
          }),
        { wrapper }
      );

      // Simulate being on page 3
      mockUseUrlState.mockReturnValue({
        urlState: {
          searchQuery: '',
          filters: {},
          currentPage: 3,
          pageSize: 10,
        },
        parsedFilters: [],
        setSearchQuery: mockSetSearchQuery,
        setFilters: mockSetFilters,
        setCurrentPage: mockSetCurrentPage,
        setPageSize: mockSetPageSize,
        resetFilters: jest.fn(),
        resetAll: jest.fn(),
      });

      act(() => {
        result.current.handlePageSizeChange?.(25);
      });

      expect(mockSetPageSize).toHaveBeenCalledWith(25);
      // The setPageSize function should reset page to 1
      // This is tested in useUrlState.test.tsx
    });

    it('should be defined when useListingData is called', () => {
      const { result } = renderHook(
        () =>
          useListingData({
            searchIndex: SearchIndex.TABLE,
            filterKeys: [],
            columns: [],
            pageSize: 10,
          }),
        { wrapper }
      );

      expect(result.current.handlePageSizeChange).toBeDefined();
      expect(typeof result.current.handlePageSizeChange).toBe('function');
    });
  });

  describe('effectivePageSize fallback', () => {
    it('should use urlState.pageSize when available', () => {
      mockUseUrlState.mockReturnValueOnce({
        urlState: {
          searchQuery: '',
          filters: {},
          currentPage: 1,
          pageSize: 25,
        },
        parsedFilters: [],
        setSearchQuery: mockSetSearchQuery,
        setFilters: mockSetFilters,
        setCurrentPage: mockSetCurrentPage,
        setPageSize: mockSetPageSize,
        resetFilters: jest.fn(),
        resetAll: jest.fn(),
      });

      mockUsePaginationState.mockReturnValueOnce({
        currentPage: 1,
        totalPages: 1,
        pageSize: 25,
        totalEntities: 0,
        setCurrentPage: jest.fn(),
      });

      const { result } = renderHook(
        () =>
          useListingData({
            searchIndex: SearchIndex.TABLE,
            filterKeys: [],
            columns: [],
            pageSize: 10,
          }),
        { wrapper }
      );

      expect(result.current.pageSize).toBe(25);
      expect(mockUseDataFetching).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 25,
        })
      );
    });

    it('should fallback to props.pageSize when urlState.pageSize is 0', () => {
      mockUseUrlState.mockReturnValueOnce({
        urlState: {
          searchQuery: '',
          filters: {},
          currentPage: 1,
          pageSize: 0,
        },
        parsedFilters: [],
        setSearchQuery: mockSetSearchQuery,
        setFilters: mockSetFilters,
        setCurrentPage: mockSetCurrentPage,
        setPageSize: mockSetPageSize,
        resetFilters: jest.fn(),
        resetAll: jest.fn(),
      });

      mockUsePaginationState.mockReturnValueOnce({
        currentPage: 1,
        totalPages: 1,
        pageSize: 10,
        totalEntities: 0,
        setCurrentPage: jest.fn(),
      });

      const { result } = renderHook(
        () =>
          useListingData({
            searchIndex: SearchIndex.TABLE,
            filterKeys: [],
            columns: [],
            pageSize: 10,
          }),
        { wrapper }
      );

      expect(result.current.pageSize).toBe(10);
      expect(mockUseDataFetching).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 10,
        })
      );
    });
  });
});

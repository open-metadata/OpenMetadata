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
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useTestDefinitionFilters } from './useTestDefinitionFilters';

const mockHandlePageChange = jest.fn();
const mockUpdateUrlParams = jest.fn();

// `mockUrlFilters` is read at call time by the useTableFilters mock so a test can
// swap in a different url-param object before rendering and observe how the hook
// derives `urlFilters`/`parsedFilters`/`hasActiveFilters` from it.
let mockUrlFilters: Record<string, string> = {};

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockImplementation(() => ({
    filters: mockUrlFilters,
    setFilters: mockUpdateUrlParams,
  })),
}));

const renderFilters = () =>
  renderHook(() =>
    useTestDefinitionFilters({ handlePageChange: mockHandlePageChange })
  );

const PAGE_RESET = { cursorType: null, cursorValue: undefined };

describe('useTestDefinitionFilters', () => {
  beforeEach(() => {
    mockUrlFilters = {};
    mockHandlePageChange.mockReset();
    mockUpdateUrlParams.mockReset();
  });

  describe('return shape', () => {
    it('should expose the url params, derived filters and every filter handler', () => {
      const { result } = renderFilters();

      const value = result.current;

      expect(value.urlParams).toEqual({});
      expect(value.urlFilters).toEqual({});
      expect(Array.isArray(value.parsedFilters)).toBe(true);
      expect(value.parsedFilters).toHaveLength(2);
      expect(typeof value.handleFilterChange).toBe('function');
      expect(typeof value.setSingleFilter).toBe('function');
      expect(typeof value.clearAllFilters).toBe('function');
      expect(value.hasActiveFilters).toBe(false);
    });

    it('should surface the raw useTableFilters params through urlParams untouched', () => {
      mockUrlFilters = { entityType: 'table,column', testPlatforms: '' };

      const { result } = renderFilters();

      expect(result.current.urlParams).toEqual({
        entityType: 'table,column',
        testPlatforms: '',
      });
    });
  });

  describe('sorting', () => {
    it('should default to the display-name ascending order', () => {
      const { result } = renderFilters();

      expect(result.current.sortField).toBe('displayName');
      expect(result.current.sortOrder).toBe('asc');
    });

    it('should read a sortable field and direction out of the url', () => {
      mockUrlFilters = { sortField: 'entityType', sortOrder: 'desc' };

      const { result } = renderFilters();

      expect(result.current.sortField).toBe('entityType');
      expect(result.current.sortOrder).toBe('desc');
    });

    // A bad bookmark must not reach the API, which answers 400 and blanks the
    // table over something the user cannot see or fix.
    it('should fall back to the default for a sortField the server cannot order by', () => {
      mockUrlFilters = { sortField: 'description', sortOrder: 'desc' };

      const { result } = renderFilters();

      expect(result.current.sortField).toBe('displayName');
    });

    it('should fall back to ascending for an unrecognised sortOrder', () => {
      mockUrlFilters = { sortField: 'entityType', sortOrder: 'sideways' };

      const { result } = renderFilters();

      expect(result.current.sortOrder).toBe('asc');
    });

    it('should map the column id onto the server sort field and reset paging', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.handleSortChange('name', 'desc');
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        sortField: 'displayName',
        sortOrder: 'desc',
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });

    // Sorting hides no rows, so it is not what an empty result set is caused by
    // - clearing it would throw away an unrelated choice.
    it('should leave the sort alone when the filters are cleared', () => {
      mockUrlFilters = {
        sortField: 'entityType',
        sortOrder: 'desc',
        q: 'rows',
      };

      const { result } = renderFilters();

      act(() => {
        result.current.clearAllFilters();
      });

      const [updates] = mockUpdateUrlParams.mock.calls[0];

      expect(updates).not.toHaveProperty('sortField');
      expect(updates).not.toHaveProperty('sortOrder');
    });

    it('should not count an explicit sort as an active filter', () => {
      mockUrlFilters = { sortField: 'entityType', sortOrder: 'desc' };

      const { result } = renderFilters();

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('urlFilters derivation', () => {
    it('should reflect a single url filter value and report hasActiveFilters true', () => {
      mockUrlFilters = { entityType: 'table' };

      const { result } = renderFilters();

      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should keep only the first value of a comma separated url filter', () => {
      mockUrlFilters = { entityType: 'table,column' };

      const { result } = renderFilters();

      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
    });

    it('should drop empty segments via filter(Boolean) and keep the first survivor', () => {
      mockUrlFilters = { entityType: ',,table,,' };

      const { result } = renderFilters();

      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should yield an empty value list and no active filter when every segment is empty', () => {
      mockUrlFilters = { entityType: ',,,' };

      const { result } = renderFilters();

      expect(result.current.urlFilters).toEqual({ entityType: [] });
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should ignore url params that are not part of the default quick filters', () => {
      mockUrlFilters = { entityType: 'table', unknownKey: 'value' };

      const { result } = renderFilters();

      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
    });
  });

  describe('parsedFilters', () => {
    it('should map every filter with an empty value list when no url filters are set', () => {
      const { result } = renderFilters();

      const [entityFilter, platformFilter] = result.current.parsedFilters;

      expect(entityFilter).toEqual(
        expect.objectContaining({ key: 'entityType', value: [] })
      );
      expect(platformFilter).toEqual(
        expect.objectContaining({ key: 'testPlatforms', value: [] })
      );
      expect(entityFilter.options).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'TABLE' })])
      );
    });

    it('should map url values through mapUrlValueToOption per filter key', () => {
      mockUrlFilters = { entityType: 'table', testPlatforms: 'OpenMetadata' };

      const { result } = renderFilters();

      const [entityFilter, platformFilter] = result.current.parsedFilters;

      expect(entityFilter.value).toEqual([{ key: 'table', label: 'table' }]);
      expect(platformFilter.value).toEqual([
        { key: 'OpenMetadata', label: 'OpenMetadata' },
      ]);
    });
  });

  describe('handleFilterChange', () => {
    it('should null every default quick filter then join the selected values and reset paging', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.handleFilterChange([
          {
            label: 'label.entity-type',
            key: 'entityType',
            value: [{ key: 'table', label: 'Table' }],
          },
        ]);
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        entityType: 'table',
        testPlatforms: null,
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });

    it('should comma join multi value selections', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.handleFilterChange([
          {
            label: 'label.entity-type',
            key: 'entityType',
            value: [
              { key: 'table', label: 'Table' },
              { key: 'column', label: 'Column' },
            ],
          },
        ]);
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        entityType: 'table,column',
        testPlatforms: null,
      });
    });
  });

  describe('setSingleFilter', () => {
    it('should set the given key to its value and reset paging to the first page', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.setSingleFilter('entityType', 'table');
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({ entityType: 'table' });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });

    it('should null the key when no value is supplied', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.setSingleFilter('entityType');
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({ entityType: null });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });
  });

  describe('clearAllFilters', () => {
    // The search term has to go out in the SAME update as the quick filters:
    // useTableFilters merges each call against the URL as it stands, so a
    // follow-up call in the same tick would be built from the stale search
    // string and undo the clearing.
    it('should null every default quick filter and the search term in one update', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.clearAllFilters();
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledTimes(1);
      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        q: null,
        entityType: null,
        testPlatforms: null,
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });
  });

  describe('handleSearchChange', () => {
    it('should push the term to the url and reset paging', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.handleSearchChange('column values');
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({ q: 'column values' });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });

    it('should drop the param entirely when the term is emptied', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.handleSearchChange('');
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({ q: null });
    });

    // The empty-state placeholder and the "clear all" button both key off
    // hasActiveFilters, so a search with no quick filter still has to count.
    it('should report hasActiveFilters for a search-only url state', () => {
      mockUrlFilters = { q: 'column' };

      const { result } = renderFilters();

      expect(result.current.searchQuery).toBe('column');
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });
});

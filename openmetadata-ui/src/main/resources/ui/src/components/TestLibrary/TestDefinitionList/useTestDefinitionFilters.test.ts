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
    it('should null every default quick filter and reset paging', () => {
      const { result } = renderFilters();

      act(() => {
        result.current.clearAllFilters();
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        entityType: null,
        testPlatforms: null,
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, PAGE_RESET);
    });
  });
});

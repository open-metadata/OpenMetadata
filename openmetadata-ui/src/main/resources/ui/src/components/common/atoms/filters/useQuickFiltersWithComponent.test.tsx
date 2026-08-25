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
import React from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import {
  SelectMode,
  useQuickFiltersWithComponent,
} from './useQuickFiltersWithComponent';

jest.mock('../../../Explore/ExploreQuickFilters', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() =>
      React.createElement('div', null, 'ExploreQuickFilters')
    ),
}));

const mockDefaultFilters: ExploreQuickFilterField[] = [
  {
    key: 'entityType',
    label: 'label.entity-type',
    value: [],
  },
  {
    key: 'testPlatforms',
    label: 'label.test-platform-plural',
    value: [],
  },
];

const mockParsedFilters: ExploreQuickFilterField[] = [
  {
    key: 'entityType',
    label: 'label.entity-type',
    value: [{ key: 'TABLE', label: 'Table' }],
  },
  {
    key: 'testPlatforms',
    label: 'label.test-platform-plural',
    value: [{ key: 'OpenMetadata', label: 'OpenMetadata' }],
  },
];

const emptyParsedFilters: ExploreQuickFilterField[] = [];

describe('useQuickFiltersWithComponent', () => {
  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default filters', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
        })
      );

      expect(result.current.selectedFilters).toEqual(
        mockDefaultFilters.map((f) => ({ ...f, singleSelect: false }))
      );
      expect(result.current.quickFilters).toBeDefined();
    });

    it('should initialize with single-select mode', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
          mode: SelectMode.SINGLE,
        })
      );

      expect(result.current.selectedFilters).toEqual(
        mockDefaultFilters.map((f) => ({ ...f, singleSelect: true }))
      );
    });

    it('should initialize with multi-select mode', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
          mode: SelectMode.MULTI,
        })
      );

      expect(result.current.selectedFilters).toEqual(
        mockDefaultFilters.map((f) => ({ ...f, singleSelect: false }))
      );
    });

    it('should default to multi-select mode when mode is not specified', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
        })
      );

      expect(result.current.selectedFilters).toEqual(
        mockDefaultFilters.map((f) => ({ ...f, singleSelect: false }))
      );
    });
  });

  describe('Parsed Filters', () => {
    it('should merge parsed filters with default filters', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          parsedFilters: mockParsedFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
        })
      );

      expect(result.current.selectedFilters).toEqual([
        {
          key: 'entityType',
          label: 'label.entity-type',
          value: [{ key: 'TABLE', label: 'Table' }],
          singleSelect: false,
        },
        {
          key: 'testPlatforms',
          label: 'label.test-platform-plural',
          value: [{ key: 'OpenMetadata', label: 'OpenMetadata' }],
          singleSelect: false,
        },
      ]);
    });

    it('should use default values when parsed filter is not found', () => {
      const partialParsedFilters: ExploreQuickFilterField[] = [
        {
          key: 'entityType',
          label: 'label.entity-type',
          value: [{ key: 'COLUMN', label: 'Column' }],
        },
      ];

      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          parsedFilters: partialParsedFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
        })
      );

      expect(result.current.selectedFilters).toEqual([
        {
          key: 'entityType',
          label: 'label.entity-type',
          value: [{ key: 'COLUMN', label: 'Column' }],
          singleSelect: false,
        },
        {
          key: 'testPlatforms',
          label: 'label.test-platform-plural',
          value: [],
          singleSelect: false,
        },
      ]);
    });

    it('should apply single-select mode to parsed filters', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          parsedFilters: mockParsedFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
          mode: SelectMode.SINGLE,
        })
      );

      expect(result.current.selectedFilters).toEqual(
        mockParsedFilters.map((f) => ({ ...f, singleSelect: true }))
      );
    });

    it('should use default filters when parsedFilters is empty array', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          parsedFilters: emptyParsedFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
        })
      );

      expect(result.current.selectedFilters).toEqual(
        mockDefaultFilters.map((f) => ({ ...f, singleSelect: false }))
      );
    });
  });

  describe('Config Changes', () => {
    it('should update filters when defaultFilters change', () => {
      const { result, rerender } = renderHook(
        ({ defaultFilters }: { defaultFilters: ExploreQuickFilterField[] }) =>
          useQuickFiltersWithComponent({
            defaultFilters,
            searchIndex: SearchIndex.ALL,
            onFilterChange: mockOnFilterChange,
          }),
        {
          initialProps: { defaultFilters: mockDefaultFilters },
        }
      );

      const newDefaultFilters: ExploreQuickFilterField[] = [
        ...mockDefaultFilters,
        {
          key: 'serviceType',
          label: 'label.service-type',
          value: [],
        },
      ];

      rerender({ defaultFilters: newDefaultFilters });

      expect(result.current.selectedFilters).toHaveLength(3);
      expect(result.current.selectedFilters[2].key).toBe('serviceType');
    });

    it('should update filters when parsedFilters change', () => {
      const { result, rerender } = renderHook(
        ({
          parsedFilters,
        }: {
          parsedFilters: ExploreQuickFilterField[] | undefined;
        }) =>
          useQuickFiltersWithComponent({
            defaultFilters: mockDefaultFilters,
            parsedFilters,
            searchIndex: SearchIndex.ALL,
            onFilterChange: mockOnFilterChange,
          }),
        {
          initialProps: { parsedFilters: emptyParsedFilters },
        }
      );

      expect(result.current.selectedFilters[0].value).toEqual([]);

      rerender({ parsedFilters: mockParsedFilters });

      expect(result.current.selectedFilters[0].value).toEqual([
        { key: 'TABLE', label: 'Table' },
      ]);
    });

    it('should update singleSelect when mode changes', () => {
      const { result, rerender } = renderHook(
        ({ mode }: { mode: SelectMode }) =>
          useQuickFiltersWithComponent({
            defaultFilters: mockDefaultFilters,
            searchIndex: SearchIndex.ALL,
            onFilterChange: mockOnFilterChange,
            mode,
          }),
        {
          initialProps: { mode: SelectMode.MULTI },
        }
      );

      expect(result.current.selectedFilters[0].singleSelect).toBe(false);

      rerender({ mode: SelectMode.SINGLE });

      expect(result.current.selectedFilters[0].singleSelect).toBe(true);
    });
  });

  describe('Return Values', () => {
    it('should return quickFilters and selectedFilters', () => {
      const { result } = renderHook(() =>
        useQuickFiltersWithComponent({
          defaultFilters: mockDefaultFilters,
          searchIndex: SearchIndex.ALL,
          onFilterChange: mockOnFilterChange,
        })
      );

      expect(result.current).toHaveProperty('quickFilters');
      expect(result.current).toHaveProperty('selectedFilters');
      expect(Array.isArray(result.current.selectedFilters)).toBe(true);
    });
  });
});

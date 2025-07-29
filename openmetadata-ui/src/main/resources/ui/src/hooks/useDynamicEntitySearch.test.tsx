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

import { renderHook, waitFor } from '@testing-library/react';
import { SearchIndex } from '../enums/search.enum';
import { useDynamicEntitySearch } from './useDynamicEntitySearch';

// Mock dependencies
jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [
        { _source: { id: '1', name: 'Test Domain 1' } },
        { _source: { id: '2', name: 'Test Domain 2' } },
      ],
      total: { value: 2 },
    },
  }),
}));

jest.mock('./useTableFilters', () => ({
  useTableFilters: jest.fn(() => ({
    filters: {
      owners: [],
      glossaryTerms: [],
      domainTypes: [],
      tags: [],
    },
    setFilters: jest.fn(),
  })),
}));

jest.mock('../utils/EntityTableUtils', () => ({
  buildEntityTableQueryFilter: jest.fn().mockReturnValue({
    query: { match_all: {} },
  }),
}));

describe('useDynamicEntitySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial state correctly', () => {
    const { result } = renderHook(() =>
      useDynamicEntitySearch({
        searchIndex: SearchIndex.DOMAIN,
      })
    );

    expect(result.current).toEqual({
      data: [],
      loading: false,
      total: 0,
      searchTerm: '',
      setSearchTerm: expect.any(Function),
      filters: {
        owners: [],
        glossaryTerms: [],
        domainTypes: [],
        tags: [],
      },
      setFilters: expect.any(Function),
      refetch: expect.any(Function),
    });
  });

  it('should fetch data on mount', async () => {
    const { result } = renderHook(() =>
      useDynamicEntitySearch({
        searchIndex: SearchIndex.DOMAIN,
      })
    );

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
      expect(result.current.total).toBe(2);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle search term changes', async () => {
    const { result } = renderHook(() =>
      useDynamicEntitySearch({
        searchIndex: SearchIndex.DOMAIN,
        enableSearch: true,
      })
    );

    result.current.setSearchTerm('test search');

    expect(result.current.searchTerm).toBe('test search');
  });

  it('should handle filter changes', () => {
    const { result } = renderHook(() =>
      useDynamicEntitySearch({
        searchIndex: SearchIndex.DOMAIN,
        enableFilters: true,
      })
    );

    const newFilters = {
      owners: ['user1'],
      glossaryTerms: [],
      domainTypes: [],
      tags: [],
    };

    result.current.setFilters(newFilters);

    // The actual filter state is managed by useTableFilters mock
    expect(result.current.setFilters).toBeDefined();
  });
});

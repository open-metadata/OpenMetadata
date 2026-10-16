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

import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { RouteVisibilityProvider } from '../../../../context/RouteVisibilityProvider/RouteVisibilityProvider';
import { SearchIndex } from '../../../../enums/search.enum';
import { searchQuery } from '../../../../rest/searchAPI';
import { useListingData } from './useListingData';

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: { hits: [], total: { value: 20 } },
  }),
  nlqSearch: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;
const FILTER_KEYS: string[] = [];
const COLUMNS: [] = [];
const LIST_OPTIONS = [15, 25, 50];
const GRID_OPTIONS = [12, 24, 48];

const renderListing = (
  url: string,
  { isVisible = true, pageSize = 15, pageSizeOptions = LIST_OPTIONS } = {}
) =>
  renderHook(
    () => ({
      listing: useListingData({
        searchIndex: SearchIndex.DOMAIN,
        filterKeys: FILTER_KEYS,
        columns: COLUMNS,
        pageSize,
        pageSizeOptions,
      }),
      location: useLocation(),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[url]}>
          <RouteVisibilityProvider isVisible={isVisible}>
            {children}
          </RouteVisibilityProvider>
        </MemoryRouter>
      ),
    }
  );

describe('useListingData with a page size from an old link', () => {
  beforeEach(() => {
    mockSearchQuery.mockClear();
  });

  it('opens an off-scale size link on page 1 and drops its paging from the URL', async () => {
    const { result } = renderListing('/domain?page=3&size=9');

    await waitFor(() => {
      expect(result.current.location.search).toBe('');
    });

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 15 })
    );
    expect(result.current.listing.currentPage).toBe(1);
  });

  it('keeps the page of a link whose size is on the scale', async () => {
    const { result } = renderListing('/domain?page=2&size=25');

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 2, pageSize: 25 })
      );
    });

    expect(result.current.location.search).toBe('?page=2&size=25');
  });

  it('leaves the URL paging alone while its route is hidden', async () => {
    const { result } = renderListing('/data-products?page=2&size=25', {
      isVisible: false,
      pageSize: 12,
      pageSizeOptions: GRID_OPTIONS,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.location.search).toBe('?page=2&size=25');
  });
});

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
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAsyncDataAssetOptions } from './useAsyncDataAssetOptions';

jest.mock('../../../rest/searchAPI');
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((src) => src.displayName ?? src.name),
}));
jest.mock('../../../utils/EntityReferenceUtils', () => ({
  getEntityReferenceFromEntity: jest
    .fn()
    .mockImplementation((entity, type) => ({ ...entity, type })),
}));

const mockHit = (id: string, name: string, displayName: string) => ({
  _source: {
    id,
    name,
    fullyQualifiedName: `db.schema.${name}`,
    entityType: 'table',
    displayName,
  },
});

const buildSearchResponse = (
  hits: ReturnType<typeof mockHit>[],
  total: number
) => ({
  hits: {
    hits,
    total: { value: total },
  },
});

const DEFAULT_PARAMS = {
  isOpen: true,
  searchIndex: SearchIndex.ALL,
  debounceTimeout: 0,
};

describe('useAsyncDataAssetOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty options and not loading initially', () => {
    const { result } = renderHook(() =>
      useAsyncDataAssetOptions({ ...DEFAULT_PARAMS, isOpen: false })
    );

    expect(result.current.options).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('loadOptions fetches and populates options', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([mockHit('1', 'orders', 'Orders')], 1)
    );

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('');
    });

    expect(result.current.options).toHaveLength(1);
    expect(result.current.options[0].value).toBe('db.schema.orders');
    expect(result.current.isLoading).toBe(false);
  });

  it('sets totalCount from the search response total', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse(
        [mockHit('1', 'orders', 'Orders'), mockHit('2', 'products', 'Products')],
        50
      )
    );

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('');
    });

    expect(result.current.totalCount).toBe(50);
  });

  it('loadOptions resets options before fetching', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce(
        buildSearchResponse([mockHit('1', 'orders', 'Orders')], 1)
      )
      .mockResolvedValueOnce(
        buildSearchResponse([mockHit('2', 'products', 'Products')], 1)
      );

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('orders');
    });

    expect(result.current.options).toHaveLength(1);

    await act(async () => {
      await result.current.loadOptions('products');
    });

    expect(result.current.options).toHaveLength(1);
    expect(result.current.options[0].value).toBe('db.schema.products');
  });

  it('calls showErrorToast when loadOptions throws', async () => {
    const error = new Error('Network error');
    (searchQuery as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('');
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(result.current.isLoading).toBe(false);
  });

  it('handleSearchChange updates searchText and debounces loadOptions', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([mockHit('1', 'orders', 'Orders')], 1)
    );

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions({ ...DEFAULT_PARAMS, debounceTimeout: 0 })
    );

    await act(async () => {
      result.current.handleSearchChange('ord');
    });

    await waitFor(() => {
      expect(result.current.searchText).toBe('ord');
    });
  });

  it('handleScroll appends more options when near the bottom', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce(
        buildSearchResponse([mockHit('1', 'orders', 'Orders')], 2)
      )
      .mockResolvedValueOnce(
        buildSearchResponse([mockHit('2', 'products', 'Products')], 2)
      );

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('');
    });

    expect(result.current.options).toHaveLength(1);

    const scrollEvent = {
      currentTarget: {
        scrollTop: 200,
        offsetHeight: 100,
        scrollHeight: 250,
      },
    } as unknown as React.UIEvent<HTMLElement>;

    await act(async () => {
      await result.current.handleScroll(scrollEvent);
    });

    await waitFor(() => {
      expect(result.current.options).toHaveLength(2);
    });
  });

  it('handleScroll does not fetch when already at end of total', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([mockHit('1', 'orders', 'Orders')], 1)
    );

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('');
    });

    const callCount = (searchQuery as jest.Mock).mock.calls.length;

    const scrollEvent = {
      currentTarget: {
        scrollTop: 200,
        offsetHeight: 100,
        scrollHeight: 250,
      },
    } as unknown as React.UIEvent<HTMLElement>;

    await act(async () => {
      await result.current.handleScroll(scrollEvent);
    });

    // options.length (1) is NOT less than total (1), so no additional fetch
    expect((searchQuery as jest.Mock).mock.calls.length).toBe(callCount);
  });

  it('passes queryFilter to searchQuery', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([], 0)
    );

    const queryFilter = { query: { bool: { filter: [{ term: { deleted: false } }] } } };

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions({ ...DEFAULT_PARAMS, queryFilter })
    );

    await act(async () => {
      await result.current.loadOptions('test');
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryFilter })
    );
  });

  it('uses wildcard query format for non-empty search strings', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(buildSearchResponse([], 0));

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('orders');
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: '*orders*' })
    );
  });

  it('uses wildcard-only query for empty search string', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(buildSearchResponse([], 0));

    const { result } = renderHook(() =>
      useAsyncDataAssetOptions(DEFAULT_PARAMS)
    );

    await act(async () => {
      await result.current.loadOptions('');
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: '*' })
    );
  });
});

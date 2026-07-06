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
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { TEST_CASE_FILTERS } from '../../../constants/profiler.constant';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getTags } from '../../../rest/tagAPI';
import tagClassBase from '../../../utils/TagClassBase';
import { useTestCaseFilterOptions } from './useTestCaseFilterOptions';

jest.mock('../../../rest/searchAPI', () => ({
  ...jest.requireActual('../../../rest/searchAPI'),
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));

jest.mock('../../../rest/tagAPI', () => ({
  ...jest.requireActual('../../../rest/tagAPI'),
  getTags: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('useTestCaseFilterOptions', () => {
  beforeEach(() => {
    (searchQuery as jest.Mock).mockClear();
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    });
    (getTags as jest.Mock).mockClear();
    (getTags as jest.Mock).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the full option cluster shape with empty lists and no loading on mount', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    expect(result.current.tableOptions).toEqual([]);
    expect(result.current.tagOptions).toEqual([]);
    expect(result.current.tierOptions).toEqual([]);
    expect(result.current.serviceOptions).toEqual([]);
    expect(result.current.dataProductOptions).toEqual([]);
    expect(result.current.isOptionsLoading).toBe(false);

    expect(typeof result.current.getInitialOptions).toBe('function');
    expect(typeof result.current.fetchTierOptions).toBe('function');
    expect(typeof result.current.fetchTagOptions).toBe('function');
    expect(typeof result.current.fetchTableData).toBe('function');
    expect(typeof result.current.fetchServiceOptions).toBe('function');
    expect(typeof result.current.fetchDataProductOptions).toBe('function');
    expect(typeof result.current.debounceFetchTableData).toBe('function');
    expect(typeof result.current.debounceFetchTagOptions).toBe('function');
    expect(typeof result.current.debounceFetchServiceOptions).toBe('function');
    expect(typeof result.current.debounceFetchDataProductOptions).toBe(
      'function'
    );
    expect(typeof result.current.asyncOptionsByKey).toBe('object');
    expect(typeof result.current.onSearchByKey).toBe('object');
  });

  it('should dispatch the tier fetcher through getTags when getInitialOptions is called with the tier key', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tier);
    });

    expect(getTags).toHaveBeenCalledWith({ parent: 'Tier', limit: 50 });
    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('should dispatch the table fetcher through searchQuery on the TABLE index for the table key', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.table);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.TABLE,
        query: '***',
        pageNumber: 1,
        pageSize: 15,
      })
    );
  });

  it('should dispatch the tags fetcher through tagClassBase.getTags for the tags key', () => {
    const spy = jest
      .spyOn(tagClassBase, 'getTags')
      .mockResolvedValue({ data: [], paging: { total: 0 } });

    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tags);
    });

    expect(spy).toHaveBeenCalledWith('', 1);

    spy.mockRestore();
  });

  it('should dispatch the service fetcher through searchQuery on the DATABASE_SERVICE index for the service key', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.service);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ searchIndex: SearchIndex.DATABASE_SERVICE })
    );
  });

  it('should dispatch the data-product fetcher through searchQuery on the DATA_PRODUCT index for the data-product key', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.dataProduct);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ searchIndex: SearchIndex.DATA_PRODUCT })
    );
  });

  it('should not dispatch any fetcher for an unknown filter key', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.getInitialOptions('unknown-key');
    });

    expect(getTags).not.toHaveBeenCalled();
    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('should skip the fetch when options already exist and the length check is on, but refetch when it is off', async () => {
    (getTags as jest.Mock).mockResolvedValue({
      data: [{ fullyQualifiedName: 'Tier.Gold', name: 'Gold' }],
    });

    const { result } = renderHook(() => useTestCaseFilterOptions());

    await act(async () => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tier);
    });

    await waitFor(() =>
      expect(result.current.tierOptions.length).toBeGreaterThan(0)
    );

    (getTags as jest.Mock).mockClear();

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tier, true);
    });

    expect(getTags).not.toHaveBeenCalled();

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tier, false);
    });

    expect(getTags).toHaveBeenCalledTimes(1);
  });

  it('should invoke the table search through the debounced fetcher after the debounce window elapses', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useTestCaseFilterOptions());

    await act(async () => {
      result.current.debounceFetchTableData('orders');
      jest.advanceTimersByTime(1000);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '*orders*',
        searchIndex: SearchIndex.TABLE,
      })
    );
  });

  it('should not fire the debounced fetcher before the debounce window elapses', () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useTestCaseFilterOptions());

    act(() => {
      result.current.debounceFetchTableData('orders');
      jest.advanceTimersByTime(500);
    });

    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('should expose asyncOptionsByKey keyed by every async filter and tracking the live lists', async () => {
    (getTags as jest.Mock).mockResolvedValue({
      data: [{ fullyQualifiedName: 'Tier.Gold', name: 'Gold' }],
    });

    const { result } = renderHook(() => useTestCaseFilterOptions());

    expect(
      Object.keys(result.current.asyncOptionsByKey).sort((a, b) =>
        a.localeCompare(b)
      )
    ).toEqual(
      [
        TEST_CASE_FILTERS.table,
        TEST_CASE_FILTERS.tags,
        TEST_CASE_FILTERS.tier,
        TEST_CASE_FILTERS.service,
        TEST_CASE_FILTERS.dataProduct,
      ].sort((a, b) => a.localeCompare(b))
    );
    expect(result.current.asyncOptionsByKey[TEST_CASE_FILTERS.tier]).toEqual(
      []
    );

    await act(async () => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tier);
    });

    await waitFor(() => expect(result.current.tierOptions.length).toBe(1));

    expect(result.current.asyncOptionsByKey[TEST_CASE_FILTERS.tier]).toBe(
      result.current.tierOptions
    );
  });

  it('should wire onSearchByKey to the matching debounced fetcher and leave non-searchable keys unmapped', () => {
    const { result } = renderHook(() => useTestCaseFilterOptions());

    expect(result.current.onSearchByKey[TEST_CASE_FILTERS.table]).toBe(
      result.current.debounceFetchTableData
    );
    expect(result.current.onSearchByKey[TEST_CASE_FILTERS.tags]).toBe(
      result.current.debounceFetchTagOptions
    );
    expect(result.current.onSearchByKey[TEST_CASE_FILTERS.service]).toBe(
      result.current.debounceFetchServiceOptions
    );
    expect(result.current.onSearchByKey[TEST_CASE_FILTERS.dataProduct]).toBe(
      result.current.debounceFetchDataProductOptions
    );
    expect(
      result.current.onSearchByKey[TEST_CASE_FILTERS.tier]
    ).toBeUndefined();
  });

  it('should toggle isOptionsLoading true during a tier fetch and back to false once it settles', async () => {
    let resolveTags: (value: unknown) => void = () => undefined;
    (getTags as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTags = resolve;
        })
    );

    const { result } = renderHook(() => useTestCaseFilterOptions());

    expect(result.current.isOptionsLoading).toBe(false);

    act(() => {
      result.current.getInitialOptions(TEST_CASE_FILTERS.tier);
    });

    expect(result.current.isOptionsLoading).toBe(true);

    await act(async () => {
      resolveTags({ data: [] });
    });

    expect(result.current.isOptionsLoading).toBe(false);
  });
});

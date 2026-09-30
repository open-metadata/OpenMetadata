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

import { act, renderHook } from '@testing-library/react';
import { SearchIndex } from '../../../../enums/search.enum';
import { nlqSearch, searchQuery } from '../../../../rest/searchAPI';
import { useDataFetching } from './useDataFetching';

jest.mock('../../../../rest/searchAPI', () => ({
  nlqSearch: jest.fn(),
  searchQuery: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const emptyResponse = { hits: { hits: [], total: { value: 0 } } };

const responseWith = (id: string) => ({
  hits: { hits: [{ _source: { id } }], total: { value: 1 } },
});

// A promise plus the handle to settle it later, so two in-flight requests can
// be resolved out of order.
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const mockNlqSearch = nlqSearch as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;

describe('useDataFetching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNlqSearch.mockResolvedValue(emptyResponse);
    mockSearchQuery.mockResolvedValue(emptyResponse);
  });

  const renderFetching = (useNlq: boolean) =>
    renderHook(() =>
      useDataFetching({ searchIndex: SearchIndex.DATA_PRODUCT, useNlq })
    );

  it('uses the plain search endpoint when NLQ is off', async () => {
    const { result } = renderFetching(false);

    await act(async () => {
      await result.current.searchEntities(1, 'finance', {});
    });

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    expect(mockNlqSearch).not.toHaveBeenCalled();
  });

  it('routes the query through NLQ when the toggle is on', async () => {
    const { result } = renderFetching(true);

    await act(async () => {
      await result.current.searchEntities(1, 'finance data products', {});
    });

    expect(mockNlqSearch).toHaveBeenCalledTimes(1);
    expect(mockNlqSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'finance data products',
        searchIndex: SearchIndex.DATA_PRODUCT,
      })
    );
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('ignores a superseded response that lands after a newer one', async () => {
    const slowFirst = deferred();
    const fastSecond = deferred();
    mockNlqSearch
      .mockReturnValueOnce(slowFirst.promise)
      .mockReturnValueOnce(fastSecond.promise);

    const { result } = renderFetching(true);

    await act(async () => {
      result.current.searchEntities(1, 'finance', {});
      result.current.searchEntities(1, 'finance products', {});
      // The newer query answers first, then the stale one arrives late.
      fastSecond.resolve(responseWith('newer'));
      slowFirst.resolve(responseWith('older'));
    });

    expect(result.current.entities).toEqual([{ id: 'newer' }]);
    expect(result.current.loading).toBe(false);
  });

  it('does not let a late NLQ response replace the result after the toggle is off', async () => {
    const lateNlq = deferred();
    mockNlqSearch.mockReturnValueOnce(lateNlq.promise);
    mockSearchQuery.mockResolvedValue(responseWith('plain-es'));

    const { result, rerender } = renderHook(
      ({ useNlq }) =>
        useDataFetching({ searchIndex: SearchIndex.DATA_PRODUCT, useNlq }),
      { initialProps: { useNlq: true } }
    );

    await act(async () => {
      result.current.searchEntities(1, 'finance', {});
    });

    rerender({ useNlq: false });

    await act(async () => {
      await result.current.searchEntities(1, 'finance', {});
      lateNlq.resolve(responseWith('stale-nlq'));
    });

    expect(result.current.entities).toEqual([{ id: 'plain-es' }]);
  });

  it('keeps the plain endpoint for an empty term even with NLQ on', async () => {
    const { result } = renderFetching(true);

    await act(async () => {
      await result.current.searchEntities(1, '', {});
    });

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    expect(mockNlqSearch).not.toHaveBeenCalled();
  });
});

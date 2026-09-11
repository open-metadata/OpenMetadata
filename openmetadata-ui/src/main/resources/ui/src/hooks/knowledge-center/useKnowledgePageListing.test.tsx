/*
 *  Copyright 2022 Collate.
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
import APIClient from '../../rest';
import { useKnowledgePageListing } from './useKnowledgePageListing';

jest.mock('../../rest', () => ({ get: jest.fn() }));
const get = APIClient.get as jest.Mock;
const pageData = (prefix: string, count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${start + index}`,
    name: `${prefix}-${start + index}`,
    fullyQualifiedName: `${prefix}-${start + index}`,
    pageType: 'Article',
  }));
const searchResponse = (
  prefix: string,
  count: number,
  total = count,
  start = 0
) => ({
  data: {
    hits: {
      total: { value: total, relation: 'eq' },
      hits: pageData(prefix, count, start).map((_source) => ({ _source })),
    },
  },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((success, failure) => {
    resolve = success;
    reject = failure;
  });

  return { promise, resolve, reject };
};

beforeEach(() => {
  get.mockReset();
});

it('loads search matches beyond the first 25 without duplicate page requests', async () => {
  get.mockImplementation((_url, options) =>
    Promise.resolve(
      searchResponse(
        'article',
        options.params.from === 0 ? 25 : 1,
        26,
        options.params.from
      )
    )
  );
  const { result } = renderHook(() => useKnowledgePageListing('article', true));
  await waitFor(() => expect(result.current.knowledgePages).toHaveLength(25));
  await act(async () => {
    await Promise.all([
      result.current.fetchNextPage(),
      result.current.fetchNextPage(),
    ]);
  });

  expect(result.current.knowledgePages.map((page) => page.id)).toEqual(
    pageData('article', 26).map((page) => page.id)
  );

  await act(async () => {
    await result.current.fetchNextPage();
  });

  expect(get.mock.calls.map(([_url, options]) => options.params.from)).toEqual([
    0, 25,
  ]);
});

it('loads unfiltered pages using their offset and keeps existing rows', async () => {
  get.mockImplementation((_url, options) =>
    Promise.resolve({
      data: {
        data: pageData(
          'article',
          options.params.offset === 0 ? 25 : 1,
          options.params.offset
        ),
        paging: { total: 26 },
      },
    })
  );
  const { result } = renderHook(() => useKnowledgePageListing('', true));
  await waitFor(() => expect(result.current.knowledgePages).toHaveLength(25));
  await act(async () => {
    await result.current.fetchNextPage();
  });

  expect(result.current.knowledgePages).toHaveLength(26);
  expect(
    get.mock.calls.map(([_url, options]) => options.params.offset)
  ).toEqual([0, 25]);
});

it('stops at the last search page when concurrent edits produce duplicate hits', async () => {
  get
    .mockResolvedValueOnce(searchResponse('article', 25, 26))
    .mockResolvedValueOnce(searchResponse('article', 1, 26, 24));
  const { result } = renderHook(() => useKnowledgePageListing('article', true));
  await waitFor(() => expect(result.current.knowledgePages).toHaveLength(25));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await act(async () => {
    await result.current.fetchNextPage();
  });

  expect(result.current.knowledgePages).toEqual(pageData('article', 25));
  expect(result.current.error).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(2);
});

it.each(['success', 'failure'])(
  'ignores an older query %s after a newer result',
  async (outcome) => {
    const old = deferred<ReturnType<typeof searchResponse>>();
    get.mockImplementation((_url) =>
      new URL(_url, 'http://localhost').searchParams.get('q') === 'old'
        ? old.promise
        : Promise.resolve(searchResponse('new', 1))
    );
    const { result, rerender } = renderHook(
      ({ query }) => useKnowledgePageListing(query, true),
      { initialProps: { query: 'old' } }
    );

    expect(result.current.isLoading).toBe(true);

    rerender({ query: 'new' });
    await waitFor(() =>
      expect(result.current.knowledgePages[0]?.name).toBe('new-0')
    );
    await act(async () => {
      if (outcome === 'success') {
        old.resolve(searchResponse('old', 1));
      } else {
        old.reject(new Error('Old query failed'));
      }
      await old.promise.catch(() => undefined);
    });

    expect(result.current.knowledgePages[0]?.name).toBe('new-0');
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  }
);

it('does not append a previous search page after changing the query', async () => {
  const next = deferred<ReturnType<typeof searchResponse>>();
  get.mockImplementation((_url, options) => {
    if (options.params.from > 0) {
      return next.promise;
    }
    const query = new URL(_url, 'http://localhost').searchParams.get('q') ?? '';

    return Promise.resolve(searchResponse(query, query === 'old' ? 25 : 1, 26));
  });
  const { result, rerender } = renderHook(
    ({ query }) => useKnowledgePageListing(query, true),
    { initialProps: { query: 'old' } }
  );
  await waitFor(() => expect(result.current.knowledgePages).toHaveLength(25));
  let loading: Promise<void> | undefined;
  act(() => {
    loading = result.current.fetchNextPage();
  });
  rerender({ query: 'new' });
  await waitFor(() =>
    expect(result.current.knowledgePages[0]?.name).toBe('new-0')
  );
  await act(async () => {
    next.resolve(searchResponse('old', 1, 26, 25));
    await loading;
  });

  expect(result.current.knowledgePages).toEqual(pageData('new', 1));
});

it('exposes a failed page without automatically retrying or advancing past it', async () => {
  const failure = new Error('Search unavailable');
  get
    .mockResolvedValueOnce(searchResponse('article', 25, 26))
    .mockRejectedValueOnce(failure);
  const { result } = renderHook(() => useKnowledgePageListing('article', true));
  await waitFor(() => expect(result.current.knowledgePages).toHaveLength(25));
  await act(async () => {
    await result.current.fetchNextPage();
  });

  expect(result.current.error).toBe(failure);
  expect(result.current.knowledgePages).toHaveLength(25);

  await act(async () => {
    await result.current.fetchNextPage();
  });

  expect(get).toHaveBeenCalledTimes(2);
});

it('clears results and discards pending data when permission is removed', async () => {
  const pending = deferred<ReturnType<typeof searchResponse>>();
  get.mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(
    ({ enabled }) => useKnowledgePageListing('article', enabled),
    { initialProps: { enabled: true } }
  );
  rerender({ enabled: false });
  await act(async () => {
    pending.resolve(searchResponse('article', 1));
    await pending.promise;
  });

  expect(result.current.knowledgePages).toEqual([]);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeUndefined();
});

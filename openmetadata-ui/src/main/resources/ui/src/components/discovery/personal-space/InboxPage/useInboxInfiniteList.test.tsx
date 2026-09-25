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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const mockShowErrorToast = jest.fn();

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

import {
  InboxListPage,
  UseInboxInfiniteList,
  useInboxInfiniteList,
} from './useInboxInfiniteList';

interface Item {
  id: number;
}

type FetchPage = (after?: string) => Promise<InboxListPage<Item> | undefined>;

let intersect: (() => void) | undefined;

class MockIntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {
    intersect = () =>
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
  }
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
  takeRecords = jest.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
}

const Harness: React.FC<{
  listKey: string;
  fetchPage: FetchPage;
  onApi: (api: UseInboxInfiniteList<Item>) => void;
}> = ({ listKey, fetchPage, onApi }) => {
  const api = useInboxInfiniteList<Item>(['list', listKey], fetchPage);
  onApi(api);

  return (
    <div ref={api.scrollRef}>
      <div ref={api.sentinelRef} />
    </div>
  );
};

const page = (
  id: number,
  { after, total = 1 }: { after?: string; total?: number } = {}
): InboxListPage<Item> => ({ data: [{ id }], paging: { after, total } });

describe('useInboxInfiniteList', () => {
  let api: UseInboxInfiniteList<Item>;
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    intersect = undefined;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    (
      global as unknown as { IntersectionObserver: unknown }
    ).IntersectionObserver = MockIntersectionObserver;
  });

  const harness = (fetchPage: FetchPage, listKey = 'open') => (
    <QueryClientProvider client={queryClient}>
      <Harness
        fetchPage={fetchPage}
        listKey={listKey}
        onApi={(value) => (api = value)}
      />
    </QueryClientProvider>
  );

  const renderHarness = (fetchPage: FetchPage, listKey?: string) =>
    render(harness(fetchPage, listKey));

  it('loads the first page and exposes items/total', async () => {
    const fetchPage = jest.fn().mockResolvedValue(page(1, { total: 5 }));

    renderHarness(fetchPage);

    await waitFor(() => expect(api.items).toHaveLength(1));

    expect(fetchPage).toHaveBeenCalledWith(undefined);
    expect(api.total).toBe(5);
    expect(api.isLoading).toBe(false);
  });

  it('loads the next page when the sentinel intersects', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(1, { after: 'c1', total: 5 }))
      .mockResolvedValueOnce(page(2, { total: 5 }));

    renderHarness(fetchPage);
    await waitFor(() => expect(api.items).toHaveLength(1));

    await act(async () => {
      intersect?.();
    });

    await waitFor(() => expect(api.items.map((i) => i.id)).toEqual([1, 2]));

    expect(fetchPage).toHaveBeenLastCalledWith('c1');
  });

  it('shows an error toast when a page fetch rejects', async () => {
    const fetchPage = jest.fn().mockRejectedValue(new Error('boom'));

    renderHarness(fetchPage);

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(api.items).toHaveLength(0);
  });

  // A filter switch must not blank the list: the old rows stay until the new
  // list's first page lands.
  it('keeps the previous rows while a new key loads', async () => {
    let resolveClosed: ((value: InboxListPage<Item>) => void) | undefined;
    const open = jest.fn().mockResolvedValue(page(1));
    const closed = jest.fn(
      () =>
        new Promise<InboxListPage<Item>>((resolve) => {
          resolveClosed = resolve;
        })
    );

    const view = renderHarness(open);
    await waitFor(() => expect(api.items[0]?.id).toBe(1));

    view.rerender(harness(closed, 'closed'));

    await waitFor(() => expect(closed).toHaveBeenCalledWith(undefined));

    expect(api.items[0]?.id).toBe(1);
    expect(api.isLoading).toBe(false);

    await act(async () => resolveClosed?.(page(9)));

    await waitFor(() => expect(api.items[0]?.id).toBe(9));
  });

  it('reads a list it already loaded from the cache', async () => {
    const open = jest.fn().mockResolvedValue(page(1));
    const closed = jest.fn().mockResolvedValue(page(9));

    const view = renderHarness(open);
    await waitFor(() => expect(api.items[0]?.id).toBe(1));
    view.rerender(harness(closed, 'closed'));
    await waitFor(() => expect(api.items[0]?.id).toBe(9));

    view.rerender(harness(open, 'open'));

    await waitFor(() => expect(api.items[0]?.id).toBe(1));

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('exposes setItems and setTotal for optimistic updates', async () => {
    const fetchPage = jest.fn().mockResolvedValue(page(1, { total: 3 }));

    renderHarness(fetchPage);
    await waitFor(() => expect(api.items).toHaveLength(1));

    act(() => {
      api.setItems((prev) => prev.filter((i) => i.id !== 1));
      api.setTotal((prev) => prev - 1);
    });

    await waitFor(() => expect(api.items).toHaveLength(0));

    expect(api.total).toBe(2);
  });
});

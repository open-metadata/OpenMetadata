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
  fetchPage: (after?: string) => Promise<InboxListPage<Item> | undefined>;
  onApi: (api: UseInboxInfiniteList<Item>) => void;
}> = ({ fetchPage, onApi }) => {
  const api = useInboxInfiniteList<Item>(fetchPage);
  onApi(api);

  return (
    <div ref={api.scrollRef}>
      <div ref={api.sentinelRef} />
    </div>
  );
};

describe('useInboxInfiniteList', () => {
  let api: UseInboxInfiniteList<Item>;

  beforeEach(() => {
    jest.clearAllMocks();
    intersect = undefined;
    (
      global as unknown as { IntersectionObserver: unknown }
    ).IntersectionObserver = MockIntersectionObserver;
  });

  const renderHarness = (
    fetchPage: (after?: string) => Promise<InboxListPage<Item> | undefined>
  ) =>
    render(<Harness fetchPage={fetchPage} onApi={(value) => (api = value)} />);

  it('loads the first page and exposes items/total', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 1 }], paging: { total: 5 } });

    await act(async () => {
      renderHarness(fetchPage);
    });

    await waitFor(() => expect(api.items).toHaveLength(1));

    expect(fetchPage).toHaveBeenCalledWith(undefined);
    expect(api.total).toBe(5);
    expect(api.isLoading).toBe(false);
  });

  it('loads the next page when the sentinel intersects', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        paging: { after: 'c1', total: 5 },
      })
      .mockResolvedValueOnce({ data: [{ id: 2 }], paging: { total: 5 } });

    await act(async () => {
      renderHarness(fetchPage);
    });
    await waitFor(() => expect(api.items).toHaveLength(1));

    await act(async () => {
      intersect?.();
    });

    await waitFor(() => expect(api.items.map((i) => i.id)).toEqual([1, 2]));

    expect(fetchPage).toHaveBeenLastCalledWith('c1');
  });

  it('shows an error toast when a page fetch rejects', async () => {
    const fetchPage = jest.fn().mockRejectedValue(new Error('boom'));

    await act(async () => {
      renderHarness(fetchPage);
    });

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(api.items).toHaveLength(0);
  });

  it('reloads from the first page when fetchPage identity changes', async () => {
    const first = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 1 }], paging: { total: 1 } });
    const second = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 9 }], paging: { total: 1 } });

    const view = await act(async () =>
      render(<Harness fetchPage={first} onApi={(value) => (api = value)} />)
    );
    await waitFor(() => expect(api.items[0].id).toBe(1));

    await act(async () => {
      view.rerender(
        <Harness fetchPage={second} onApi={(value) => (api = value)} />
      );
    });

    await waitFor(() => expect(api.items[0]?.id).toBe(9));

    expect(second).toHaveBeenCalledWith(undefined);
  });

  it('exposes setItems and setTotal for optimistic updates', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 1 }], paging: { total: 3 } });

    await act(async () => {
      renderHarness(fetchPage);
    });
    await waitFor(() => expect(api.items).toHaveLength(1));

    await act(async () => {
      api.setItems((prev) => prev.filter((i) => i.id !== 1));
      api.setTotal((prev) => prev - 1);
    });

    expect(api.items).toHaveLength(0);
    expect(api.total).toBe(2);
  });
});

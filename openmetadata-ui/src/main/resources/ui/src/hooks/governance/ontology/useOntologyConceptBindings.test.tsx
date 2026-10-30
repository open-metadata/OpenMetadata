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
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AssetType } from '../../../generated/api/data/updateOntologyConceptBinding';
import { OntologyConceptBindingsResponse } from '../../../generated/type/ontologyConceptBindingsResponse';
import {
  BindingSnapshot,
  BindingWriteOutcome,
} from '../../../interface/governance/ontology/ontologyConceptBindings.types';
import APIClient from '../../../rest/axiosClient';
import { useOntologyConceptBindings } from './useOntologyConceptBindings';

jest.mock('../../../rest/axiosClient', () => ({
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

const http = APIClient as jest.Mocked<typeof APIClient>;
const key = ['ontology-concept-bindings', 'customer'];
const request = {
  expectedRevision: 0,
  asset: { assetId: 'new', assetType: AssetType.Table, columns: [] },
};
const page = (
  name = 'customers',
  revision = 0
): OntologyConceptBindingsResponse => ({
  revision,
  assets: [
    {
      assetId: name,
      assetType: AssetType.Table,
      asset: { id: name, type: 'table', name },
      columns: [],
    },
  ],
});
const snapshot = (name = 'customers', revision = 0): BindingSnapshot => ({
  kind: 'complete',
  ...page(name, revision),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const clients: QueryClient[] = [];
const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
};

describe('native concept binding ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    http.get.mockResolvedValue({ data: page() });
    http.put.mockResolvedValue({
      data: { revision: 999, assets: [], after: 'mutation-page' },
    });
    http.delete.mockResolvedValue({
      data: { revision: 999, assets: [], after: 'mutation-page' },
    });
  });

  afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
    onlineManager.setOnline(true);
    jest.useFakeTimers();
  });

  it('reserves a concept synchronously across hooks through complete reconciliation', async () => {
    const { client, wrapper } = setup();
    const first = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });
    const second = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });
    await waitFor(() =>
      expect(first.result.current.editableSnapshot).toEqual(snapshot())
    );
    const write = deferred<{ data: OntologyConceptBindingsResponse }>();
    const read = deferred<{ data: OntologyConceptBindingsResponse }>();
    http.put.mockReturnValueOnce(write.promise);
    http.get.mockReturnValueOnce(read.promise);
    const publications: unknown[] = [];
    const unsubscribe = client
      .getQueryCache()
      .subscribe(() => publications.push(client.getQueryData(key)));
    let firstWrite!: Promise<BindingWriteOutcome>;
    let secondWrite!: Promise<BindingWriteOutcome>;
    act(() => {
      firstWrite = first.result.current.replaceAsset(request);
      secondWrite = second.result.current.removeAsset({
        assetId: 'customers',
        assetType: AssetType.Table,
        expectedRevision: 0,
      });
    });

    await expect(secondWrite).resolves.toEqual({ kind: 'not-ready' });

    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(second.result.current.editableSnapshot).toBeUndefined()
    );
    const mounted = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });

    expect(mounted.result.current.editableSnapshot).toBeUndefined();

    await act(async () => {
      await client.fetchQuery({ queryKey: key, staleTime: 0 });
    });

    expect(http.get).toHaveBeenCalledTimes(1);

    await act(async () =>
      write.resolve({
        data: { revision: 999, assets: [], after: 'mutation-page' },
      })
    );
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));

    expect(first.result.current.editableSnapshot).toBeUndefined();
    expect(mounted.result.current.editableSnapshot).toBeUndefined();

    await act(async () => read.resolve({ data: page('new', 1) }));

    await expect(firstWrite).resolves.toEqual({
      kind: 'confirmed',
      read: { kind: 'ready', snapshot: snapshot('new', 1) },
    });

    await waitFor(() =>
      expect(second.result.current.editableSnapshot).toEqual(snapshot('new', 1))
    );

    expect(http.delete).not.toHaveBeenCalled();
    expect(
      publications
        .filter(Boolean)
        .every(
          (value) =>
            JSON.stringify(value) === JSON.stringify(snapshot()) ||
            JSON.stringify(value) === JSON.stringify(snapshot('new', 1))
        )
    ).toBe(true);

    unsubscribe();
  });

  it('refuses a stale expected revision without rewriting the caller request', async () => {
    http.get.mockResolvedValue({ data: page('customers', 2) });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useOntologyConceptBindings('customer'),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.editableSnapshot?.revision).toBe(2)
    );

    await expect(result.current.replaceAsset(request)).resolves.toEqual({
      kind: 'not-ready',
    });
    expect(http.put).not.toHaveBeenCalled();
    expect(request.expectedRevision).toBe(0);
  });

  it.each(['replace', 'remove'] as const)(
    'keeps a confirmed %s confirmed after a later GET page fails and retries reads only',
    async (method) => {
      const { client, wrapper } = setup();
      const first = renderHook(() => useOntologyConceptBindings('customer'), {
        wrapper,
      });
      const second = renderHook(() => useOntologyConceptBindings('customer'), {
        wrapper,
      });
      await waitFor(() =>
        expect(first.result.current.editableSnapshot).toEqual(snapshot())
      );
      http.get
        .mockReset()
        .mockResolvedValueOnce({
          data: { revision: 1, assets: [], after: 'next' },
        })
        .mockRejectedValue(new Error('read unavailable'));
      let outcome: BindingWriteOutcome | undefined;
      await act(async () => {
        outcome =
          method === 'replace'
            ? await first.result.current.replaceAsset(request)
            : await first.result.current.removeAsset({
                expectedRevision: 0,
                assetId: 'customers',
                assetType: AssetType.Table,
              });
      });

      expect(outcome).toEqual({
        kind: 'confirmed',
        read: { kind: 'unavailable' },
      });

      await waitFor(() =>
        expect(second.result.current.readState).toBe('unavailable')
      );

      expect(client.getQueryData(key)).toEqual(snapshot());
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      expect(second.result.current.editableSnapshot).toBeUndefined();
      await expect(
        second.result.current.replaceAsset(request)
      ).resolves.toEqual({ kind: 'not-ready' });
      expect(http.get.mock.calls[0]).toEqual([
        '/ontologyConcepts/customer/bindings',
        { signal: undefined },
      ]);

      http.get
        .mockReset()
        .mockResolvedValue({ data: { revision: 1, assets: [] } });
      await act(async () => {
        await second.result.current.retryRead();
      });
      await waitFor(() =>
        expect(first.result.current.editableSnapshot).toEqual({
          kind: 'complete',
          revision: 1,
          assets: [],
        })
      );

      expect(http.put).toHaveBeenCalledTimes(method === 'replace' ? 1 : 0);
      expect(http.delete).toHaveBeenCalledTimes(method === 'remove' ? 1 : 0);
    }
  );

  it.each([
    {
      error: { isAxiosError: true, response: { status: 409 } },
      kind: 'conflict',
    },
    {
      error: { isAxiosError: true, response: { status: 500 } },
      kind: 'unconfirmed',
    },
    { error: new Error('response lost'), kind: 'unconfirmed' },
  ])(
    'preserves $kind even when reconciliation succeeds',
    async ({ error, kind }) => {
      const { wrapper } = setup();
      const { result } = renderHook(
        () => useOntologyConceptBindings('customer'),
        { wrapper }
      );
      await waitFor(() =>
        expect(result.current.editableSnapshot).toBeDefined()
      );
      http.put.mockRejectedValueOnce(error);
      http.get.mockResolvedValue({ data: page('new', 3) });
      await act(async () => {
        expect(await result.current.replaceAsset(request)).toEqual({ kind });
      });
      await waitFor(() =>
        expect(result.current.editableSnapshot?.revision).toBe(3)
      );

      expect(http.put).toHaveBeenCalledTimes(1);
    }
  );

  it('refuses an active read and never publishes its ignored-abort completion after a later write', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => useOntologyConceptBindings('customer'),
      { wrapper }
    );
    await waitFor(() => expect(result.current.editableSnapshot).toBeDefined());
    const oldRead = deferred<{ data: OntologyConceptBindingsResponse }>();
    http.get.mockReturnValueOnce(oldRead.promise);
    let refetch!: Promise<void>;
    act(() => {
      refetch = result.current.retryRead();
    });

    await expect(result.current.replaceAsset(request)).resolves.toEqual({
      kind: 'not-ready',
    });
    expect(http.put).not.toHaveBeenCalled();

    const signal = http.get.mock.calls[1][1]?.signal;
    await act(async () => {
      await client.cancelQueries({ queryKey: key, exact: true });
    });

    expect(signal?.aborted).toBe(true);

    http.get.mockResolvedValue({ data: page('new', 2) });
    await act(async () => {
      await result.current.replaceAsset(request);
    });
    await waitFor(() =>
      expect(result.current.editableSnapshot).toEqual(snapshot('new', 2))
    );
    await act(async () => {
      oldRead.resolve({ data: page('obsolete', 1) });
      await refetch;
    });

    expect(client.getQueryData(key)).toEqual(snapshot('new', 2));
    expect(result.current.editableSnapshot).toEqual(snapshot('new', 2));
  });

  it('publishes a new complete read starting revision and concurrent off-page columns', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useOntologyConceptBindings('customer'),
      { wrapper }
    );
    await waitFor(() => expect(result.current.editableSnapshot).toBeDefined());
    const offPage = {
      ...page('table', 5).assets[0],
      columns: [
        { propertyId: 'other', columnPath: ['concurrent'], state: 'resolved' },
      ],
    };
    http.get
      .mockReset()
      .mockResolvedValueOnce({
        data: { revision: 5, assets: [], after: 'empty' },
      })
      .mockResolvedValueOnce({
        data: { revision: 6, assets: [], after: 'last' },
      })
      .mockResolvedValueOnce({ data: { revision: 6, assets: [offPage] } });
    await act(async () => {
      await result.current.replaceAsset(request);
    });
    await waitFor(() =>
      expect(result.current.editableSnapshot).toEqual({
        kind: 'complete',
        revision: 5,
        assets: [offPage],
      })
    );
    http.put.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409 },
    });
    http.get.mockResolvedValue({ data: page('table', 6) });
    await act(async () => {
      expect(
        await result.current.replaceAsset({
          expectedRevision: 5,
          asset: {
            assetId: 'table',
            assetType: AssetType.Table,
            columns: [{ propertyId: 'other', columnPath: ['concurrent'] }],
          },
        })
      ).toEqual({ kind: 'conflict' });
    });

    expect(http.put.mock.calls[1][1]).toEqual({
      expectedRevision: 5,
      asset: {
        assetId: 'table',
        assetType: 'table',
        columns: [{ propertyId: 'other', columnPath: ['concurrent'] }],
      },
    });
  });

  it('isolates concept switches and completion after the origin unmounts', async () => {
    const { client, wrapper } = setup();
    http.get.mockImplementation(async (url) => ({
      data: url.includes('order') ? page('orders', 4) : page(),
    }));
    const origin = renderHook(({ id }) => useOntologyConceptBindings(id), {
      wrapper,
      initialProps: { id: 'customer' },
    });
    await waitFor(() =>
      expect(origin.result.current.editableSnapshot).toBeDefined()
    );
    const write = deferred<{ data: OntologyConceptBindingsResponse }>();
    http.put.mockReturnValueOnce(write.promise);
    let pending!: Promise<BindingWriteOutcome>;
    act(() => {
      pending = origin.result.current.replaceAsset(request);
    });
    origin.rerender({ id: 'order' });

    expect(origin.result.current.data).toBeUndefined();

    await waitFor(() =>
      expect(origin.result.current.editableSnapshot).toEqual(
        snapshot('orders', 4)
      )
    );
    origin.unmount();
    const remounted = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });

    expect(remounted.result.current.editableSnapshot).toBeUndefined();

    http.get.mockResolvedValue({ data: page('new', 1) });
    await act(async () => {
      write.resolve({ data: page('ignored', 100) });
      await pending;
    });
    await waitFor(() =>
      expect(remounted.result.current.editableSnapshot).toEqual(
        snapshot('new', 1)
      )
    );

    expect(client.getQueryData(['ontology-concept-bindings', 'order'])).toEqual(
      snapshot('orders', 4)
    );
  });

  it('retains the pending owner beyond query GC and remounts without a competing read', async () => {
    jest.useFakeTimers();
    const { client, wrapper } = setup();
    const origin = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });
    await waitFor(() =>
      expect(origin.result.current.editableSnapshot).toBeDefined()
    );
    const write = deferred<{ data: OntologyConceptBindingsResponse }>();
    http.put.mockReturnValueOnce(write.promise);
    let pending!: Promise<BindingWriteOutcome>;
    act(() => {
      pending = origin.result.current.replaceAsset(request);
    });
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
    origin.unmount();
    await act(async () => {
      jest.advanceTimersByTime(30_001);
    });

    expect(client.getQueryData(key)).toBeUndefined();

    const remounted = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });

    expect(remounted.result.current.editableSnapshot).toBeUndefined();
    expect(http.get).toHaveBeenCalledTimes(1);

    http.get.mockResolvedValue({ data: page('new', 1) });
    await act(async () => {
      write.resolve({ data: page('ignored', 99) });
      await pending;
      jest.advanceTimersByTime(1);
    });
    await waitFor(() =>
      expect(remounted.result.current.editableSnapshot).toEqual(
        snapshot('new', 1)
      )
    );
  });

  it('can recover a failed reconciliation after the original observer unmounts', async () => {
    const { wrapper } = setup();
    const origin = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });
    await waitFor(() =>
      expect(origin.result.current.editableSnapshot).toBeDefined()
    );
    http.get.mockRejectedValue(new Error('unavailable'));
    await act(async () => {
      await origin.result.current.replaceAsset(request);
    });
    origin.unmount();
    const mounted = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });

    expect(mounted.result.current.editableSnapshot).toBeUndefined();

    http.get.mockResolvedValue({ data: page('new', 1) });
    await act(async () => {
      await mounted.result.current.retryRead();
    });
    await waitFor(() =>
      expect(mounted.result.current.editableSnapshot).toEqual(
        snapshot('new', 1)
      )
    );

    expect(http.put).toHaveBeenCalledTimes(1);
  });

  it('removes edit authority when the complete query is invalidated without a refetch', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => useOntologyConceptBindings('customer'),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.editableSnapshot).toEqual(snapshot())
    );
    await act(async () => {
      await client.invalidateQueries({
        queryKey: key,
        exact: true,
        refetchType: 'none',
      });
    });

    expect(result.current.editableSnapshot).toBeUndefined();
    expect(result.current.data).toEqual(snapshot());
    expect(http.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retryRead();
    });
    await waitFor(() =>
      expect(result.current.editableSnapshot).toEqual(snapshot())
    );
  });

  it('keeps the 30-second query lifetime when reconciliation completes after unobserved GC', async () => {
    const { client, wrapper } = setup();
    const origin = renderHook(() => useOntologyConceptBindings('customer'), {
      wrapper,
    });
    await waitFor(() =>
      expect(origin.result.current.editableSnapshot).toBeDefined()
    );
    const write = deferred<{ data: OntologyConceptBindingsResponse }>();
    http.put.mockReturnValueOnce(write.promise);
    let pending!: Promise<BindingWriteOutcome>;
    act(() => {
      pending = origin.result.current.replaceAsset(request);
    });
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
    origin.unmount();
    await act(async () => {
      jest.advanceTimersByTime(30_001);
    });

    expect(client.getQueryData(key)).toBeUndefined();

    http.get.mockResolvedValue({ data: page('new', 1) });
    await act(async () => {
      write.resolve({ data: page('ignored', 99) });
      await pending;
    });

    expect(client.getQueryData(key)).toEqual(snapshot('new', 1));

    await act(async () => {
      jest.advanceTimersByTime(30_001);
    });

    expect(client.getQueryData(key)).toBeUndefined();
  });

  it('withholds edit authority during an offline paused read', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => useOntologyConceptBindings('customer'),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.editableSnapshot).toEqual(snapshot())
    );
    onlineManager.setOnline(false);
    act(() => {
      void result.current.retryRead();
    });
    await waitFor(() =>
      expect(client.getQueryState(key)?.fetchStatus).toBe('paused')
    );
    await waitFor(() =>
      expect(result.current.editableSnapshot).toBeUndefined()
    );

    await expect(result.current.replaceAsset(request)).resolves.toEqual({
      kind: 'not-ready',
    });
    expect(http.put).not.toHaveBeenCalled();

    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() =>
      expect(result.current.editableSnapshot).toEqual(snapshot())
    );
  });

  it.each(['replace', 'remove'] as const)(
    'never queues an offline %s for reconnection',
    async (method) => {
      const { wrapper } = setup();
      const { result } = renderHook(
        () => useOntologyConceptBindings('customer'),
        { wrapper }
      );
      await waitFor(() =>
        expect(result.current.editableSnapshot).toBeDefined()
      );
      onlineManager.setOnline(false);
      http.put.mockRejectedValue(new Error('offline'));
      http.delete.mockRejectedValue(new Error('offline'));
      http.get.mockRejectedValue(new Error('offline'));
      await act(async () => {
        const outcome =
          method === 'replace'
            ? await result.current.replaceAsset(request)
            : await result.current.removeAsset({
                expectedRevision: 0,
                assetId: 'customers',
                assetType: AssetType.Table,
              });

        expect(outcome).toEqual({ kind: 'unconfirmed' });
      });

      expect(http.put).toHaveBeenCalledTimes(method === 'replace' ? 1 : 0);
      expect(http.delete).toHaveBeenCalledTimes(method === 'remove' ? 1 : 0);

      http.get.mockResolvedValue({ data: page('new', 1) });
      await act(async () => {
        onlineManager.setOnline(true);
      });
      await act(async () => {
        await result.current.retryRead();
      });
      await waitFor(() =>
        expect(result.current.editableSnapshot).toEqual(snapshot('new', 1))
      );

      expect(http.put).toHaveBeenCalledTimes(method === 'replace' ? 1 : 0);
      expect(http.delete).toHaveBeenCalledTimes(method === 'remove' ? 1 : 0);
    }
  );
});

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
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  AssetType,
  OntologyConceptBindingsResponse,
} from '../../../generated/type/ontologyConceptBindingsResponse';
import {
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../rest/ontologyAPI';
import { useOntologyConceptBindings } from './useOntologyConceptBindings';

jest.mock('../../../rest/ontologyAPI');
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const response = (
  name: string,
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

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('native concept bindings', () => {
  beforeEach(() => jest.resetAllMocks());

  it('never shows the previous concept assets while the next concept loads', async () => {
    let resolveSecond: (value: OntologyConceptBindingsResponse) => void = (
      _value
    ) => undefined;
    (
      getOntologyConceptBindings as jest.MockedFunction<
        typeof getOntologyConceptBindings
      >
    )
      .mockResolvedValueOnce(response('customers'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );
    const { result, rerender } = renderHook(
      ({ id }) => useOntologyConceptBindings(id),
      { initialProps: { id: 'customer' }, wrapper: createWrapper() }
    );
    await waitFor(() =>
      expect(result.current.data?.assets[0].asset.name).toBe('customers')
    );
    rerender({ id: 'order' });

    expect(result.current.data).toBeUndefined();

    await act(async () => resolveSecond(response('orders')));
    await waitFor(() =>
      expect(result.current.data?.assets[0].asset.name).toBe('orders')
    );
  });

  it('applies an in-flight write only to the concept that started it', async () => {
    (
      getOntologyConceptBindings as jest.MockedFunction<
        typeof getOntologyConceptBindings
      >
    ).mockImplementation(async (id) => response(id));
    let resolveWrite: (value: OntologyConceptBindingsResponse) => void = (
      _value
    ) => undefined;
    (
      putOntologyConceptBinding as jest.MockedFunction<
        typeof putOntologyConceptBinding
      >
    ).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        })
    );
    const { result, rerender } = renderHook(
      ({ id }) => useOntologyConceptBindings(id),
      { initialProps: { id: 'customer' }, wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.data?.revision).toBe(0));
    act(() =>
      result.current.update.mutate({
        id: 'customer',
        request: {
          expectedRevision: 0,
          asset: { assetId: 'new', assetType: AssetType.Table, columns: [] },
        },
      })
    );
    rerender({ id: 'order' });
    await waitFor(() =>
      expect(result.current.data?.assets[0].asset.name).toBe('order')
    );
    await act(async () => resolveWrite(response('new', 1)));

    expect(result.current.data?.assets[0].asset.name).toBe('order');

    rerender({ id: 'customer' });
    await waitFor(() =>
      expect(result.current.data?.assets[0].asset.name).toBe('new')
    );

    expect(result.current.data?.revision).toBe(1);
  });
});

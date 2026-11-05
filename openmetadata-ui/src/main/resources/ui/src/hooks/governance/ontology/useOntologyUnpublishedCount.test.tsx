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
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  Access,
  Operation,
  ResourcePermission,
} from '../../../generated/entity/policies/accessControl/resourcePermission';
import { getEntityPermissionById } from '../../../rest/permissionAPI';
import { useApplicationStore } from '../../useApplicationStore';
import { useOntologyUnpublishedCount } from './useOntologyUnpublishedCount';

jest.mock('../../../rest/permissionAPI');
const permission = getEntityPermissionById as jest.MockedFunction<
  typeof getEntityPermissionById
>;
const allowed = {
  resource: 'ontology',
  permissions: [{ operation: Operation.EditAll, access: Access.Allow }],
};
const owner = (id: string, count?: number): Ontology => ({
  id,
  name: id,
  fullyQualifiedName: id,
  iri: `urn:${id}`,
  namespace: `urn:${id}:`,
  publicationStatus:
    count === undefined ? undefined : { unpublishedChanges: count },
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  useApplicationStore.setState({
    currentUser: { id: 'account-a', name: 'account-a', email: 'a@example.com' },
  });
  permission.mockReset().mockResolvedValue(allowed);
});

it('counts every editable positive owner beyond the aggregate limit without reading zero or deleted permissions', async () => {
  const owners = Array.from({ length: 25 }, (_, i) => owner(`o${i}`, 2));
  owners.push(
    owner('zero', 0),
    { ...owner('deleted', 99), deleted: true },
    owner('denied', 7)
  );
  permission.mockImplementation(async (_resource, id) =>
    id === 'denied'
      ? {
          ...allowed,
          permissions: [{ operation: Operation.EditAll, access: Access.Deny }],
        }
      : allowed
  );
  const { result } = renderHook(
    () => useOntologyUnpublishedCount(owners, true),
    { wrapper }
  );

  expect(result.current.status).toBe('loading');

  await waitFor(() =>
    expect(result.current).toEqual({ status: 'ready', count: 50 })
  );

  expect(permission.mock.calls.map(([, id]) => id)).not.toContain('zero');
  expect(permission.mock.calls.map(([, id]) => id)).not.toContain('deleted');
});

it.each(['missing-count', 'failed', 'unknown'])(
  'reports unavailable instead of a subtotal for %s',
  async (failure) => {
    if (failure === 'failed') {
      permission.mockRejectedValueOnce(new Error('offline'));
    }
    if (failure === 'unknown') {
      permission.mockResolvedValueOnce({
        resource: 'ontology',
        permissions: [],
      });
    }
    const owners = [
      owner('incomplete', failure === 'missing-count' ? undefined : 3),
      owner('known', 4),
    ];
    const { result } = renderHook(
      () => useOntologyUnpublishedCount(owners, true),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'unavailable' })
    );
  }
);

it('allows a missing count only when the owner is confirmed denied', async () => {
  permission.mockResolvedValue({
    ...allowed,
    permissions: [{ operation: Operation.EditAll, access: Access.NotAllow }],
  });
  const { result } = renderHook(
    () => useOntologyUnpublishedCount([owner('denied')], true),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current).toEqual({ status: 'ready', count: 0 })
  );
});

it('runs at most four reads and abandons old-account jobs and results', async () => {
  const pending: {
    signal?: AbortSignal;
    resolve: (value: ResourcePermission) => void;
  }[] = [];
  permission.mockImplementation(
    (_resource, _id, signal) =>
      new Promise((resolve) => pending.push({ signal, resolve }))
  );
  const owners = Array.from({ length: 12 }, (_, i) => owner(`o${i}`, 1));
  const { result, unmount } = renderHook(
    () => useOntologyUnpublishedCount(owners, true),
    { wrapper }
  );

  expect(pending).toHaveLength(4);

  await act(async () => {
    pending[0].resolve(allowed);
  });

  expect(pending).toHaveLength(5);

  act(() =>
    useApplicationStore.setState({
      currentUser: {
        id: 'account-b',
        name: 'account-b',
        email: 'b@example.com',
      },
    })
  );

  expect(pending.slice(0, 5).every(({ signal }) => signal?.aborted)).toBe(true);
  expect(pending).toHaveLength(9);

  await act(async () => {
    pending.slice(1, 5).forEach(({ resolve }) => resolve(allowed));
  });

  expect(pending).toHaveLength(9);
  expect(result.current.status).toBe('loading');

  unmount();

  expect(pending.every(({ signal }) => signal?.aborted)).toBe(true);
});

it('does not request permissions before scopes or account identity are ready', () => {
  useApplicationStore.setState({ currentUser: undefined });
  const { result } = renderHook(
    () => useOntologyUnpublishedCount([owner('a', 4)], true),
    { wrapper }
  );

  expect(result.current.status).toBe('loading');
  expect(permission).not.toHaveBeenCalled();
});

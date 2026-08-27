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
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Access } from '../../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../../generated/entity/policies/policy';
import { getEntityPermissionByFqn } from '../../rest/permissionAPI';
import { useBulkEntityPermissions } from './useBulkEntityPermissions';

jest.mock('../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn(),
}));

const mockApi = getEntityPermissionByFqn as jest.Mock;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useBulkEntityPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.mockImplementation((_r, fqn: string) =>
      fqn === 'bad'
        ? Promise.reject(new Error('403'))
        : Promise.resolve({
            resource: 'testCase',
            permissions: [{ operation: Operation.EditAll, access: Access.Allow }],
          })
    );
  });

  it('resolves a flags entry per fqn; failures degrade to no-permission', async () => {
    const { result } = renderHook(
      () => useBulkEntityPermissions(ResourceEntity.TEST_CASE, ['a', 'bad', 'c']),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.flagsByFqn['a'].canEditAll).toBe(true);
    expect(result.current.flagsByFqn['bad'].canEditAll).toBe(false);
    expect(result.current.flagsByFqn['c'].canEditAll).toBe(true);
  });

  it('does not refetch when the fqns array identity changes but content is equal', async () => {
    const { result, rerender } = renderHook(
      ({ fqns }) => useBulkEntityPermissions(ResourceEntity.TEST_CASE, fqns),
      { initialProps: { fqns: ['a', 'c'] }, wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const calls = mockApi.mock.calls.length;
    rerender({ fqns: ['a', 'c'] }); // new array, same content → same queryKeys → cache
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApi.mock.calls.length).toBe(calls);
  });

  it('empty fqns → empty maps, no fetch, not loading', () => {
    const { result } = renderHook(
      () => useBulkEntityPermissions(ResourceEntity.TEST_CASE, []),
      { wrapper: createWrapper() }
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.flagsByFqn).toEqual({});
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('shares cache with useEntityPermissions (same queryKey → one request)', async () => {
    const wrapper = createWrapper();
    const bulk = renderHook(
      () => useBulkEntityPermissions(ResourceEntity.TEST_CASE, ['a']),
      { wrapper }
    );
    await waitFor(() => expect(bulk.result.current.isLoading).toBe(false));
    expect(mockApi).toHaveBeenCalledTimes(1);
    // A second bulk hook over the same fqn hits the warm cache.
    const again = renderHook(
      () => useBulkEntityPermissions(ResourceEntity.TEST_CASE, ['a']),
      { wrapper }
    );
    await waitFor(() => expect(again.result.current.isLoading).toBe(false));
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
});

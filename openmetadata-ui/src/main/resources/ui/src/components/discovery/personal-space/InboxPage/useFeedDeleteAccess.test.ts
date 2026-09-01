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
import { Access } from 'generated/entity/policies/accessControl/resourcePermission';
import { getResourcePermission } from 'rest/permissionAPI';
import { createElement, ReactNode } from 'react';
import { useFeedDeleteAccess } from './useFeedDeleteAccess';

let mockCurrentUser: { name?: string; isAdmin?: boolean } = { name: 'bob' };

jest.mock('rest/permissionAPI', () => ({
  getResourcePermission: jest.fn(),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

const mockGetResourcePermission = getResourcePermission as jest.MockedFunction<
  typeof getResourcePermission
>;

describe('useFeedDeleteAccess', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { name: 'bob' };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => queryClient.clear());

  it('returns the evaluated Delete access for the feed resource', async () => {
    mockGetResourcePermission.mockResolvedValue({
      permissions: [
        { operation: 'ViewAll', access: 'allow' },
        { operation: 'Delete', access: 'conditionalAllow' },
      ],
    } as never);

    const { result } = renderHook(() => useFeedDeleteAccess(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe(Access.ConditionalAllow));

    // Conversation V2 renamed the policy resource behind comments; asking for
    // 'feed' yields no descriptor, which reads as "no Delete permission".
    expect(mockGetResourcePermission).toHaveBeenCalledWith('conversation');
  });

  it('defaults to NotAllow when the response has no Delete operation', async () => {
    mockGetResourcePermission.mockResolvedValue({
      permissions: [{ operation: 'ViewAll', access: 'allow' }],
    } as never);

    const { result } = renderHook(() => useFeedDeleteAccess(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe(Access.NotAllow));
  });

  it('defaults to NotAllow when the response has no permissions at all', async () => {
    mockGetResourcePermission.mockResolvedValue({} as never);

    const { result } = renderHook(() => useFeedDeleteAccess(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe(Access.NotAllow));
  });

  it('returns undefined and skips the fetch when disabled', () => {
    const { result } = renderHook(() => useFeedDeleteAccess(false), {
      wrapper,
    });

    expect(result.current).toBeUndefined();
    expect(mockGetResourcePermission).not.toHaveBeenCalled();
  });

  it('returns undefined and skips the fetch for admins', () => {
    mockCurrentUser = { name: 'carol', isAdmin: true };

    const { result } = renderHook(() => useFeedDeleteAccess(true), {
      wrapper,
    });

    expect(result.current).toBeUndefined();
    expect(mockGetResourcePermission).not.toHaveBeenCalled();
  });

  it('returns undefined when the fetch fails', async () => {
    mockGetResourcePermission.mockRejectedValue(new Error('perm fail'));

    const { result } = renderHook(() => useFeedDeleteAccess(true), {
      wrapper,
    });

    await waitFor(() => expect(mockGetResourcePermission).toHaveBeenCalled());

    expect(result.current).toBeUndefined();
  });
});

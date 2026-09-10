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
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

const mockGetUserActivity = jest.fn();
const mockListConversations = jest.fn();
const mockListVisibleTasks = jest.fn();

jest.mock('rest/activityAPI', () => ({
  getUserActivity: (...args: unknown[]) => mockGetUserActivity(...args),
}));

jest.mock('rest/conversationsAPI', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

jest.mock('rest/tasksAPI', () => ({
  listMyVisibleTasks: (...args: unknown[]) => mockListVisibleTasks(...args),
  TaskStatusGroup: { Open: 'Open', Closed: 'Closed' },
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'u1' } }),
}));

import { useInboxCounts } from './useInboxCounts';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient };
};

const sevenEvents = { data: Array.from({ length: 7 }, (_, i) => ({ id: i })) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserActivity.mockResolvedValue(sevenEvents);
  mockListConversations.mockResolvedValue({ data: [] });
  mockListVisibleTasks.mockResolvedValue({ paging: { total: 3 } });
});

describe('useInboxCounts', () => {
  it('counts the activity list length + task total', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInboxCounts('all'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activityCount).toBe(7);
    expect(result.current.taskCount).toBe(3);
    // Activity is the user's own events; default 30-day window, page size 200.
    expect(mockGetUserActivity).toHaveBeenCalledWith('u1', {
      days: 30,
      limit: 200,
    });
    expect(mockListVisibleTasks).toHaveBeenCalled();
  });

  it('keeps tasks visible-scoped alongside the activity count', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInboxCounts('me'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetUserActivity).toHaveBeenCalled();
    expect(mockListVisibleTasks).toHaveBeenCalled();
    expect(result.current.activityCount).toBe(7);
    expect(result.current.taskCount).toBe(3);
  });

  it('falls back to zero when the activity request rejects', async () => {
    mockGetUserActivity.mockRejectedValue(new Error('boom'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInboxCounts('all'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activityCount).toBe(0);
    // The task count still resolves independently.
    expect(result.current.taskCount).toBe(3);
  });

  it('dedups a shared window across two consumers into one fetch', async () => {
    const { wrapper } = createWrapper();
    const TwoConsumers = () => {
      const a = useInboxCounts('all');
      const b = useInboxCounts('all');

      return <span>{`${a.activityCount}-${b.activityCount}`}</span>;
    };

    render(<TwoConsumers />, { wrapper });

    await waitFor(() => screen.getByText('7-7'));

    // Same queryKey (scope/window) → react-query issues each fetch once.
    expect(mockGetUserActivity).toHaveBeenCalledTimes(1);
    expect(mockListVisibleTasks).toHaveBeenCalledTimes(1);
  });
});

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
import { createElement, PropsWithChildren } from 'react';
import { TaskType } from '../../../generated/api/tasks/createTask';
import { Task, TaskStatus } from '../../../generated/entity/tasks/task';
import { listMyAssignedTasks, listTasks } from '../../../rest/tasksAPI';
import { useMemoryConflictReviews } from './useMemoryConflictReviews';

jest.mock('../../../rest/tasksAPI', () => ({
  listTasks: jest.fn(),
  listMyAssignedTasks: jest.fn(),
}));

const mockListTasks = listTasks as jest.MockedFunction<typeof listTasks>;
const mockListMyAssignedTasks = listMyAssignedTasks as jest.MockedFunction<
  typeof listMyAssignedTasks
>;

const REVIEW = { id: 'task-1' } as Task;
const NEXT_REVIEW = { id: 'task-2' } as Task;

const OPEN_REVIEWS = expect.objectContaining({
  type: TaskType.MemoryConflictReview,
  status: TaskStatus.Open,
  fields: expect.stringContaining('payload'),
});

const wrapper = ({ children }: PropsWithChildren) =>
  createElement(
    QueryClientProvider,
    {
      client: new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      }),
    },
    children
  );

describe('useMemoryConflictReviews', () => {
  beforeEach(() => {
    mockListTasks.mockReset();
    mockListMyAssignedTasks.mockReset();
  });

  it('lists every open conflict review for an admin', async () => {
    mockListTasks.mockResolvedValue({
      data: [REVIEW],
      paging: { total: 3 },
    });

    const { result } = renderHook(() => useMemoryConflictReviews(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListTasks).toHaveBeenCalledWith(OPEN_REVIEWS);
    expect(mockListMyAssignedTasks).not.toHaveBeenCalled();
    expect(result.current.reviews).toEqual([REVIEW]);
    expect(result.current.total).toBe(3);
    expect(result.current.hasMore).toBe(false);
  });

  it('lists only the reviews assigned to anyone else', async () => {
    mockListMyAssignedTasks.mockResolvedValue({
      data: [REVIEW],
      paging: { total: 1 },
    });

    const { result } = renderHook(() => useMemoryConflictReviews(false), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListMyAssignedTasks).toHaveBeenCalledWith(OPEN_REVIEWS);
    expect(mockListTasks).not.toHaveBeenCalled();
    expect(result.current.total).toBe(1);
  });

  it('loads the next page of reviews after the ones already listed', async () => {
    mockListTasks
      .mockResolvedValueOnce({
        data: [REVIEW],
        paging: { total: 2, after: 'cursor-1' },
      })
      .mockResolvedValueOnce({ data: [NEXT_REVIEW], paging: { total: 2 } });

    const { result } = renderHook(() => useMemoryConflictReviews(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.hasMore).toBe(true));

    expect(result.current.reviews).toEqual([REVIEW]);

    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.reviews).toEqual([REVIEW, NEXT_REVIEW])
    );

    expect(mockListTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'cursor-1' })
    );
    expect(result.current.hasMore).toBe(false);
    expect(result.current.total).toBe(2);
  });

  it('has no reviews while the list fails to load', async () => {
    mockListTasks.mockRejectedValue(new Error('unavailable'));

    const { result } = renderHook(() => useMemoryConflictReviews(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reviews).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

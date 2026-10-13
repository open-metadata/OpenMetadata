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

const OPEN_REVIEWS = {
  type: TaskType.MemoryConflictReview,
  status: TaskStatus.Open,
};

const COUNT_REQUEST = expect.objectContaining({ ...OPEN_REVIEWS, limit: 1 });

const LIST_REQUEST = expect.objectContaining({
  ...OPEN_REVIEWS,
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

  it('counts every open review for an admin without listing them', async () => {
    mockListTasks.mockResolvedValue({ data: [REVIEW], paging: { total: 3 } });

    const { result } = renderHook(() => useMemoryConflictReviews(true, false), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isCountLoading).toBe(false));

    expect(result.current.total).toBe(3);
    expect(mockListTasks).toHaveBeenCalledTimes(1);
    expect(mockListTasks).toHaveBeenCalledWith(COUNT_REQUEST);
    expect(result.current.reviews).toEqual([]);
  });

  it('lists the reviews assigned to anyone else while they are shown', async () => {
    mockListMyAssignedTasks.mockResolvedValue({
      data: [REVIEW],
      paging: { total: 1 },
    });

    const { result } = renderHook(() => useMemoryConflictReviews(false, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.reviews).toEqual([REVIEW]));

    expect(mockListMyAssignedTasks).toHaveBeenCalledWith(LIST_REQUEST);
    expect(mockListTasks).not.toHaveBeenCalled();
    expect(result.current.hasMore).toBe(false);
  });

  it('loads the next page of reviews after the ones already listed', async () => {
    mockListTasks.mockImplementation(async (params) => {
      if (params?.limit === 1) {
        return { data: [REVIEW], paging: { total: 2 } };
      }

      return params?.after
        ? { data: [NEXT_REVIEW], paging: { total: 2 } }
        : { data: [REVIEW], paging: { total: 2, after: 'cursor-1' } };
    });

    const { result } = renderHook(() => useMemoryConflictReviews(true, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.reviews).toEqual([REVIEW, NEXT_REVIEW])
    );

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ after: 'cursor-1' })
    );
    expect(result.current.hasMore).toBe(false);
    expect(result.current.total).toBe(2);
  });

  it('says the reviews failed to load, and loads them again on retry', async () => {
    let listings = 0;
    mockListTasks.mockImplementation(async (params) => {
      if (params?.limit === 1) {
        return { data: [], paging: { total: 1 } };
      }
      listings += 1;
      if (listings === 1) {
        throw new Error('unavailable');
      }

      return { data: [REVIEW], paging: { total: 1 } };
    });

    const { result } = renderHook(() => useMemoryConflictReviews(true, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.reviews).toEqual([REVIEW]));

    expect(result.current.isError).toBe(false);
  });
});

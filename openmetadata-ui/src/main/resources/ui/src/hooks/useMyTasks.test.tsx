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

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { TaskCategory } from '../generated/entity/tasks/task';
import { queryClient } from '../queryClient';
import { listMyAssignedTasks, TaskStatusGroup } from '../rest/tasksAPI';
import { MyTaskBucket } from '../utils/myTaskBuckets';
import { MY_TASKS_PAGE_SIZE, useMyTasks } from './useMyTasks';

jest.mock('../rest/tasksAPI', () => ({
  ...jest.requireActual('../rest/tasksAPI'),
  listMyAssignedTasks: jest.fn(),
}));

const mockList = listMyAssignedTasks as jest.MockedFunction<
  typeof listMyAssignedTasks
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useMyTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('reads one page of the viewer’s open tasks, including team ones', async () => {
    mockList.mockResolvedValue({
      data: [
        { category: TaskCategory.Incident, id: '1' },
        { category: TaskCategory.DataAccess, id: '2' },
        { category: TaskCategory.Approval, id: '3' },
      ],
      paging: { total: 25 },
    } as never);

    const { result } = renderHook(() => useMyTasks(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: MY_TASKS_PAGE_SIZE,
        statusGroup: TaskStatusGroup.Open,
      })
    );
    expect(result.current.total).toBe(25);
    expect(result.current.tasks).toHaveLength(3);
    expect(result.current.counts).toEqual({
      [MyTaskBucket.ALL]: 25,
      [MyTaskBucket.INCIDENTS]: 1,
      [MyTaskBucket.ACCESS]: 1,
      [MyTaskBucket.APPROVALS]: 1,
    });
  });

  it('falls back to the page length when the server sends no total', async () => {
    mockList.mockResolvedValue({
      data: [{ category: TaskCategory.Approval, id: '1' }],
      paging: {},
    } as never);

    const { result } = renderHook(() => useMyTasks(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(1);
  });
});

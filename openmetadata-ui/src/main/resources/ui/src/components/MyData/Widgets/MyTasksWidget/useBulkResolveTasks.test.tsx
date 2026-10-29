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
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import {
  Task,
  TaskCategory,
  TaskStatus,
} from '../../../../generated/entity/tasks/task';
import { queryClient } from '../../../../queryClient';
import { resolveTask, TaskResolutionType } from '../../../../rest/tasksAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  TASK_LIST_QUERY_KEY,
  TASK_STATUS_COUNTS_QUERY_KEY,
} from '../../../discovery/personal-space/inbox.constants';
import { useBulkResolveTasks } from './useBulkResolveTasks';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../../rest/tasksAPI'),
  resolveTask: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockResolve = resolveTask as jest.MockedFunction<typeof resolveTask>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const workflowTask = (id: string, requiresComment = false) =>
  ({
    availableTransitions: [
      {
        id: 'approve',
        label: 'Approve',
        requiresComment,
        resolutionType: TaskResolutionType.Approved,
        targetStageId: 'approved',
        targetTaskStatus: TaskStatus.Approved,
      },
      {
        id: 'reject',
        label: 'Reject',
        resolutionType: TaskResolutionType.Rejected,
        targetStageId: 'rejected',
        targetTaskStatus: TaskStatus.Rejected,
      },
    ],
    category: TaskCategory.Approval,
    id,
    status: TaskStatus.Open,
  } as unknown as Task);

describe('useBulkResolveTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('resolves each task through its own workflow transition', async () => {
    mockResolve.mockResolvedValue({} as Task);
    const { result } = renderHook(() => useBulkResolveTasks(), { wrapper });

    await act(() =>
      result.current.resolveTasks({
        decision: 'reject',
        tasks: [workflowTask('a'), workflowTask('b')],
      })
    );

    expect(mockResolve).toHaveBeenCalledTimes(2);
    expect(mockResolve).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({
        resolutionType: TaskResolutionType.Rejected,
        transitionId: 'reject',
      })
    );
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.count-tasks-resolved {"count":2}'
    );
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  // The server 400s a transition that requires a comment and gets none, so
  // such a task is left for the tasks page rather than sent half-filled.
  it('skips a task whose action needs input, and says so', async () => {
    mockResolve.mockResolvedValue({} as Task);
    const { result } = renderHook(() => useBulkResolveTasks(), { wrapper });

    await act(() =>
      result.current.resolveTasks({
        decision: 'approve',
        tasks: [workflowTask('a'), workflowTask('needs-comment', true)],
      })
    );

    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith('a', expect.anything());
    expect(showErrorToast).toHaveBeenCalledWith(
      'message.count-tasks-not-resolved {"count":1}'
    );
  });

  // The inbox keeps its lists and status totals for 30s; a resolve from the
  // card must not leave a visit inside that window showing the task as open.
  it('marks the inbox task lists and status totals stale', async () => {
    mockResolve.mockResolvedValue({} as Task);
    const inboxList = [TASK_LIST_QUERY_KEY, 'me', 'open', ''];
    const inboxCounts = [TASK_STATUS_COUNTS_QUERY_KEY, 'me', 'all'];
    queryClient.setQueryData(inboxList, { pages: [] });
    queryClient.setQueryData(inboxCounts, { open: 1 });
    const { result } = renderHook(() => useBulkResolveTasks(), { wrapper });

    await act(() =>
      result.current.resolveTasks({
        decision: 'approve',
        tasks: [workflowTask('a')],
      })
    );

    expect(queryClient.getQueryState(inboxList)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(inboxCounts)?.isInvalidated).toBe(true);
  });

  it('keeps going when one resolve fails', async () => {
    mockResolve
      .mockRejectedValueOnce(new Error('gone'))
      .mockResolvedValueOnce({} as Task);
    const { result } = renderHook(() => useBulkResolveTasks(), { wrapper });

    let outcome:
      | Awaited<ReturnType<typeof result.current.resolveTasks>>
      | undefined;
    await act(async () => {
      outcome = await result.current.resolveTasks({
        decision: 'approve',
        tasks: [workflowTask('a'), workflowTask('b')],
      });
    });

    // The failed one is handed back so the card can keep it selected.
    expect(outcome?.unresolvedIds).toEqual(['a']);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.count-tasks-resolved {"count":1}'
    );
    expect(showErrorToast).toHaveBeenCalledWith(
      'message.count-tasks-not-resolved {"count":1}'
    );
  });
});

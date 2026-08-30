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
import type { ReactNode } from 'react';
import type { CreateTask } from '../../../generated/api/tasks/createTask';
import {
  TaskCategory,
  TaskPriority,
  TaskType,
} from '../../../generated/api/tasks/createTask';
import { ConversationFilterType } from '../../../generated/type/conversationFilterType';
import { getEntityActivityByFqn } from '../../../rest/activityAPI';
import {
  createConversation,
  createConversationReply,
  listConversations,
} from '../../../rest/conversationsAPI';
import { createTask, getTaskCounts, listTasks } from '../../../rest/tasksAPI';
import { useMetricActivity } from './useMetricActivity';

jest.mock('../../../rest/activityAPI', () => ({
  getEntityActivityByFqn: jest.fn(),
}));
jest.mock('../../../rest/conversationsAPI', () => ({
  createConversation: jest.fn(),
  createConversationReply: jest.fn(),
  listConversations: jest.fn(),
}));
jest.mock('../../../rest/tasksAPI', () => ({
  TaskStatusGroup: { Closed: 'closed', Open: 'open' },
  addTaskComment: jest.fn(),
  closeTask: jest.fn(),
  createTask: jest.fn(),
  getTaskCounts: jest.fn(),
  listTasks: jest.fn(),
  resolveTask: jest.fn(),
}));

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useMetricActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [{ id: 'event-1', timestamp: 10 }],
      paging: { total: 75 },
    });
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (createConversation as jest.Mock).mockResolvedValue({
      id: 'conversation-1',
    });
    (createConversationReply as jest.Mock).mockResolvedValue({ id: 'reply-1' });
    (getTaskCounts as jest.Mock).mockResolvedValue({
      completed: 2,
      open: 3,
      total: 5,
    });
    (listTasks as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (createTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
  });

  it('loads activity in explicit increments instead of truncating at fifty', async () => {
    const { result } = renderHook(
      () =>
        useMetricActivity({
          metricFqn: 'revenue',
          status: 'open',
          tab: 'all',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.activity).toHaveLength(1));

    expect(result.current.hasMoreActivity).toBe(true);

    await waitFor(() =>
      expect(result.current.counts?.conversationCount).toBe(75)
    );

    expect(getEntityActivityByFqn).toHaveBeenCalledWith('metric', 'revenue', {
      days: 30,
      limit: 50,
    });

    act(() => result.current.loadMoreActivity());
    await waitFor(() =>
      expect(getEntityActivityByFqn).toHaveBeenCalledWith('metric', 'revenue', {
        days: 30,
        limit: 100,
      })
    );
  });

  it('scopes mention feeds to the signed-in user', async () => {
    renderHook(
      () =>
        useMetricActivity({
          currentUserId: 'user-1',
          metricFqn: 'revenue',
          status: 'open',
          tab: 'mentions',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(listConversations).toHaveBeenCalled());

    expect(listConversations).toHaveBeenCalledWith({
      entityLink: '<#E::metric::revenue>',
      filterType: ConversationFilterType.Mentions,
      limit: 50,
      userId: 'user-1',
    });
  });

  it('creates conversations and replies through the current APIs', async () => {
    const { result } = renderHook(
      () =>
        useMetricActivity({
          metricFqn: 'revenue',
          status: 'open',
          tab: 'all',
        }),
      { wrapper: createWrapper() }
    );

    await act(async () =>
      result.current.createComment(undefined, 'Discuss revenue')
    );
    await act(async () =>
      result.current.replyToThread('conversation-1', 'Agreed')
    );

    expect(createConversation).toHaveBeenCalledWith({
      about: '<#E::metric::revenue>',
      message: 'Discuss revenue',
    });
    expect(createConversationReply).toHaveBeenCalledWith('conversation-1', {
      message: 'Agreed',
    });
  });

  it('creates metric metadata tasks and refreshes task state', async () => {
    const { result } = renderHook(
      () =>
        useMetricActivity({
          metricFqn: 'revenue',
          status: 'open',
          tab: 'tasks',
        }),
      { wrapper: createWrapper() }
    );
    const task: CreateTask = {
      about: '<#E::metric::revenue>',
      assignees: ['alice'],
      category: TaskCategory.MetadataUpdate,
      name: 'Clarify definition',
      payload: {
        currentDescription: '',
        fieldPath: 'description',
        newDescription: 'Net recurring revenue',
      },
      priority: TaskPriority.Medium,
      type: TaskType.DescriptionUpdate,
    };

    await act(async () => result.current.createTask(task));

    expect(createTask).toHaveBeenCalledWith(task);
  });
});

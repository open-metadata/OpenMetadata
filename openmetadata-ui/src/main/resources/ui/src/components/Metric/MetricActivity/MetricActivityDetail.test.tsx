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
import { fireEvent, render, screen } from '@testing-library/react';
import { ConversationSource } from '../../../generated/entity/feed/conversation';
import type { Task } from '../../../generated/entity/tasks/task';
import { TaskStatus, TaskType } from '../../../generated/entity/tasks/task';
import MetricActivityDetail from './MetricActivityDetail';

jest.mock('./MetricCommentComposer', () => ({
  __esModule: true,
  default: ({
    isDisabled,
    labelKey = 'label.comment',
    onSubmit,
  }: {
    isDisabled?: boolean;
    labelKey?: string;
    onSubmit: (message: string) => Promise<unknown>;
  }) => (
    <button disabled={isDisabled} onClick={() => onSubmit('A reply')}>
      {labelKey}
    </button>
  ),
}));

const baseProps = {
  canComment: true,
  canResolveTasks: true,
  isCommenting: false,
  isResolvePermissionLoading: false,
  isResolvingTask: false,
  onClose: jest.fn(),
  onCreateComment: jest.fn(),
  onReply: jest.fn().mockResolvedValue({}),
  onRetryResolvePermission: jest.fn(),
  onResolveTask: jest.fn().mockResolvedValue({}),
  onTaskComment: jest.fn(),
};

describe('MetricActivityDetail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders conversation replies and posts a new reply', () => {
    render(
      <MetricActivityDetail
        {...baseProps}
        selection={{
          kind: 'thread',
          value: {
            about: '<#E::metric::revenue>',
            createdAt: 10,
            createdBy: { id: 'alice-id', name: 'alice', type: 'user' },
            entityRef: { id: 'metric-1', type: 'metric' },
            id: 'thread-1',
            message: 'Please clarify',
            replies: [],
            replyCount: 0,
            resolved: false,
            source: ConversationSource.User,
            updatedAt: 10,
          },
        }}
      />
    );

    expect(screen.getByTestId('metric-thread-detail')).toHaveTextContent(
      'label.no-entity-available'
    );

    fireEvent.click(screen.getByText('label.reply'));

    expect(baseProps.onReply).toHaveBeenCalledWith('thread-1', 'A reply');
  });

  it('shows only permitted task transitions and resolves by transition id', () => {
    const task = {
      availableTransitions: [
        {
          id: 'approve-transition',
          label: 'Approve metric',
          requiresComment: false,
          targetStageId: 'approved',
          targetTaskStatus: TaskStatus.Approved,
        },
        {
          id: 'reject-transition',
          label: 'label.reject',
          requiresComment: false,
          targetStageId: 'rejected',
          targetTaskStatus: TaskStatus.Rejected,
        },
      ],
      createdAt: 10,
      id: 'task-1',
      name: 'Clarify definition',
      status: TaskStatus.Open,
      type: TaskType.RequestApproval,
    } as Task;
    const { rerender } = render(
      <MetricActivityDetail
        {...baseProps}
        canResolveTasks={false}
        selection={{ kind: 'task', value: task }}
      />
    );

    expect(screen.queryByText('label.reject')).not.toBeInTheDocument();

    rerender(
      <MetricActivityDetail
        {...baseProps}
        selection={{ kind: 'task', value: task }}
      />
    );

    expect(screen.getByText('label.open')).toBeVisible();
    expect(screen.getByText('label.approval')).toBeVisible();

    fireEvent.click(screen.getByText('label.approve'));

    expect(baseProps.onResolveTask).toHaveBeenCalledWith(
      'task-1',
      'approve-transition',
      undefined
    );

    fireEvent.click(screen.getByText('label.reject'));

    expect(baseProps.onResolveTask).toHaveBeenCalledWith(
      'task-1',
      'reject-transition',
      undefined
    );
  });

  it('shows a loading status without flashing task resolution actions', () => {
    render(
      <MetricActivityDetail
        {...baseProps}
        isResolvePermissionLoading
        canResolveTasks={false}
        selection={{
          kind: 'task',
          value: {
            createdAt: 10,
            id: 'task-1',
            name: 'Clarify definition',
            status: TaskStatus.Open,
            type: TaskType.DescriptionUpdate,
          } as Task,
        }}
      />
    );

    expect(screen.getByRole('status', { name: 'label.loading' })).toBeVisible();
    expect(screen.queryByText('label.resolve')).not.toBeInTheDocument();
  });

  it('offers retry when task permission loading fails', () => {
    render(
      <MetricActivityDetail
        {...baseProps}
        canResolveTasks={false}
        resolvePermissionError={new Error('permission unavailable')}
        selection={{
          kind: 'task',
          value: {
            createdAt: 10,
            id: 'task-1',
            name: 'Clarify definition',
            status: TaskStatus.Open,
            type: TaskType.DescriptionUpdate,
          } as Task,
        }}
      />
    );

    fireEvent.click(screen.getByText('label.try-again'));

    expect(baseProps.onRetryResolvePermission).toHaveBeenCalledTimes(1);
  });
});

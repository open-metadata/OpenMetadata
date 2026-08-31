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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ConversationSource } from '../../../generated/entity/feed/conversation';
import type { Task } from '../../../generated/entity/tasks/task';
import { TaskStatus, TaskType } from '../../../generated/entity/tasks/task';
import type { MetricActivityListItem } from './MetricActivity.types';
import MetricActivityItem from './MetricActivityItem';
import MetricTaskItem from './MetricTaskItem';

describe('Metric activity list items', () => {
  it('selects a conversation with Enter and Space', async () => {
    const onSelect = jest.fn();
    const item = {
      id: 'thread-1',
      kind: 'thread',
      timestamp: 10,
      value: {
        about: '<#E::metric::revenue>',
        createdAt: 10,
        createdBy: { id: 'alice-id', name: 'alice', type: 'user' },
        entityRef: { id: 'metric-1', type: 'metric' },
        id: 'thread-1',
        message: 'Please clarify the definition',
        replyCount: 2,
        resolved: false,
        source: ConversationSource.User,
        updatedAt: 10,
      },
    } as MetricActivityListItem;
    render(
      <MetricActivityItem isActive={false} item={item} onSelect={onSelect} />
    );

    const button = screen.getByRole('button', {
      name: 'Please clarify the definition',
    });

    expect(button).toHaveAttribute('aria-pressed', 'false');

    act(() => button.focus());
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/label.reply-lowercase-plural/)).toHaveTextContent(
      'label.reply-lowercase-plural: 2'
    );
  });

  it('selects a task and exposes its localized empty assignee state', () => {
    const onSelect = jest.fn();
    const task = {
      createdAt: 10,
      id: 'task-1',
      name: 'Clarify definition',
      status: TaskStatus.Open,
    } as Task;
    const { rerender } = render(
      <MetricTaskItem isActive task={task} onSelect={onSelect} />
    );

    const button = screen.getByRole('button', { name: 'Clarify definition' });

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('label.open')).toBeVisible();
    expect(screen.getByText(/label.empty-dash/)).toBeVisible();

    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);

    [
      [TaskStatus.InProgress, 'label.running'],
      [TaskStatus.Approved, 'label.approved'],
      [TaskStatus.Rejected, 'label.rejected'],
    ].forEach(([status, label]) => {
      rerender(
        <MetricTaskItem
          isActive
          task={{ ...task, status: status as TaskStatus }}
          onSelect={onSelect}
        />
      );

      expect(screen.getByText(label)).toBeVisible();
    });
  });

  it('offers approval workflow navigation only for approval tasks', () => {
    const onReviewApproval = jest.fn();
    const task = {
      createdAt: 10,
      id: 'approval-task-1',
      name: 'Approve revenue metric',
      status: TaskStatus.Open,
      type: TaskType.RequestApproval,
    } as Task;
    const { rerender } = render(
      <MetricTaskItem
        isActive={false}
        task={task}
        onReviewApproval={onReviewApproval}
        onSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('metric-task-review-approval-task-1'));

    expect(onReviewApproval).toHaveBeenCalledTimes(1);

    rerender(
      <MetricTaskItem
        isActive={false}
        task={{ ...task, type: TaskType.DescriptionUpdate }}
        onReviewApproval={onReviewApproval}
        onSelect={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('metric-task-review-approval-task-1')
    ).not.toBeInTheDocument();
  });

  it('localizes enum activity and field fallbacks', () => {
    const item = {
      id: 'activity-1',
      kind: 'activity',
      timestamp: 10,
      value: {
        entity: { id: 'metric-1', type: 'metric' },
        eventType: 'DescriptionUpdated',
        fieldName: 'description',
        id: 'activity-1',
        timestamp: 10,
      },
    } as MetricActivityListItem;

    render(
      <MetricActivityItem isActive={false} item={item} onSelect={jest.fn()} />
    );

    expect(screen.getByRole('button')).toHaveTextContent(
      'label.description · label.updated'
    );
    expect(screen.getByRole('button')).not.toHaveTextContent(
      'DescriptionUpdated'
    );
  });
});

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
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import type { Task } from '../../../generated/entity/tasks/task';
import { TaskStatus, TaskType } from '../../../generated/entity/tasks/task';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import MetricActivityTab from './MetricActivityTab.component';
import { useMetricActivity } from './useMetricActivity';
import { useMetricTaskResolutionPermission } from './useMetricTaskResolutionPermission';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('./useMetricActivity');
jest.mock('./useMetricTaskResolutionPermission');
jest.mock('./MetricCommentComposer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-comment-composer" />,
}));
jest.mock('./MetricTaskCreateDialog', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mock-task-dialog" /> : null,
}));

const metric: Metric = {
  fullyQualifiedName: 'revenue',
  id: 'metric-1',
  name: 'revenue',
};
const refetchActivity = jest.fn();
const baseState = {
  activity: [],
  activityError: undefined,
  addTaskComment: jest.fn(),
  counts: {
    closedTaskCount: 0,
    conversationCount: 0,
    mentionCount: 0,
    openTaskCount: 0,
    totalCount: 0,
    totalTasksCount: 0,
  },
  createComment: jest.fn(),
  createTask: jest.fn(),
  createTaskError: undefined,
  hasMoreActivity: false,
  hasMoreTasks: false,
  isActivityLoading: false,
  isCommenting: false,
  isCreatingTask: false,
  isLoadingMoreActivity: false,
  isLoadingMoreTasks: false,
  isResolvingTask: false,
  isTasksLoading: false,
  loadMoreActivity: jest.fn(),
  loadMoreTasks: jest.fn(),
  mutationError: undefined,
  refetchActivity,
  refetchTasks: jest.fn(),
  replyToThread: jest.fn(),
  resolveTask: jest.fn(),
  tasks: [],
  tasksError: undefined,
};

describe('MetricActivityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMetricActivity as jest.Mock).mockReturnValue(baseState);
    (useMetricTaskResolutionPermission as jest.Mock).mockReturnValue({
      canResolve: false,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  it('renders accessible loading and read-only states', () => {
    (useMetricActivity as jest.Mock).mockReturnValue({
      ...baseState,
      isActivityLoading: true,
    });
    render(<MetricActivityTab canCreateThread={false} metric={metric} />);

    expect(screen.getByTestId('metric-activity-tab')).toHaveClass(
      'tw:px-4',
      'tw:py-6',
      'tw:md:px-8'
    );
    expect(
      screen.getByRole('tablist', { name: 'label.activity' })
    ).toBeVisible();
    expect(screen.getByRole('list', { name: 'label.activity' })).toHaveClass(
      'tw:list-none',
      'tw:flex'
    );
    expect(
      screen.getByRole('region', { name: 'label.activity' })
    ).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.queryByTestId('mock-comment-composer')
    ).not.toBeInTheDocument();
  });

  it('renders a working retry action for activity errors', () => {
    (useMetricActivity as jest.Mock).mockReturnValue({
      ...baseState,
      activityError: new Error('network'),
    });
    render(<MetricActivityTab canCreateThread={false} metric={metric} />);

    fireEvent.click(screen.getByText('label.try-again'));

    expect(refetchActivity).toHaveBeenCalledTimes(1);
  });

  it('does not expose task creation to a user without permission', () => {
    render(<MetricActivityTab canCreateTasks={false} metric={metric} />);
    fireEvent.click(screen.getByRole('tab', { name: /label.task-plural/ }));

    expect(screen.queryByTestId('metric-task-create')).not.toBeInTheDocument();
    expect(screen.getByText('message.no-open-tasks-title')).toBeVisible();
  });

  it('navigates approval requests to the Metric approval tab', () => {
    const approvalTask = {
      createdAt: 10,
      id: 'approval-task-1',
      name: 'Approve revenue metric',
      status: TaskStatus.Open,
      type: TaskType.RequestApproval,
    } as Task;
    (useMetricActivity as jest.Mock).mockReturnValue({
      ...baseState,
      tasks: [approvalTask],
    });
    render(<MetricActivityTab metric={metric} />);

    fireEvent.click(screen.getByRole('tab', { name: /label.task-plural/ }));
    fireEvent.click(screen.getByTestId('metric-task-review-approval-task-1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      getEntityDetailsPath(EntityType.METRIC, 'revenue', EntityTabs.APPROVAL),
      { replace: true }
    );
  });

  it('renders activity as semantic list items with native button selection', () => {
    const onSelectActivity = {
      id: 'thread-1',
      kind: 'thread',
      timestamp: 10,
      value: {
        about: '<#E::metric::revenue>',
        createdAt: 10,
        createdBy: { id: 'alice-id', name: 'alice', type: 'user' },
        entityRef: { id: 'metric-1', type: 'metric' },
        id: 'thread-1',
        message: 'Clarify the metric',
        replyCount: 0,
        resolved: false,
        source: 'User',
        updatedAt: 10,
      },
    };
    (useMetricActivity as jest.Mock).mockReturnValue({
      ...baseState,
      activity: [onSelectActivity],
    });

    render(<MetricActivityTab canCreateThread={false} metric={metric} />);

    expect(screen.getByRole('list', { name: 'label.activity' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Clarify the metric' })
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

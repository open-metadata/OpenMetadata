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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Metric } from '../../../generated/entity/data/metric';
import { EntityStatus } from '../../../generated/entity/data/metric';
import type { User } from '../../../generated/entity/teams/user';
import { useEntityApprovalTask } from '../../../hooks/useEntityApprovalTask';
import MetricApprovalTab from './MetricApprovalTab.component';
import { useMetricApprovalHistory } from './useMetricApprovalHistory';

jest.mock('../../../hooks/useEntityApprovalTask');
jest.mock('./useMetricApprovalHistory', () => ({
  ...jest.requireActual('./useMetricApprovalHistory'),
  useMetricApprovalHistory: jest.fn(),
}));

const reviewer = { id: 'reviewer-1', name: 'reviewer' } as User;
const metric: Metric = {
  entityStatus: EntityStatus.InReview,
  fullyQualifiedName: 'revenue',
  id: 'metric-1',
  name: 'revenue',
  reviewers: [{ id: reviewer.id, name: reviewer.name, type: 'user' }],
};
const approve = jest.fn();
const reject = jest.fn();
const refetch = jest.fn();
const mockUseEntityApprovalTask = useEntityApprovalTask as jest.Mock;
const mockUseMetricApprovalHistory = useMetricApprovalHistory as jest.Mock;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('MetricApprovalTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    approve.mockResolvedValue({});
    reject.mockResolvedValue({});
    mockUseMetricApprovalHistory.mockReturnValue({
      data: [],
      error: undefined,
      isPending: false,
      refetch,
    });
    mockUseEntityApprovalTask.mockReturnValue({
      approve,
      error: undefined,
      isPending: false,
      isResolving: false,
      refetch,
      reject,
      task: {
        assignees: [{ id: reviewer.id, type: 'user' }],
        id: 'task-1',
      },
    });
  });

  it('lets only the assigned reviewer decide and requires a rejection note', async () => {
    const { rerender } = render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={metric}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-approval-tab')).toHaveClass(
      'tw:px-4',
      'tw:py-6',
      'tw:md:px-8'
    );
    expect(screen.getByTestId('metric-approval-approve-btn')).toBeVisible();
    expect(screen.getByTestId('metric-approval-status')).toHaveTextContent(
      'message.metric-approval-automatic-workflow'
    );
    expect(screen.getByTestId('metric-approval-status-header')).toHaveClass(
      'tw:flex-col',
      'tw:sm:flex-row'
    );
    expect(screen.getByTestId('metric-approval-reviewers')).toHaveTextContent(
      'label.user'
    );
    expect(screen.getByTestId('metric-approval-reject-btn')).toBeDisabled();
    expect(screen.queryByText('label.submit')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'label.note' }), {
      target: { value: 'Definition is incomplete' },
    });
    fireEvent.click(screen.getByTestId('metric-approval-reject-btn'));

    await waitFor(() =>
      expect(reject).toHaveBeenCalledWith('task-1', 'Definition is incomplete')
    );

    rerender(
      <MetricApprovalTab
        currentUser={{ id: 'other-user', name: 'other' } as User}
        metric={metric}
        onStatusChange={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('metric-approval-approve-btn')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-approval-waiting')).toBeVisible();
  });

  it('shows a waiting state without decision actions to an unassigned user', () => {
    render(
      <MetricApprovalTab
        currentUser={{ id: 'other-user', name: 'other' } as User}
        metric={metric}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-approval-waiting')).toBeVisible();
    expect(
      screen.queryByTestId('metric-approval-approve-btn')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('metric-approval-reject-btn')
    ).not.toBeInTheDocument();
  });

  it('disables every decision control while a resolution is in progress', () => {
    mockUseEntityApprovalTask.mockReturnValue({
      approve,
      error: undefined,
      isPending: false,
      isResolving: true,
      refetch,
      reject,
      task: {
        assignees: [{ id: reviewer.id, type: 'user' }],
        id: 'task-1',
      },
    });

    render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={metric}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByRole('textbox', { name: 'label.note' })).toBeDisabled();
    expect(screen.getByTestId('metric-approval-approve-btn')).toBeDisabled();
    expect(screen.getByTestId('metric-approval-reject-btn')).toBeDisabled();
    expect(screen.getByText('label.loading')).toBeInTheDocument();
  });

  it('approves without requiring a note and refreshes the visible status', async () => {
    const onStatusChange = jest.fn();

    render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={metric}
        onStatusChange={onStatusChange}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByTestId('metric-approval-approve-btn'));

    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith('task-1', undefined)
    );

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('metric-approval-action-success')).toBeVisible();
  });

  it('keeps the reviewer on the decision surface when approval fails', async () => {
    approve.mockRejectedValueOnce(new Error('approval failed'));

    render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={metric}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByTestId('metric-approval-approve-btn'));

    expect(
      await screen.findByTestId('metric-approval-action-error')
    ).toBeVisible();
    expect(screen.getByTestId('metric-approval-approve-btn')).toBeVisible();
  });

  it('distinguishes a rejected new metric from an approved rollback', () => {
    const first = render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={{ ...metric, entityStatus: EntityStatus.Rejected }}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-approval-rejected')).toBeVisible();
    expect(
      screen.queryByTestId('metric-approval-rollback')
    ).not.toBeInTheDocument();

    mockUseMetricApprovalHistory.mockReturnValue({
      data: [
        {
          id: 'rejected-update',
          isAutomatic: false,
          label: 'Reject update',
          outcome: 'rejected',
          status: 'Finished',
          timestamp: 2,
        },
      ],
      error: undefined,
      isPending: false,
      refetch,
    });
    first.unmount();
    render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={{ ...metric, entityStatus: EntityStatus.Approved }}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-approval-rollback')).toBeVisible();
    expect(
      screen.queryByTestId('metric-approval-approved')
    ).not.toBeInTheDocument();
  });

  it('recognizes an explicit rollback workflow outcome', () => {
    mockUseMetricApprovalHistory.mockReturnValue({
      data: [
        {
          id: 'rollback',
          isAutomatic: true,
          label: 'Rollback',
          outcome: 'rollback',
          status: 'Finished',
          timestamp: 2,
        },
      ],
      error: undefined,
      isPending: false,
      refetch,
    });

    render(
      <MetricApprovalTab
        currentUser={reviewer}
        metric={{ ...metric, entityStatus: EntityStatus.Approved }}
        onStatusChange={jest.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-approval-rollback')).toBeVisible();
  });
});

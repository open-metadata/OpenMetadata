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
import { fireEvent, render, screen } from '@testing-library/react';
import MetricApprovalHistory from './MetricApprovalHistory';
import { useMetricApprovalHistory } from './useMetricApprovalHistory';

jest.mock('./useMetricApprovalHistory');

const refetch = jest.fn();

describe('MetricApprovalHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders loading and empty workflow history', () => {
    (useMetricApprovalHistory as jest.Mock).mockReturnValue({
      data: undefined,
      error: undefined,
      isPending: true,
      refetch,
    });
    const { rerender } = render(<MetricApprovalHistory metricFqn="revenue" />);

    expect(screen.getByTestId('metric-approval-history')).toBeVisible();

    (useMetricApprovalHistory as jest.Mock).mockReturnValue({
      data: [],
      error: undefined,
      isPending: false,
      refetch,
    });
    rerender(<MetricApprovalHistory metricFqn="revenue" />);

    expect(screen.getByTestId('empty-placeholder')).toHaveTextContent(
      'label.workflow-history'
    );
    expect(screen.getByTestId('empty-placeholder').parentElement).toHaveClass(
      'tw:relative',
      'tw:min-h-64'
    );
  });

  it('retries errors and distinguishes automatic history from decisions', () => {
    (useMetricApprovalHistory as jest.Mock).mockReturnValue({
      data: undefined,
      error: new Error('network'),
      isPending: false,
      refetch,
    });
    const { rerender } = render(<MetricApprovalHistory metricFqn="revenue" />);
    fireEvent.click(screen.getByText('label.try-again'));

    expect(refetch).toHaveBeenCalledTimes(1);

    (useMetricApprovalHistory as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'automatic',
          isAutomatic: true,
          label: 'Started review',
          status: 'Running',
          timestamp: 1,
        },
        {
          actor: 'Alice',
          id: 'decision',
          isAutomatic: false,
          label: 'Approved',
          note: 'Looks good',
          outcome: 'approved',
          status: 'Finished',
          timestamp: 2,
        },
      ],
      error: undefined,
      isPending: false,
      refetch,
    });
    rerender(<MetricApprovalHistory metricFqn="revenue" />);

    expect(
      screen.getByTestId('metric-approval-history-automatic')
    ).toHaveTextContent('label.automated');
    expect(
      screen.getByTestId('metric-approval-history-decision')
    ).toHaveTextContent('Alice');
    expect(
      screen.getByTestId('metric-approval-history-decision')
    ).toHaveTextContent('Looks good');
  });
});

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
import { MemoryRouter } from 'react-router-dom';
import { getWorkflowInstancesByFQN } from '../../../rest/workflowDefinitionsAPI';
import { WorkflowExecutionHistory } from './WorkflowExecutionHistory';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'workflow-fqn' }),
}));

jest.mock('../../../rest/workflowDefinitionsAPI', () => ({
  getWorkflowInstancesByFQN: jest.fn(),
}));

const mockInstances = Array.from({ length: 3 }, (_, i) => ({
  id: `instance-${i}`,
  status: 'FINISHED',
  startedAt: 1695795540167,
  endedAt: 1695795550167,
  variables: {},
}));

const renderHistory = async (workflowFqn?: string) => {
  (getWorkflowInstancesByFQN as jest.Mock).mockResolvedValue({
    data: mockInstances,
    paging: { total: mockInstances.length },
  });

  await act(async () => {
    render(<WorkflowExecutionHistory workflowFqn={workflowFqn} />, {
      wrapper: MemoryRouter,
    });
  });
};

describe('WorkflowExecutionHistory', () => {
  it('sticks the table header', async () => {
    // The body scrolls inside this component's own wrapper rather than through
    // `scroll.y`, so TableV2 has no way to infer it — the header only sticks
    // because the call site asks. Without it the column titles scroll away.
    await renderHistory();

    expect(document.querySelector('thead')?.className).toMatch(/sticky/);
  });

  it('lists the route workflow runs by default and the given one when set', async () => {
    await renderHistory();

    expect(getWorkflowInstancesByFQN).toHaveBeenLastCalledWith(
      'workflow-fqn',
      expect.anything()
    );

    await renderHistory('HostPageWorkflow');

    expect(getWorkflowInstancesByFQN).toHaveBeenLastCalledWith(
      'HostPageWorkflow',
      expect.anything()
    );
  });

  it('renders a row per workflow instance', async () => {
    await renderHistory();

    expect(screen.getAllByRole('row')).toHaveLength(mockInstances.length + 1);
  });

  it('shows a run-specific empty state when the workflow has no runs', async () => {
    (getWorkflowInstancesByFQN as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      render(<WorkflowExecutionHistory />, { wrapper: MemoryRouter });
    });

    expect(
      screen.getByTestId('workflow-execution-history-empty')
    ).toHaveTextContent('message.no-runs-recorded-yet');
    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
  });

  it('shows an access-denied state without a reload on a 403', async () => {
    (getWorkflowInstancesByFQN as jest.Mock).mockRejectedValue({
      response: { status: 403 },
    });

    await act(async () => {
      render(<WorkflowExecutionHistory />, { wrapper: MemoryRouter });
    });

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.reload' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('workflow-execution-history-empty')
    ).not.toBeInTheDocument();
  });

  it('shows a reloadable error on a 500, and the reload starts again from page 1', async () => {
    const pagedResponse = {
      data: mockInstances,
      paging: { total: 30, after: 'cursor-2' },
    };
    (getWorkflowInstancesByFQN as jest.Mock)
      .mockResolvedValueOnce(pagedResponse)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce(pagedResponse);

    await act(async () => {
      render(<WorkflowExecutionHistory />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    expect(screen.getByText('server.entity-fetch-error')).toBeInTheDocument();
    expect(
      screen.queryByTestId('workflow-execution-history-empty')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));
    });

    expect(getWorkflowInstancesByFQN).toHaveBeenLastCalledWith('workflow-fqn', {
      limit: expect.any(Number),
    });
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'label.page 1'
    );
  });
});

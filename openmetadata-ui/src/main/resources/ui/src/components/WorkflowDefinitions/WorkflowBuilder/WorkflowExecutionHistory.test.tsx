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
import { act, render, screen } from '@testing-library/react';
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

const renderHistory = async () => {
  (getWorkflowInstancesByFQN as jest.Mock).mockResolvedValue({
    data: mockInstances,
    paging: { total: mockInstances.length },
  });

  await act(async () => {
    render(<WorkflowExecutionHistory />, { wrapper: MemoryRouter });
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

  it('renders a row per workflow instance', async () => {
    await renderHistory();

    expect(screen.getAllByRole('row')).toHaveLength(mockInstances.length + 1);
  });
});

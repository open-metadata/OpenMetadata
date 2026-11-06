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
import { listTasks, resolveTask } from '../rest/tasksAPI';
import { useEntityApprovalTask } from './useEntityApprovalTask';

jest.mock('../rest/tasksAPI', () => ({
  listTasks: jest.fn(),
  resolveTask: jest.fn(),
  TaskResolutionType: { Approved: 'Approved', Rejected: 'Rejected' },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useEntityApprovalTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listTasks as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('queries the tasks API by fully qualified name, not by entity link', async () => {
    // The tasks API filters on the entity FQN. Passing an entity link (`<#E::metric::fqn>`)
    // matches no rows and returns an empty list, which is indistinguishable from "nothing to
    // approve" — so the reviewer silently loses the approve/reject controls.
    renderHook(() => useEntityApprovalTask({ entityFqn: 'net_sales' }), {
      wrapper,
    });

    await waitFor(() => expect(listTasks).toHaveBeenCalled());

    const params = (listTasks as jest.Mock).mock.calls[0][0];

    expect(params.aboutEntity).toBe('net_sales');
    expect(params.aboutEntity).not.toContain('<#E::');
  });

  it('asks only for open approval tasks', async () => {
    renderHook(() => useEntityApprovalTask({ entityFqn: 'net_sales' }), {
      wrapper,
    });

    await waitFor(() => expect(listTasks).toHaveBeenCalled());

    const params = (listTasks as jest.Mock).mock.calls[0][0];

    expect(params.type).toBe('RequestApproval');
    expect(params.status).toBe('Open');
  });

  it('does not query when there is no fully qualified name to query by', async () => {
    renderHook(() => useEntityApprovalTask({ entityFqn: '' }), { wrapper });

    await waitFor(() => expect(listTasks).not.toHaveBeenCalled());
  });

  it('does not query when disabled', async () => {
    renderHook(
      () => useEntityApprovalTask({ entityFqn: 'net_sales', enabled: false }),
      { wrapper }
    );

    await waitFor(() => expect(listTasks).not.toHaveBeenCalled());
  });

  it('resolves to null rather than undefined when there is no open task', async () => {
    // react-query treats an undefined result as a failed query, so the ordinary "nothing to
    // approve" case would otherwise surface as an error and retry.
    const { result } = renderHook(
      () => useEntityApprovalTask({ entityFqn: 'net_sales' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.task).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('exposes the first open task', async () => {
    (listTasks as jest.Mock).mockResolvedValue({
      data: [{ id: 'task-1', assignees: [{ id: 'u1', type: 'user' }] }],
    });

    const { result } = renderHook(
      () => useEntityApprovalTask({ entityFqn: 'net_sales' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.task?.id).toBe('task-1'));
  });

  it('uses the server transition ids and reviewer notes for approval decisions', async () => {
    (listTasks as jest.Mock).mockResolvedValue({
      data: [
        {
          availableTransitions: [
            { id: 'approve-transition', resolutionType: 'Approved' },
            { id: 'reject-transition', resolutionType: 'Rejected' },
          ],
          id: 'task-1',
        },
      ],
    });
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { result } = renderHook(
      () => useEntityApprovalTask({ entityFqn: 'net_sales' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.task?.id).toBe('task-1'));
    await act(async () => result.current.approve('task-1', 'Looks good'));
    await act(async () => result.current.reject('task-1', 'Missing owner'));

    expect(resolveTask).toHaveBeenNthCalledWith(1, 'task-1', {
      comment: 'Looks good',
      resolutionType: 'Approved',
      transitionId: 'approve-transition',
    });
    expect(resolveTask).toHaveBeenNthCalledWith(2, 'task-1', {
      comment: 'Missing owner',
      resolutionType: 'Rejected',
      transitionId: 'reject-transition',
    });
  });
});

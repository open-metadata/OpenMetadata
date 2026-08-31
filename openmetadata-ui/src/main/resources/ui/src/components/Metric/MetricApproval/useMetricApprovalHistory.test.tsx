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
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { listTasks } from '../../../rest/tasksAPI';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../../rest/workflowAPI';
import {
  getMetricApprovalOutcome,
  useMetricApprovalHistory,
} from './useMetricApprovalHistory';

jest.mock('../../../rest/tasksAPI', () => ({ listTasks: jest.fn() }));
jest.mock('../../../rest/workflowAPI', () => ({
  getWorkflowInstanceStateById: jest.fn(),
  getWorkflowInstancesForApplication: jest.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useMetricApprovalHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWorkflowInstancesForApplication as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 'workflow-1' }],
        paging: { after: 'instances-next' },
      })
      .mockResolvedValueOnce({ data: [], paging: {} });
    (getWorkflowInstanceStateById as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'state-1',
            stage: {
              displayName: 'Automatic review',
              name: 'Review',
              tasks: [],
            },
            status: 'Running',
            timestamp: 100,
          },
        ],
        paging: { after: 'states-next' },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'state-2',
            stage: {
              displayName: 'Approved',
              name: 'Approved',
              tasks: ['task'],
            },
            status: 'Finished',
            timestamp: 200,
          },
        ],
        paging: {},
      });
    (listTasks as jest.Mock)
      .mockResolvedValueOnce({ data: [], paging: { after: 'tasks-next' } })
      .mockResolvedValueOnce({ data: [], paging: {} });
  });

  it('loads all cursor pages and orders automatic and decision history newest first', async () => {
    const { result } = renderHook(() => useMetricApprovalHistory('revenue'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(getWorkflowInstancesForApplication).toHaveBeenCalledTimes(2);
    expect(getWorkflowInstanceStateById).toHaveBeenCalledTimes(2);
    expect(listTasks).toHaveBeenCalledTimes(2);
    expect(result.current.data?.map(({ id }) => id)).toEqual([
      'state-2',
      'state-1',
    ]);
    expect(result.current.data?.[0].isAutomatic).toBe(false);
    expect(getMetricApprovalOutcome(result.current.data)).toBe('approved');
  });
});

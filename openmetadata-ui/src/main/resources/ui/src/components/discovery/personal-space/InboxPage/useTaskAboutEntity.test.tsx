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
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { Task } from '../../../../generated/entity/tasks/task';

const mockGetTestCaseByFqn = jest.fn();

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseByFqn: (...args: unknown[]) => mockGetTestCaseByFqn(...args),
}));

jest.mock('../../../../rest/lineageAPI', () => ({
  getLineageByEntityCount: jest.fn(),
}));

jest.mock('../../../../utils/EntityByFqnUtils', () => ({
  getEntityByFqnUtil: jest.fn(),
}));

import { useTaskAboutEntity } from './useTaskAboutEntity';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useTaskAboutEntity', () => {
  // The incident tiles name the test type, which only the test definition
  // carries; the generic fetch handler asks for owners alone.
  it('asks for the test definition when the task is about a test case', async () => {
    mockGetTestCaseByFqn.mockResolvedValue({
      id: 'tc1',
      name: 'row_count',
      entityLink: '<#E::table::svc.db.sch.orders>',
      testDefinition: { id: 'd1', name: 'tableRowCountToEqual' },
    });
    const task = {
      id: 't1',
      about: {
        id: 'tc1',
        type: 'testCase',
        fullyQualifiedName: 'svc.db.sch.orders.row_count',
      },
    } as unknown as Task;

    const { result } = renderHook(() => useTaskAboutEntity(task), { wrapper });

    await waitFor(() => expect(result.current.about).toBeDefined());

    expect(mockGetTestCaseByFqn).toHaveBeenCalledWith(
      'svc.db.sch.orders.row_count',
      { fields: ['owners', 'testDefinition'] }
    );
    expect(result.current.about?.testCase?.testDefinition?.name).toBe(
      'tableRowCountToEqual'
    );
    expect(result.current.about?.testCaseTableFqn).toBe('svc.db.sch.orders');
  });
});

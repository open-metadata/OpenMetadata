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
const mockGetIncidents = jest.fn();
const mockGetTable = jest.fn();

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseByFqn: (...args: unknown[]) => mockGetTestCaseByFqn(...args),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: (...args: unknown[]) =>
    mockGetIncidents(...args),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: (...args: unknown[]) => mockGetTable(...args),
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

const INCIDENT_TASK = {
  id: 't1',
  about: {
    id: 'tc1',
    type: 'testCase',
    fullyQualifiedName: 'svc.db.sch.orders.row_count',
  },
} as unknown as Task;

beforeEach(() => {
  queryClient.clear();
  mockGetTestCaseByFqn.mockResolvedValue({
    id: 'tc1',
    name: 'row_count',
    entityLink: '<#E::table::svc.db.sch.orders>',
    testDefinition: { id: 'd1', name: 'tableRowCountToEqual' },
  });
  mockGetIncidents.mockResolvedValue({ data: [] });
  mockGetTable.mockResolvedValue({ tags: [] });
});

describe('useTaskAboutEntity', () => {
  // The incident tiles name the test type, which only the test definition
  // carries; the generic fetch handler asks for owners alone.
  it('asks for the test definition when the task is about a test case', async () => {
    const { result } = renderHook(() => useTaskAboutEntity(INCIDENT_TASK), {
      wrapper,
    });

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

  // The task carries no severity; the incident's latest status record does.
  it('reads the severity from the latest incident status', async () => {
    mockGetIncidents.mockResolvedValue({
      data: [
        { timestamp: 2, severity: 'Severity1' },
        { timestamp: 1, severity: 'Severity4' },
      ],
    });

    const { result } = renderHook(() => useTaskAboutEntity(INCIDENT_TASK), {
      wrapper,
    });

    await waitFor(() => expect(result.current.about).toBeDefined());

    expect(mockGetIncidents).toHaveBeenCalledWith('t1');
    expect(result.current.about?.incidentSeverity).toBe('Severity1');
    // Kept oldest first: it is the incident's timeline.
    expect(
      result.current.about?.incidentStatuses?.map((status) => status.timestamp)
    ).toEqual([1, 2]);
  });

  // A test case has no tier; the tested table's is the one that matters.
  it('takes the tier from the table the test runs against', async () => {
    mockGetTable.mockResolvedValue({ tags: [{ tagFQN: 'Tier.Tier1' }] });

    const { result } = renderHook(() => useTaskAboutEntity(INCIDENT_TASK), {
      wrapper,
    });

    await waitFor(() => expect(result.current.about).toBeDefined());

    expect(mockGetTable).toHaveBeenCalledWith('svc.db.sch.orders', {
      fields: 'tags',
    });
    expect(result.current.about?.tier?.tagFQN).toBe('Tier.Tier1');
  });

  it('still describes the test when the incident and table reads fail', async () => {
    mockGetIncidents.mockRejectedValue(new Error('down'));
    mockGetTable.mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useTaskAboutEntity(INCIDENT_TASK), {
      wrapper,
    });

    await waitFor(() => expect(result.current.about).toBeDefined());

    expect(result.current.about?.testCase?.name).toBe('row_count');
    expect(result.current.about?.incidentSeverity).toBeUndefined();
    expect(result.current.about?.tier).toBeUndefined();
  });
});

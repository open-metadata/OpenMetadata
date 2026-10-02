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

import { act, renderHook } from '@testing-library/react';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { TestCaseResolutionStatusTypes as CreateStatusTypes } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import {
  bulkCreateResolutionStatus,
  getListTestCaseIncidentStatus,
} from '../../../../rest/incidentManagerAPI';
import { BulkIncidentChange } from './IncidentGroups.types';
import { useIncidentGroupBulkUpdate } from './useIncidentGroupBulkUpdate';

const mockList = getListTestCaseIncidentStatus as jest.Mock;
const mockBulk = bulkCreateResolutionStatus as jest.Mock;

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  ...jest.requireActual('../../../../rest/incidentManagerAPI'),
  getListTestCaseIncidentStatus: jest.fn(),
  bulkCreateResolutionStatus: jest.fn(),
}));

const group = (name: string): TestCaseIncidentGroup => ({
  groupBy: IncidentGroupBy.TestDefinition,
  id: name,
  name,
  fullyQualifiedName: name,
  incidentCount: 1,
});

const incident = (id: number, status = TestCaseResolutionStatusTypes.New) => ({
  id: `incident-${id}`,
  stateId: `state-${id}`,
  testCaseResolutionStatusType: status,
  testCaseReference: {
    id: `case-${id}`,
    type: 'testCase',
    fullyQualifiedName: `svc.db.shop.orders.case_${id}`,
  },
});

const ACK: BulkIncidentChange = {
  kind: 'status',
  status: CreateStatusTypes.ACK,
};

const renderBulkUpdate = () =>
  renderHook(() =>
    useIncidentGroupBulkUpdate({
      filters: { status: [], severity: [], dateField: 'timestamp' },
    })
  );

describe('useIncidentGroupBulkUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBulk.mockImplementation(async (entries: unknown[]) => ({
      numberOfRowsPassed: entries.length,
      failedRequest: [],
    }));
  });

  it("should read every page of every selected group's incidents", async () => {
    mockList.mockImplementation(async ({ testDefinition, offset }) => {
      if (testDefinition === 'rowCount') {
        return offset
          ? { data: [incident(2)], paging: { total: 2 } }
          : { data: [incident(1)], paging: { total: 2, after: 'cursor-2' } };
      }

      return { data: [incident(3)], paging: { total: 1 } };
    });
    const { result } = renderBulkUpdate();

    let outcome;
    await act(async () => {
      outcome = await result.current.applyBulkChange(
        [group('rowCount'), group('uniqueness')],
        ACK
      );
    });

    expect(mockList).toHaveBeenCalledTimes(3);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        testDefinition: 'rowCount',
        offset: 'cursor-2',
      })
    );
    expect(mockBulk).toHaveBeenCalledTimes(1);
    expect(mockBulk.mock.calls[0][0]).toHaveLength(3);
    expect(outcome).toEqual({
      total: 3,
      passed: 3,
      failures: [],
      unchanged: 0,
    });
  });

  it('should send an incident two groups share only once', async () => {
    mockList.mockResolvedValue({ data: [incident(1)], paging: { total: 1 } });
    const { result } = renderBulkUpdate();

    await act(async () => {
      await result.current.applyBulkChange([group('aaron'), group('bea')], ACK);
    });

    expect(mockBulk.mock.calls[0][0]).toHaveLength(1);
  });

  it('should send the changes in calls of at most 100 and add the outcomes up', async () => {
    mockList.mockResolvedValue({
      data: Array.from({ length: 230 }, (_, index) => incident(index)),
      paging: { total: 230 },
    });
    mockBulk.mockImplementation(async (entries: unknown[]) => ({
      numberOfRowsPassed: entries.length - 1,
      failedRequest: [{ request: entries[0], message: 'Permission denied' }],
    }));
    const { result } = renderBulkUpdate();

    let outcome: Awaited<ReturnType<typeof result.current.applyBulkChange>> = {
      total: 0,
      passed: 0,
      failures: [],
      unchanged: 0,
    };
    await act(async () => {
      outcome = await result.current.applyBulkChange([group('rowCount')], ACK);
    });

    expect(mockBulk.mock.calls.map(([entries]) => entries.length)).toEqual([
      100, 100, 30,
    ]);
    expect(outcome.passed).toBe(227);
    expect(outcome.failures).toHaveLength(3);
  });

  it('should leave out incidents the change would not alter', async () => {
    mockList.mockResolvedValue({
      data: [incident(1), incident(2, TestCaseResolutionStatusTypes.ACK)],
      paging: { total: 2 },
    });
    const { result } = renderBulkUpdate();

    let outcome;
    await act(async () => {
      outcome = await result.current.applyBulkChange([group('rowCount')], ACK);
    });

    expect(outcome).toEqual({
      total: 1,
      passed: 1,
      failures: [],
      unchanged: 1,
    });
  });

  it('should send nothing when no incident would change', async () => {
    mockList.mockResolvedValue({
      data: [incident(1, TestCaseResolutionStatusTypes.ACK)],
      paging: { total: 1 },
    });
    const { result } = renderBulkUpdate();

    await act(async () => {
      await result.current.applyBulkChange([group('rowCount')], ACK);
    });

    expect(mockBulk).not.toHaveBeenCalled();
  });

  it('should report applying until the change settles, even when it fails', async () => {
    mockList.mockRejectedValue(new Error('failure'));
    const { result } = renderBulkUpdate();

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.applyBulkChange([group('rowCount')], ACK);
    });

    expect(result.current.isApplying).toBe(true);

    await act(async () => {
      await expect(pending).rejects.toThrow('failure');
    });

    expect(result.current.isApplying).toBe(false);
  });

  it('should stop paging when the response carries no paging', async () => {
    mockList.mockResolvedValue({ data: [incident(1)] });
    const { result } = renderBulkUpdate();

    await act(async () => {
      await result.current.applyBulkChange([group('rowCount')], ACK);
    });

    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('should read the incidents in the active domain', async () => {
    mockList.mockResolvedValue({ data: [incident(1)], paging: { total: 1 } });
    useDomainStore.setState({ activeDomain: 'Marketing' });

    try {
      const { result } = renderBulkUpdate();

      await act(async () => {
        await result.current.applyBulkChange([group('rowCount')], ACK);
      });

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'Marketing' })
      );
    } finally {
      useDomainStore.setState({ activeDomain: DEFAULT_DOMAIN_VALUE });
    }
  });
});

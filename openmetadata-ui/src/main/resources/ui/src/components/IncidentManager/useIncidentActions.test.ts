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
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { EntityReference } from '../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCaseResolutionStatus';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import {
  getListTestCaseIncidentByStateId,
  transitionIncident,
  updateTestCaseIncidentById,
} from '../../rest/incidentManagerAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { useIncidentActions } from './useIncidentActions';

jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: jest.fn(),
  transitionIncident: jest.fn(),
  updateTestCaseIncidentById: jest.fn(),
}));

const mockUpdate = updateTestCaseIncidentById as jest.Mock;
const mockTransition = transitionIncident as jest.Mock;
const mockGetByStateId = getListTestCaseIncidentByStateId as jest.Mock;
const mockSetData = jest.fn();

type ListUpdater = (
  prev: TestCaseIncidentStatusData
) => TestCaseIncidentStatusData;

const lastUpdater = (): ListUpdater => {
  const calls = mockSetData.mock.calls;

  return calls[calls.length - 1][0] as ListUpdater;
};

const renderActions = () =>
  renderHook(() => useIncidentActions({ setTestCaseListData: mockSetData }));

describe('useIncidentActions', () => {
  it('should expose the three row-mutation handlers', () => {
    const { result } = renderActions();

    expect(typeof result.current.handleSeveritySubmit).toBe('function');
    expect(typeof result.current.handleAssigneeUpdate).toBe('function');
    expect(typeof result.current.handleStatusSubmit).toBe('function');
  });

  it('should patch the severity and optimistically replace the row', async () => {
    mockUpdate.mockResolvedValueOnce({});
    const record = {
      id: 'r1',
      severity: Severities.Severity1,
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleSeveritySubmit(record, Severities.Severity2);
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'r1',
      expect.arrayContaining([
        expect.objectContaining({
          op: 'replace',
          path: '/severity',
          value: Severities.Severity2,
        }),
      ])
    );

    const next = lastUpdater()({
      data: [record],
      isLoading: false,
    });

    expect(next.data[0].severity).toBe(Severities.Severity2);
  });

  it('should fall back to an empty id when the record has none', async () => {
    mockUpdate.mockResolvedValueOnce({});
    const record = {
      severity: Severities.Severity1,
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleSeveritySubmit(record, Severities.Severity2);
    });

    expect(mockUpdate).toHaveBeenCalledWith('', expect.any(Array));
  });

  it('should toast and skip the list update when the severity patch fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('boom'));
    const record = {
      id: 'r1',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleSeveritySubmit(record, Severities.Severity2);
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(mockSetData).not.toHaveBeenCalled();
  });

  it('should reassign an already-assigned incident and refresh the row', async () => {
    mockTransition.mockResolvedValueOnce({});
    const latest = {
      id: 'x',
      stateId: 'task-1',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
    } as TestCaseResolutionStatus;
    mockGetByStateId.mockResolvedValueOnce({ data: [latest] });
    const record = {
      stateId: 'task-1',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
    } as TestCaseResolutionStatus;
    const assignee = [
      {
        id: 'a1',
        type: 'user',
        name: 'ua',
        displayName: 'UA',
        fullyQualifiedName: 'ua',
      },
    ] as EntityReference[];
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAssigneeUpdate(record, assignee);
    });

    expect(mockTransition).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        transitionId: 'reassign',
        payload: expect.objectContaining({
          assignees: [
            expect.objectContaining({
              id: 'a1',
              type: 'user',
              name: 'ua',
              fullyQualifiedName: 'ua',
              displayName: 'UA',
            }),
          ],
        }),
      })
    );
    expect(mockGetByStateId).toHaveBeenCalledWith('task-1');

    const next = lastUpdater()({
      data: [
        {
          id: 'old',
          stateId: 'task-1',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
        } as TestCaseResolutionStatus,
      ],
      isLoading: false,
    });

    expect(next.data[0].id).toBe('x');
  });

  it('should use the assign transition when the incident is not yet assigned', async () => {
    mockTransition.mockResolvedValueOnce({});
    mockGetByStateId.mockResolvedValueOnce({
      data: [
        {
          stateId: 'task-2',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
        } as TestCaseResolutionStatus,
      ],
    });
    const record = {
      stateId: 'task-2',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const assignee = [{ id: 'a1', type: 'user', name: 'ua' }] as EntityReference[];
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAssigneeUpdate(record, assignee);
    });

    expect(mockTransition).toHaveBeenCalledWith(
      'task-2',
      expect.objectContaining({ transitionId: 'assign' })
    );
  });

  it('should do nothing when the incident has no stateId', async () => {
    const record = {
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAssigneeUpdate(record, []);
    });

    expect(mockTransition).not.toHaveBeenCalled();
    expect(mockGetByStateId).not.toHaveBeenCalled();
  });

  it('should send an undefined payload when no assignee is provided', async () => {
    mockTransition.mockResolvedValueOnce({});
    mockGetByStateId.mockResolvedValueOnce({
      data: [
        {
          stateId: 'task-3',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
        } as TestCaseResolutionStatus,
      ],
    });
    const record = {
      stateId: 'task-3',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAssigneeUpdate(record, undefined);
    });

    expect(mockTransition.mock.calls[0][1].payload).toBeUndefined();
  });

  it('should skip the list update when the refreshed incident is missing', async () => {
    mockTransition.mockResolvedValueOnce({});
    mockGetByStateId.mockResolvedValueOnce({ data: [] });
    const record = {
      stateId: 'task-4',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAssigneeUpdate(record, []);
    });

    expect(mockSetData).not.toHaveBeenCalled();
  });

  it('should toast when the assignee transition fails', async () => {
    mockTransition.mockRejectedValueOnce(new Error('boom'));
    const record = {
      stateId: 'task-5',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    await act(async () => {
      await result.current.handleAssigneeUpdate(record, []);
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(mockSetData).not.toHaveBeenCalled();
  });

  it('should optimistically replace the matching row on handleStatusSubmit', () => {
    const value = {
      testCaseReference: {
        id: 't1',
        type: 'testCase',
        fullyQualifiedName: 'svc.db.tc',
      },
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
    } as TestCaseResolutionStatus;
    const { result } = renderActions();

    act(() => {
      result.current.handleStatusSubmit(value);
    });

    expect(mockTransition).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockGetByStateId).not.toHaveBeenCalled();

    const next = lastUpdater()({
      data: [
        {
          id: 'old',
          testCaseReference: {
            id: 't0',
            type: 'testCase',
            fullyQualifiedName: 'svc.db.tc',
          },
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
        } as TestCaseResolutionStatus,
      ],
      isLoading: false,
    });

    expect(next.data[0].testCaseResolutionStatusType).toBe(
      TestCaseResolutionStatusTypes.Resolved
    );
  });
});

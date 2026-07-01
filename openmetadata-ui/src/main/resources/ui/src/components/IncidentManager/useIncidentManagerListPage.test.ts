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
import { act, renderHook, waitFor } from '@testing-library/react';
import QueryString from 'qs';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentStatusFromSearch } from '../../rest/incidentManagerAPI';
import { useIncidentManagerListPage } from './useIncidentManagerListPage';

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      testCase: {
        ViewAll: true,
        ViewBasic: true,
      },
    },
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    paging: { after: '', before: '', total: 25 },
    showPagination: true,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatusFromSearch: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [], paging: {} })),
  getListTestCaseIncidentByStateId: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  updateTestCaseIncidentById: jest.fn(),
  transitionIncident: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: { hits: { hits: [] } } })
    ),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ hits: { hits: [] } })),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('EntityName'),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockLocation = { search: '' };

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => mockLocation);
});

describe('useIncidentManagerListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocation.search = '';
  });

  it('should expose 5 filter descriptors in the expected key/controlType order', () => {
    const { result } = renderHook(() => useIncidentManagerListPage({}));

    const { filterDescriptors } = result.current;

    expect(filterDescriptors).toHaveLength(5);
    expect(filterDescriptors.map((descriptor) => descriptor.key)).toEqual([
      'testCaseFQN',
      'assignee',
      'testCaseResolutionStatusType',
      'dateField',
      'dateRange',
    ]);
    expect(
      filterDescriptors.map((descriptor) => descriptor.controlType)
    ).toEqual(['select', 'user', 'select', 'select', 'date']);
  });

  it('should build status descriptor options from the resolution-status enum labels', () => {
    const { result } = renderHook(() => useIncidentManagerListPage({}));

    const statusDescriptor = result.current.filterDescriptors.find(
      (descriptor) => descriptor.key === 'testCaseResolutionStatusType'
    );

    expect(statusDescriptor?.options).toEqual([
      { value: TestCaseResolutionStatusTypes.ACK, label: 'label.ack' },
      {
        value: TestCaseResolutionStatusTypes.Assigned,
        label: 'label.assigned',
      },
      { value: TestCaseResolutionStatusTypes.New, label: 'label.new' },
      {
        value: TestCaseResolutionStatusTypes.Resolved,
        label: 'label.resolved',
      },
    ]);
  });

  it('should report hasActiveFilters false without URL filter params', () => {
    const { result } = renderHook(() => useIncidentManagerListPage({}));

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('should report hasActiveFilters true when testCaseFQN is present in URL', () => {
    mockLocation.search = QueryString.stringify({ testCaseFQN: 'svc.db.tc' });

    const { result } = renderHook(() => useIncidentManagerListPage({}));

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('should navigate to clear filter params when clearAllFilters is called', () => {
    mockLocation.search = QueryString.stringify({ testCaseFQN: 'svc.db.tc' });

    const { result } = renderHook(() => useIncidentManagerListPage({}));

    act(() => {
      result.current.clearAllFilters();
    });

    expect(mockNavigate).toHaveBeenCalled();

    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).not.toContain('testCaseFQN=svc.db.tc');
  });

  it('should navigate with the assignee when assignee descriptor onOwnerChange is called with an owner', () => {
    const { result } = renderHook(() => useIncidentManagerListPage({}));

    const assigneeDescriptor = result.current.filterDescriptors.find(
      (descriptor) => descriptor.key === 'assignee'
    );

    act(() => {
      assigneeDescriptor?.onOwnerChange?.([
        { id: 'user-1', type: 'user', name: 'user1' },
      ]);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('assignee=user1'),
      }),
      expect.anything()
    );
  });

  it('should navigate clearing the assignee when onOwnerChange is called with an empty list', () => {
    mockLocation.search = QueryString.stringify({ assignee: 'user1' });

    const { result } = renderHook(() => useIncidentManagerListPage({}));

    const assigneeDescriptor = result.current.filterDescriptors.find(
      (descriptor) => descriptor.key === 'assignee'
    );

    act(() => {
      assigneeDescriptor?.onOwnerChange?.([]);
    });

    expect(mockNavigate).toHaveBeenCalled();

    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).not.toContain('assignee=user1');
  });

  it('should derive the selected assignee owner from loaded incidents on a shared link', async () => {
    mockLocation.search = QueryString.stringify({ assignee: 'user1' });
    const owner = {
      id: 'id-1',
      name: 'user1',
      type: 'user',
      displayName: 'User One',
    };
    (
      getListTestCaseIncidentStatusFromSearch as jest.Mock
    ).mockResolvedValueOnce({
      data: [
        { id: 'inc-1', testCaseResolutionStatusDetails: { assignee: owner } },
      ],
      paging: {},
    });

    const { result } = renderHook(() => useIncidentManagerListPage({}));

    await waitFor(() => {
      const assigneeDescriptor = result.current.filterDescriptors.find(
        (descriptor) => descriptor.key === 'assignee'
      );

      expect(assigneeDescriptor?.selectedOwners).toEqual([owner]);
    });
  });

  it('should navigate when the status descriptor onChange is called', () => {
    const { result } = renderHook(() => useIncidentManagerListPage({}));

    const statusDescriptor = result.current.filterDescriptors.find(
      (descriptor) => descriptor.key === 'testCaseResolutionStatusType'
    );

    act(() => {
      statusDescriptor?.onChange(TestCaseResolutionStatusTypes.Resolved);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining(
          'testCaseResolutionStatusType=Resolved'
        ),
      }),
      expect.anything()
    );
  });

  it('should navigate when the date-range descriptor onChange is called', () => {
    const { result } = renderHook(() => useIncidentManagerListPage({}));

    const dateRangeDescriptor = result.current.filterDescriptors.find(
      (descriptor) => descriptor.key === 'dateRange'
    );

    act(() => {
      dateRangeDescriptor?.onChange({
        startTs: 1709556624254,
        endTs: 1710161424255,
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('startTs=1709556624254'),
      }),
      expect.anything()
    );
  });
});

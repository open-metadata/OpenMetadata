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
import { TestCaseResolutionStatus } from '../../generated/tests/testCaseResolutionStatus';
import { UseIncidentFiltersProps, useIncidentFilters } from './useIncidentFilters';

const mockNavigate = jest.fn();
const mockFetchTestCaseFilterOptions = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const renderFiltersHook = (overrides: Partial<UseIncidentFiltersProps> = {}) =>
  renderHook(() =>
    useIncidentFilters({
      filters: {},
      allParams: {},
      testCaseListData: { data: [], isLoading: false },
      testCaseFilterOptions: [],
      isTestCaseOptionsLoading: false,
      fetchTestCaseFilterOptions: mockFetchTestCaseFilterOptions,
      ...overrides,
    })
  );

const findDescriptor = (
  descriptors: ReturnType<typeof renderFiltersHook>['result']['current']['filterDescriptors'],
  key: string
) => descriptors.find((descriptor) => descriptor.key === key);

describe('useIncidentFilters', () => {
  it('should expose the default filter state and helpers', () => {
    const { result } = renderFiltersHook();

    expect(result.current.isDateFilterOpen).toBe(false);
    expect(typeof result.current.setIsDateFilterOpen).toBe('function');
    expect(result.current.dateFilterOptions).toEqual([
      { name: 'label.created-at', value: 'timestamp' },
      { name: 'label.updated-at', value: 'updatedAt' },
    ]);
    expect(result.current.selectedDateFilterKey).toBe('timestamp');
    expect(result.current.selectedDateFilterOption).toEqual({
      name: 'label.created-at',
      value: 'timestamp',
    });
    expect(result.current.dateRangeKey).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('should reflect the injected dateField in selectedDateFilterKey/Option', () => {
    const { result } = renderFiltersHook({ filters: { dateField: 'updatedAt' } });

    expect(result.current.selectedDateFilterKey).toBe('updatedAt');
    expect(result.current.selectedDateFilterOption).toEqual({
      name: 'label.updated-at',
      value: 'updatedAt',
    });
  });

  it('should build dateRangeKey only when a range key and numeric bounds are present', () => {
    const { result } = renderFiltersHook({
      allParams: { key: 'last7days', title: 'Last 7 days' },
      filters: { startTs: 111, endTs: 222 },
    });

    expect(result.current.dateRangeKey).toEqual({
      key: 'last7days',
      title: 'Last 7 days',
      startTs: 111,
      endTs: 222,
    });
  });

  it('should write merged filters to the URL via updateFilters', () => {
    const { result } = renderFiltersHook({ allParams: { existing: 'y' } });

    act(() => {
      result.current.updateFilters({ testCaseFQN: 'x' });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('testCaseFQN=x'),
      }),
      { replace: true }
    );
    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).toContain('existing=y');
  });

  it('should drop other params and keep date-range params when they are supplied', () => {
    const { result } = renderFiltersHook({ allParams: { existing: 'y' } });

    act(() => {
      result.current.updateFilters(
        { startTs: 1, endTs: 2 },
        { key: 'k', title: 't' }
      );
    });

    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).toContain('startTs=1');
    expect(firstCallArg.search).toContain('key=k');
    expect(firstCallArg.search).not.toContain('existing=y');
  });

  it('should navigate on a changed date range via handleDateRangeChange', () => {
    const { result } = renderFiltersHook();

    act(() => {
      result.current.handleDateRangeChange({
        startTs: 5,
        endTs: 6,
        key: 'k',
        title: 't',
      });
    });

    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).toContain('startTs=5');
    expect(firstCallArg.search).toContain('key=k');
  });

  it('should not navigate when the date range is unchanged', () => {
    const { result } = renderFiltersHook({ filters: { startTs: 5, endTs: 6 } });

    act(() => {
      result.current.handleDateRangeChange({
        startTs: 5,
        endTs: 6,
        key: 'k',
        title: 't',
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate with the new date field via handleDateFieldChange', () => {
    const { result } = renderFiltersHook();

    act(() => {
      result.current.handleDateFieldChange('updatedAt');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('dateField=updatedAt'),
      }),
      { replace: true }
    );
  });

  it('should strip the date params from the URL via handleDateRangeClear', () => {
    const { result } = renderFiltersHook({
      allParams: {
        startTs: '1',
        endTs: '2',
        key: 'k',
        title: 't',
        dateField: 'updatedAt',
        other: 'z',
      },
    });

    act(() => {
      result.current.handleDateRangeClear();
    });

    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).toContain('other=z');
    expect(firstCallArg.search).not.toContain('startTs');
    expect(firstCallArg.search).not.toContain('dateField');
  });

  it('should navigate with the assignee name via handleAssigneeChange', () => {
    const { result } = renderFiltersHook();

    act(() => {
      result.current.handleAssigneeChange([
        { label: 'UA', value: 'ua', name: 'ua', type: 'user' },
      ]);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('assignee=ua'),
      }),
      { replace: true }
    );
  });

  it('should report hasActiveFilters true for each individual active filter', () => {
    expect(
      renderFiltersHook({ filters: { testCaseFQN: 'x' } }).result.current
        .hasActiveFilters
    ).toBe(true);
    expect(
      renderFiltersHook({ filters: { assignee: 'ua' } }).result.current
        .hasActiveFilters
    ).toBe(true);
    expect(
      renderFiltersHook({ filters: { startTs: 1 } }).result.current
        .hasActiveFilters
    ).toBe(true);
  });

  it('should clear every filter param through clearAllFilters', () => {
    const { result } = renderFiltersHook({
      allParams: { testCaseFQN: 'x' },
      filters: { testCaseFQN: 'x' },
    });

    act(() => {
      result.current.clearAllFilters();
    });

    expect(mockNavigate).toHaveBeenCalled();
    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).not.toContain('testCaseFQN');
  });

  it('should build 5 descriptors in the expected key/controlType order', () => {
    const { result } = renderFiltersHook();

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

  it('should wire the test-case descriptor to the injected option cluster', () => {
    const { result } = renderFiltersHook({
      testCaseFilterOptions: [{ label: 'L', value: 'V' }],
      isTestCaseOptionsLoading: true,
    });

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'testCaseFQN'
    );

    expect(descriptor?.options).toEqual([{ label: 'L', value: 'V' }]);
    expect(descriptor?.isLoading).toBe(true);

    act(() => {
      descriptor?.onGetInitialOptions();
    });

    expect(mockFetchTestCaseFilterOptions).toHaveBeenLastCalledWith();

    act(() => {
      descriptor?.onSearch?.('needle');
    });

    expect(mockFetchTestCaseFilterOptions).toHaveBeenLastCalledWith('needle');

    act(() => {
      descriptor?.onChange('svc.db.tc');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('testCaseFQN=svc.db.tc'),
      }),
      { replace: true }
    );
  });

  it('should build status descriptor options from the resolution-status enum labels', () => {
    const { result } = renderFiltersHook();

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'testCaseResolutionStatusType'
    );

    expect(descriptor?.options).toEqual([
      { value: 'Ack', label: 'label.ack' },
      { value: 'Assigned', label: 'label.assigned' },
      { value: 'New', label: 'label.new' },
      { value: 'Resolved', label: 'label.resolved' },
    ]);

    act(() => {
      descriptor?.onChange('Resolved');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('testCaseResolutionStatusType=Resolved'),
      }),
      { replace: true }
    );
  });

  it('should map the date-field descriptor options and navigate on change', () => {
    const { result } = renderFiltersHook();

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'dateField'
    );

    expect(descriptor?.value).toBe('timestamp');
    expect(descriptor?.options).toEqual([
      { label: 'label.created-at', value: 'timestamp' },
      { label: 'label.updated-at', value: 'updatedAt' },
    ]);

    act(() => {
      descriptor?.onChange('updatedAt');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('dateField=updatedAt'),
      }),
      { replace: true }
    );
  });

  it('should carry numeric bounds on the date-range descriptor and navigate on change', () => {
    const { result } = renderFiltersHook({ filters: { startTs: 9, endTs: 10 } });

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'dateRange'
    );

    expect(descriptor?.value).toEqual({ startTs: 9, endTs: 10 });

    act(() => {
      descriptor?.onChange({ startTs: 7, endTs: 8 });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('startTs=7'),
      }),
      { replace: true }
    );
  });

  it('should derive the assignee descriptor selectedOwners from the loaded rows', () => {
    const assignee = { id: 'id1', name: 'ua', type: 'user', displayName: 'UA' };
    const { result } = renderFiltersHook({
      filters: { assignee: 'ua' },
      testCaseListData: {
        data: [
          { testCaseResolutionStatusDetails: { assignee } },
        ] as unknown as TestCaseResolutionStatus[],
        isLoading: false,
      },
    });

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'assignee'
    );

    expect(descriptor?.selectedOwners).toEqual([assignee]);
  });

  it('should prefer the picker ref when it matches the active assignee filter', () => {
    const { result } = renderFiltersHook({ filters: { assignee: 'other' } });

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'assignee'
    );

    act(() => {
      descriptor?.onOwnerChange?.([
        { id: 'o1', name: 'other', type: 'user' },
      ]);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('assignee=other'),
      }),
      { replace: true }
    );

    const updated = findDescriptor(
      result.current.filterDescriptors,
      'assignee'
    );

    expect(updated?.selectedOwners).toEqual([
      { id: 'o1', name: 'other', type: 'user' },
    ]);
  });

  it('should drop a stale picker ref that no longer matches the assignee filter', () => {
    const { result } = renderFiltersHook({ filters: { assignee: 'ua' } });

    const descriptor = findDescriptor(
      result.current.filterDescriptors,
      'assignee'
    );

    act(() => {
      descriptor?.onOwnerChange?.([
        { id: 'o1', name: 'other', type: 'user' },
      ]);
    });

    const updated = findDescriptor(
      result.current.filterDescriptors,
      'assignee'
    );

    expect(updated?.selectedOwners).toEqual([]);
  });
});

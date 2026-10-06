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
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { FilterDescriptor } from '../../../DataQuality/TestCases/FilterChip.interface';
import { IncidentGroupsFilters } from './IncidentGroups.types';
import { useIncidentGroupsFilters } from './useIncidentGroupsFilters';

const mockFetchTestCaseFilterOptions = jest.fn();

// The option search goes out to the search index; only its results matter here.
jest.mock('../../../IncidentManager/useIncidentFilterOptions', () => ({
  useIncidentFilterOptions: jest.fn().mockImplementation(() => ({
    testCaseFilterOptions: [{ label: 'row count', value: 'svc.orders.rc' }],
    isTestCaseOptionsLoading: false,
    fetchTestCaseFilterOptions: mockFetchTestCaseFilterOptions,
  })),
}));

const onFiltersChange = jest.fn();

const renderFilters = (filters: IncidentGroupsFilters = {}) =>
  renderHook(
    ({ current }: { current: IncidentGroupsFilters }) =>
      useIncidentGroupsFilters({ filters: current, onFiltersChange }),
    { initialProps: { current: filters } }
  );

const getDescriptor = (descriptors: FilterDescriptor[], key: string) => {
  const descriptor = descriptors.find((filter) => filter.key === key);

  if (!descriptor) {
    throw new Error(`No filter descriptor for ${key}`);
  }

  return descriptor;
};

describe('useIncidentGroupsFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should lay the filters out in the order of the design', () => {
    const { result } = renderFilters();

    expect(result.current.map((descriptor) => descriptor.key)).toEqual([
      'testCaseFQN',
      'assignee',
      'status',
      'dateField',
      'dateRange',
    ]);
  });

  it('should offer only the open statuses, as a multi-select', () => {
    const { result } = renderFilters({
      status: [TestCaseResolutionStatusTypes.New],
    });
    const status = getDescriptor(result.current, 'status');

    expect(status.controlType).toBe('multiselect');
    expect(status.value).toEqual([TestCaseResolutionStatusTypes.New]);
    expect(status.options.map((option) => option.value)).toEqual([
      TestCaseResolutionStatusTypes.New,
      TestCaseResolutionStatusTypes.ACK,
      TestCaseResolutionStatusTypes.Assigned,
    ]);

    act(() => {
      status.onChange([
        TestCaseResolutionStatusTypes.ACK,
        TestCaseResolutionStatusTypes.Assigned,
      ]);
    });

    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [
        TestCaseResolutionStatusTypes.ACK,
        TestCaseResolutionStatusTypes.Assigned,
      ],
    });
  });

  it('should search test cases and clear the filter on an empty pick', () => {
    const { result } = renderFilters({ testCaseFQN: 'svc.orders.rc' });
    const testCase = getDescriptor(result.current, 'testCaseFQN');

    expect(testCase.searchable).toBe(true);
    expect(testCase.value).toBe('svc.orders.rc');
    expect(testCase.options).toEqual([
      { label: 'row count', value: 'svc.orders.rc' },
    ]);

    act(() => {
      testCase.onSearch?.('orders');
      testCase.onChange('');
    });

    expect(mockFetchTestCaseFilterOptions).toHaveBeenCalledWith('orders');
    expect(onFiltersChange).toHaveBeenCalledWith({ testCaseFQN: undefined });
  });

  it('should filter by the picked assignee name and show who was picked', () => {
    const adam = { id: 'u1', type: 'user', name: 'adam', displayName: 'Adam' };
    const { result, rerender } = renderFilters();

    act(() => {
      getDescriptor(result.current, 'assignee').onOwnerChange?.([adam]);
    });

    expect(onFiltersChange).toHaveBeenCalledWith({ assignee: 'adam' });

    rerender({ current: { assignee: 'adam' } });

    expect(getDescriptor(result.current, 'assignee').selectedOwners).toEqual([
      adam,
    ]);

    act(() => {
      getDescriptor(result.current, 'assignee').onOwnerChange?.([]);
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith({ assignee: undefined });
  });

  it('should fall back to the name alone for an assignee read from a link', () => {
    const { result } = renderFilters({ assignee: 'adam' });
    const assignee = getDescriptor(result.current, 'assignee');

    expect(assignee.value).toBe('adam');
    expect(assignee.selectedOwners).toEqual([]);
  });

  it('should show the default date field and leave it out of the URL', () => {
    const { result } = renderFilters();
    const dateField = getDescriptor(result.current, 'dateField');

    expect(dateField.value).toBe('createdAt');
    expect(dateField.options.map((option) => option.value)).toEqual([
      'createdAt',
      'updatedAt',
    ]);

    act(() => {
      dateField.onChange('updatedAt');
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      dateField: 'updatedAt',
    });

    act(() => {
      dateField.onChange('createdAt');
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith({ dateField: undefined });
  });

  it('should hand the date range back as startTs/endTs', () => {
    const { result } = renderFilters({ startTs: 1, endTs: 2 });
    const dateRange = getDescriptor(result.current, 'dateRange');

    expect(dateRange.value).toEqual({ startTs: 1, endTs: 2 });

    act(() => {
      dateRange.onChange({ startTs: 10, endTs: 20 });
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      startTs: 10,
      endTs: 20,
    });

    act(() => {
      dateRange.onChange(undefined);
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      startTs: undefined,
      endTs: undefined,
    });
  });
});

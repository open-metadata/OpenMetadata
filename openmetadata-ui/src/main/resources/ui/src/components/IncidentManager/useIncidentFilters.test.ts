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
import {
  useIncidentFilters,
  UseIncidentFiltersProps,
} from './useIncidentFilters';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const renderFiltersHook = (overrides: Partial<UseIncidentFiltersProps> = {}) =>
  renderHook(() =>
    useIncidentFilters({
      filters: {},
      allParams: {},
      ...overrides,
    })
  );

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
  });

  it('should reflect the injected dateField in selectedDateFilterKey/Option', () => {
    const { result } = renderFiltersHook({
      filters: { dateField: 'updatedAt' },
    });

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
});

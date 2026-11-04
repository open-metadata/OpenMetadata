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
import { isString, omit, parseInt } from 'lodash';
import QueryString, { ParsedQs } from 'qs';
import { act } from 'react';
import { TestCaseIncidentStatusParams } from '../../rest/incidentManagerAPI';
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

// Models the production wiring in `useIncidentManagerListPage`: `filters` is
// derived from `omit(allParams, ['key', 'title'])`, so it carries `currentPage`
// /`pageSize`/cursor params verbatim (with `startTs`/`endTs` coerced to numbers).
// Tests that inject `filters` and `allParams` independently mask the stale-page
// bug; this helper keeps them in sync to exercise the real relationship.
const deriveProductionFilters = (
  allParams: ParsedQs
): TestCaseIncidentStatusParams => {
  const base = omit(allParams, ['key', 'title']) as Record<string, unknown>;

  if (isString(base.startTs)) {
    base.startTs = parseInt(base.startTs, 10);
  }
  if (isString(base.endTs)) {
    base.endTs = parseInt(base.endTs, 10);
  }

  return base as unknown as TestCaseIncidentStatusParams;
};

const renderWithUrl = (allParams: ParsedQs) =>
  renderFiltersHook({
    filters: deriveProductionFilters(allParams),
    allParams,
  });

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

  it('should reset currentPage to the first page when a filter value changes while paginated', () => {
    const { result } = renderWithUrl({
      currentPage: '5',
      pageSize: '15',
      assignee: 'bob',
    });

    act(() => {
      result.current.updateFilters({ assignee: 'alice' });
    });

    const [arg] = mockNavigate.mock.calls[0];

    expect(QueryString.parse(arg.search)).toEqual({
      currentPage: '1',
      pageSize: '15',
      assignee: 'alice',
    });
  });

  it('should keep the current page when the filter value is unchanged', () => {
    const { result } = renderWithUrl({
      currentPage: '3',
      pageSize: '15',
      assignee: 'alice',
    });

    act(() => {
      result.current.updateFilters({ assignee: 'alice' });
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.currentPage).toBe('3');
    expect(parsed.assignee).toBe('alice');
  });

  it('should drop stale cursor params from the URL when a filter value changes', () => {
    const { result } = renderWithUrl({
      currentPage: '5',
      cursorType: 'after',
      cursorValue: 'foo',
      assignee: 'bob',
    });

    act(() => {
      result.current.updateFilters({ assignee: 'alice' });
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.currentPage).toBe('1');
    expect(parsed.cursorType).toBeUndefined();
    expect(parsed.cursorValue).toBeUndefined();
    expect(parsed.assignee).toBe('alice');
  });

  it('should reset currentPage when the assignee changes while paginated', () => {
    const { result } = renderWithUrl({ currentPage: '5', pageSize: '15' });

    act(() => {
      result.current.handleAssigneeChange([
        { label: 'UA', value: 'ua', name: 'ua', type: 'user' },
      ]);
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.currentPage).toBe('1');
    expect(parsed.assignee).toBe('ua');
  });

  it('should keep the current page when clearing an assignee that is not set', () => {
    const { result } = renderWithUrl({ currentPage: '3', pageSize: '15' });

    act(() => {
      result.current.handleAssigneeChange(undefined);
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.currentPage).toBe('3');
    expect(parsed.assignee).toBeUndefined();
  });

  it('should reset currentPage when the date field changes while paginated', () => {
    const { result } = renderWithUrl({
      currentPage: '5',
      pageSize: '15',
      dateField: 'timestamp',
    });

    act(() => {
      result.current.handleDateFieldChange('updatedAt');
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.currentPage).toBe('1');
    expect(parsed.dateField).toBe('updatedAt');
  });

  it('should reset currentPage on the date-range branch and keep other params while paginated', () => {
    const { result } = renderWithUrl({
      currentPage: '4',
      pageSize: '15',
      assignee: 'bob',
      startTs: '1',
      endTs: '2',
      key: 'k',
      title: 't',
    });

    act(() => {
      result.current.handleDateRangeChange({
        startTs: 5,
        endTs: 6,
        key: 'k2',
        title: 't2',
      });
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.currentPage).toBe('1');
    expect(parsed.startTs).toBe('5');
    expect(parsed.endTs).toBe('6');
    expect(parsed.key).toBe('k2');
    expect(parsed.title).toBe('t2');
    expect(parsed.assignee).toBe('bob');
    expect(parsed.pageSize).toBe('15');
  });

  it('should drop the page and cursor params via handleDateRangeClear', () => {
    const { result } = renderWithUrl({
      startTs: '1',
      endTs: '2',
      key: 'k',
      title: 't',
      dateField: 'updatedAt',
      currentPage: '5',
      cursorType: 'after',
      cursorValue: 'foo',
      other: 'z',
      pageSize: '15',
    });

    act(() => {
      result.current.handleDateRangeClear();
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.other).toBe('z');
    expect(parsed.pageSize).toBe('15');
    expect(parsed.currentPage).toBeUndefined();
    expect(parsed.cursorType).toBeUndefined();
    expect(parsed.cursorValue).toBeUndefined();
    expect(parsed.startTs).toBeUndefined();
    expect(parsed.dateField).toBeUndefined();
  });
});

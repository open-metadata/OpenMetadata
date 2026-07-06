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
  TEST_CASE_FILTERS,
  TEST_CASE_FILTERS_LABELS,
} from '../../../constants/profiler.constant';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { FetchedOption } from './useTestCaseFilterOptions';
import {
  useTestCaseFilters,
  UseTestCaseFiltersProps,
} from './useTestCaseFilters';

const mockNavigate = jest.fn();

const mockLocation = { search: '' };

const mockGetInitialOptions = jest.fn();

const mockOnSearchByKey: Record<string, (search: string) => void> = {
  [TEST_CASE_FILTERS.table]: jest.fn(),
  [TEST_CASE_FILTERS.tags]: jest.fn(),
  [TEST_CASE_FILTERS.service]: jest.fn(),
  [TEST_CASE_FILTERS.dataProduct]: jest.fn(),
};

const buildAsyncOptions = (): Record<string, FetchedOption[]> => ({
  [TEST_CASE_FILTERS.table]: [],
  [TEST_CASE_FILTERS.tags]: [],
  [TEST_CASE_FILTERS.tier]: [],
  [TEST_CASE_FILTERS.service]: [],
  [TEST_CASE_FILTERS.dataProduct]: [],
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn(() => mockLocation)
);

const renderFilters = (overrides: Partial<UseTestCaseFiltersProps> = {}) =>
  renderHook(() =>
    useTestCaseFilters({
      getInitialOptions: mockGetInitialOptions,
      isOptionsLoading: false,
      asyncOptionsByKey: buildAsyncOptions(),
      onSearchByKey: mockOnSearchByKey,
      ...overrides,
    })
  );

const DEFAULT_SELECTED_FILTERS = [
  TEST_CASE_FILTERS.status,
  TEST_CASE_FILTERS.type,
  TEST_CASE_FILTERS.table,
  TEST_CASE_FILTERS.tags,
];

describe('useTestCaseFilters', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGetInitialOptions.mockClear();
    mockLocation.search = '';
  });

  it('should return the filters concern shape with the default selected filters', () => {
    const { result } = renderFilters();

    expect(typeof result.current.params).toBe('object');
    expect(typeof result.current.searchValue).toBe('string');
    expect(result.current.selectedFilter).toEqual(DEFAULT_SELECTED_FILTERS);
    expect(typeof result.current.setSelectedFilter).toBe('function');
    expect(typeof result.current.form).toBe('object');
    expect(typeof result.current.handleMenuClick).toBe('function');
    expect(typeof result.current.handleSearchParam).toBe('function');
    expect(typeof result.current.handleFilterChange).toBe('function');
    expect(Array.isArray(result.current.filterMenu)).toBe(true);
    expect(Array.isArray(result.current.filters)).toBe(true);
    expect(typeof result.current.hasActiveFilters).toBe('boolean');
    expect(typeof result.current.clearAll).toBe('function');
  });

  it('should parse the params and searchValue from the location search, stripping a leading question mark', () => {
    mockLocation.search = '?tableFqn=svc.db.tbl&searchValue=orders';

    const { result } = renderFilters();

    expect(result.current.params.tableFqn).toBe('svc.db.tbl');
    expect(result.current.params.searchValue).toBe('orders');
    expect(result.current.searchValue).toBe('orders');
  });

  it('should default searchValue to an empty string when it is absent from the URL', () => {
    const { result } = renderFilters();

    expect(result.current.searchValue).toBe('');
  });

  it('should write the key/value to the URL through navigate on handleSearchParam', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.handleSearchParam('tableFqn', 'svc.db.tbl');
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.stringContaining('tableFqn=svc.db.tbl'),
    });
  });

  it('should route a single changed value through handleSearchParam on handleFilterChange', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.handleFilterChange?.(
        { testCaseStatus: TestCaseStatus.Failed },
        {}
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.stringContaining('testCaseStatus=Failed'),
    });
  });

  it('should add a new filter, prefetch its options and write the URL on handleMenuClick', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.handleMenuClick({ key: TEST_CASE_FILTERS.tier });
    });

    expect(result.current.selectedFilter).toContain(TEST_CASE_FILTERS.tier);
    expect(mockGetInitialOptions).toHaveBeenCalledWith(TEST_CASE_FILTERS.tier);
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should remove an active filter and reset its form field when its menu item is clicked again', () => {
    const { result } = renderFilters();

    const setFieldsSpy = jest
      .spyOn(result.current.form, 'setFieldsValue')
      .mockImplementation(() => undefined);

    act(() => {
      result.current.handleMenuClick({ key: TEST_CASE_FILTERS.status });
    });

    expect(result.current.selectedFilter).not.toContain(
      TEST_CASE_FILTERS.status
    );
    expect(setFieldsSpy).toHaveBeenCalledWith({
      [TEST_CASE_FILTERS.status]: undefined,
    });

    setFieldsSpy.mockRestore();
  });

  it('should build the filterMenu from every TEST_CASE_FILTERS entry', () => {
    const { result } = renderFilters();

    expect(result.current.filterMenu).toHaveLength(
      Object.keys(TEST_CASE_FILTERS).length
    );
    expect(
      result.current.filterMenu.map((item) => (item as { key: string }).key)
    ).toEqual(Object.values(TEST_CASE_FILTERS));
  });

  it('should build descriptors that track the selected filters in the canonical order with the injected loading flag', () => {
    const { result } = renderFilters({ isOptionsLoading: true });

    expect(result.current.filters.map((descriptor) => descriptor.key)).toEqual([
      TEST_CASE_FILTERS.table,
      TEST_CASE_FILTERS.type,
      TEST_CASE_FILTERS.status,
      TEST_CASE_FILTERS.tags,
    ]);

    result.current.filters.forEach((descriptor) => {
      expect(descriptor.paramKey).toBe(descriptor.key);
      expect(typeof descriptor.label).toBe('string');
      expect(descriptor.isLoading).toBe(true);
      expect(Array.isArray(descriptor.options)).toBe(true);
      expect(typeof descriptor.onGetInitialOptions).toBe('function');
      expect(typeof descriptor.onChange).toBe('function');
      expect(descriptor.searchable).toBe(
        typeof descriptor.onSearch === 'function'
      );
      expect(descriptor.value).toBeUndefined();
    });
  });

  it('should map descriptor label, controlType, searchability and options for each default filter', () => {
    const asyncOptionsByKey = buildAsyncOptions();
    asyncOptionsByKey[TEST_CASE_FILTERS.table] = [
      {
        value: 'svc.db.tbl',
        name: 'tbl',
        subLabel: 'svc.db.tbl',
        label: 'tbl',
      },
    ];

    const { result } = renderFilters({ asyncOptionsByKey });

    const byKey = (key: string) =>
      result.current.filters.find((descriptor) => descriptor.key === key);

    const tableDescriptor = byKey(TEST_CASE_FILTERS.table);
    const statusDescriptor = byKey(TEST_CASE_FILTERS.status);
    const typeDescriptor = byKey(TEST_CASE_FILTERS.type);
    const tagsDescriptor = byKey(TEST_CASE_FILTERS.tags);

    expect(tableDescriptor?.label).toBe(TEST_CASE_FILTERS_LABELS.table);
    expect(tagsDescriptor?.label).toBe(TEST_CASE_FILTERS_LABELS.tags);

    expect(tableDescriptor?.controlType).toBe('select');
    expect(statusDescriptor?.controlType).toBe('select');
    expect(typeDescriptor?.controlType).toBe('select');
    expect(tagsDescriptor?.controlType).toBe('multiselect');

    expect(tableDescriptor?.searchable).toBe(true);
    expect(tagsDescriptor?.searchable).toBe(true);
    expect(statusDescriptor?.searchable).toBe(false);
    expect(typeDescriptor?.searchable).toBe(false);

    expect(tableDescriptor?.onSearch).toBe(
      mockOnSearchByKey[TEST_CASE_FILTERS.table]
    );
    expect(statusDescriptor?.onSearch).toBeUndefined();

    expect(statusDescriptor?.options.length).toBeGreaterThan(0);
    expect(typeDescriptor?.options.length).toBeGreaterThan(0);
    expect(tagsDescriptor?.options).toEqual([]);
    expect(tableDescriptor?.options).toEqual([
      { value: 'svc.db.tbl', label: 'tbl', subLabel: 'svc.db.tbl' },
    ]);
  });

  it('should surface the date control for lastRun and the multiselect control for platform when selected', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.handleMenuClick({ key: TEST_CASE_FILTERS.lastRun });
    });
    act(() => {
      result.current.handleMenuClick({ key: TEST_CASE_FILTERS.platform });
    });

    const lastRunDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.lastRun
    );
    const platformDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.platform
    );

    expect(lastRunDescriptor?.controlType).toBe('date');
    expect(platformDescriptor?.controlType).toBe('multiselect');
  });

  it('should reflect the URL filter value on the matching descriptor', () => {
    mockLocation.search = 'tableFqn=svc.db.tbl';

    const { result } = renderFilters();

    const tableDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.table
    );

    expect(tableDescriptor?.value).toBe('svc.db.tbl');
  });

  it('should route a descriptor onChange through handleSearchParam to the URL', () => {
    const { result } = renderFilters();

    const tableDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.table
    );

    act(() => {
      tableDescriptor?.onChange('svc.db.tbl');
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.stringContaining('tableFqn=svc.db.tbl'),
    });
  });

  it('should drive the injected getInitialOptions from a descriptor onGetInitialOptions', () => {
    const { result } = renderFilters();

    const tableDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.table
    );

    act(() => {
      tableDescriptor?.onGetInitialOptions();
    });

    expect(mockGetInitialOptions).toHaveBeenCalledWith(TEST_CASE_FILTERS.table);
  });

  it('should report no active filters for an empty URL and for a URL carrying only a searchValue', () => {
    const { result, rerender } = renderFilters();

    expect(result.current.hasActiveFilters).toBe(false);

    mockLocation.search = 'searchValue=orders';
    rerender();

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('should report active filters when a filter param is present in the URL', () => {
    mockLocation.search = 'tableFqn=svc.db.tbl';

    const { result } = renderFilters();

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('should reset the selected filters and form and navigate preserving only the searchValue on clearAll', () => {
    mockLocation.search = 'searchValue=orders&tableFqn=svc.db.tbl';

    const { result } = renderFilters();

    const resetFieldsSpy = jest
      .spyOn(result.current.form, 'resetFields')
      .mockImplementation(() => undefined);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.selectedFilter).toEqual(DEFAULT_SELECTED_FILTERS);
    expect(resetFieldsSpy).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenLastCalledWith({
      search: 'searchValue=orders',
    });

    const lastSearch = mockNavigate.mock.calls.at(-1)?.[0]?.search;

    expect(lastSearch).not.toContain('tableFqn');

    resetFieldsSpy.mockRestore();
  });
});

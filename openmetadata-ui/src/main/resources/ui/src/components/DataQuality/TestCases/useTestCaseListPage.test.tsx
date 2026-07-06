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
import { renderHook, waitFor } from '@testing-library/react';
import QueryString from 'qs';
import { act } from 'react';
import {
  TEST_CASE_FILTERS,
  TEST_CASE_FILTERS_LABELS,
} from '../../../constants/profiler.constant';
import { TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { searchQuery } from '../../../rest/searchAPI';
import { getTags } from '../../../rest/tagAPI';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import tagClassBase from '../../../utils/TagClassBase';
import { TestCaseSearchParams } from '../DataQuality.interface';
import { useTestCaseListPage } from './useTestCaseListPage';

const mockNavigate = jest.fn();

const mockLocation = { search: '' };

const mockHandlePageChange = jest.fn();
const mockHandlePagingChange = jest.fn();
const mockHandlePageSizeChange = jest.fn();

const mockPermissions: {
  testCase: Record<string, boolean>;
  testSuite: Record<string, boolean>;
  all: Record<string, boolean>;
} = {
  testCase: { ViewAll: true, ViewBasic: true },
  testSuite: {},
  all: {},
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(() => mockNavigate),
  useParams: jest.fn(() => ({ tab: 'test-cases' })),
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn(() => mockLocation)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({
    permissions: mockPermissions,
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../../pages/DataQuality/DataQualityProvider', () => ({
  useDataQualityProvider: jest.fn(() => ({
    isTestCaseSummaryLoading: false,
    testCaseSummary: {},
  })),
}));

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn(() => ({ showModal: jest.fn() })),
  })
);

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    currentPage: 1,
    pageSize: 10,
    paging: { after: '', before: '', total: 0 },
    showPagination: true,
    handlePageChange: mockHandlePageChange,
    handlePagingChange: mockHandlePagingChange,
    handlePageSizeChange: mockHandlePageSizeChange,
  })),
}));

jest.mock('../../../rest/testAPI', () => ({
  ...jest.requireActual('../../../rest/testAPI'),
  getListTestCaseBySearch: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  ...jest.requireActual('../../../rest/searchAPI'),
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));

jest.mock('../../../rest/tagAPI', () => ({
  ...jest.requireActual('../../../rest/tagAPI'),
  getTags: jest.fn().mockResolvedValue({ data: [] }),
}));

const buildTestCase = (
  id: string,
  fullyQualifiedName: string,
  extra: Partial<TestCase> = {}
): TestCase =>
  ({
    id,
    name: id,
    fullyQualifiedName,
    ...extra,
  } as unknown as TestCase);

describe('useTestCaseListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocation.search = '';
    mockPermissions.testCase = { ViewAll: true, ViewBasic: true };
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  it('should return the expected shape and value kinds from the hook', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const current = result.current;

    expect(typeof current.handleMenuClick).toBe('function');
    expect(typeof current.handleSearchParam).toBe('function');
    expect(typeof current.handleFilterChange).toBe('function');
    expect(typeof current.fetchTestCases).toBe('function');
    expect(typeof current.sortTestCase).toBe('function');
    expect(typeof current.handleTestCaseUpdate).toBe('function');
    expect(typeof current.handleStatusSubmit).toBe('function');
    expect(typeof current.debounceFetchTableData).toBe('function');
    expect(typeof current.debounceFetchTagOptions).toBe('function');
    expect(typeof current.debounceFetchServiceOptions).toBe('function');
    expect(typeof current.debounceFetchDataProductOptions).toBe('function');
    expect(typeof current.clearAll).toBe('function');

    expect(Array.isArray(current.selectedFilter)).toBe(true);
    expect(Array.isArray(current.filterMenu)).toBe(true);
    expect(Array.isArray(current.filters)).toBe(true);
    expect(Array.isArray(current.tableOptions)).toBe(true);
    expect(Array.isArray(current.tagOptions)).toBe(true);
    expect(Array.isArray(current.tierOptions)).toBe(true);
    expect(Array.isArray(current.serviceOptions)).toBe(true);
    expect(Array.isArray(current.dataProductOptions)).toBe(true);
    expect(Array.isArray(current.testCase)).toBe(true);
    expect(Array.isArray(current.extraDropdownContent)).toBe(true);

    expect(typeof current.isLoading).toBe('boolean');
    expect(typeof current.isOptionsLoading).toBe('boolean');
    expect(typeof current.isTestCaseSummaryLoading).toBe('boolean');
    expect(typeof current.showPagination).toBe('boolean');
    expect(typeof current.hasActiveFilters).toBe('boolean');

    expect(typeof current.searchValue).toBe('string');

    expect(typeof current.testCasePermission).toBe('object');
    expect(typeof current.testSuitePermission).toBe('object');
    expect(typeof current.testCaseSummary).toBe('object');
    expect(typeof current.pagingData).toBe('object');
    expect(typeof current.params).toBe('object');
    expect(current.form).toBeDefined();
    expect(typeof current.form).toBe('object');

    expect(typeof current.pagingData.pagingHandler).toBe('function');

    // On mount getTestCases seeds selectedFilter from DEFAULT_SELECTED_FILTERS
    // (status, type, table, tags) merged with the (empty) URL params.
    expect(current.selectedFilter).toEqual([
      TEST_CASE_FILTERS.status,
      TEST_CASE_FILTERS.type,
      TEST_CASE_FILTERS.table,
      TEST_CASE_FILTERS.tags,
    ]);
    expect(current.hasActiveFilters).toBe(false);
  });

  it('should fetch test cases on mount when the test-case view permission is granted', async () => {
    renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        includeAllTests: true,
        offset: 0,
      })
    );
  });

  it('should not fetch test cases and should stop loading when the view permission is missing', async () => {
    mockPermissions.testCase = { ViewAll: false, ViewBasic: false };

    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });

  it('should write the filter value to the URL when handleSearchParam is called', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    act(() => {
      result.current.handleSearchParam('tableFqn', 'svc.db.tbl');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('tableFqn=svc.db.tbl'),
      })
    );
  });

  it('should write the changed filter to the URL when handleFilterChange is called', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    act(() => {
      result.current.handleFilterChange?.(
        { testCaseStatus: TestCaseStatus.Failed },
        {}
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('testCaseStatus=Failed'),
      })
    );
  });

  it('should refetch with the new query params when the URL search changes', async () => {
    const { rerender } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    mockLocation.search = QueryString.stringify({ searchValue: 'orders' });
    rerender();

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '*orders*' })
      )
    );
  });

  it('should refetch for the requested page when the pagination handler is called', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    act(() => {
      result.current.pagingData.pagingHandler({ currentPage: 3 });
    });

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 20 })
      )
    );

    expect(mockHandlePageChange).toHaveBeenCalledWith(3);
  });

  it('should refetch with the provided sort options when sortTestCase is called', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      await result.current.sortTestCase({
        sortField: 'name',
        sortType: 'asc',
      } as unknown as TestCaseSearchParams);
    });

    expect(getListTestCaseBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortField: 'name', sortType: 'asc' })
    );
  });

  it('should optimistically replace the matching row by fullyQualifiedName on handleStatusSubmit', async () => {
    const original = buildTestCase('id-1', 'svc.db.tc1');
    const other = buildTestCase('id-2', 'svc.db.tc2');
    (getListTestCaseBySearch as jest.Mock).mockResolvedValueOnce({
      data: [original, other],
      paging: { total: 2 },
    });

    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(result.current.testCase).toHaveLength(2));

    const updated = buildTestCase('id-1', 'svc.db.tc1', {
      name: 'updated-name',
    });

    act(() => {
      result.current.handleStatusSubmit(updated);
    });

    expect(result.current.testCase[0]).toBe(updated);
    expect(result.current.testCase[1]).toBe(other);
  });

  it('should merge the matching row by id on handleTestCaseUpdate', async () => {
    const original = buildTestCase('id-1', 'svc.db.tc1');
    const other = buildTestCase('id-2', 'svc.db.tc2');
    (getListTestCaseBySearch as jest.Mock).mockResolvedValueOnce({
      data: [original, other],
      paging: { total: 2 },
    });

    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(result.current.testCase).toHaveLength(2));

    act(() => {
      result.current.handleTestCaseUpdate(
        buildTestCase('id-1', 'svc.db.tc1', { name: 'merged-name' })
      );
    });

    expect(result.current.testCase[0].name).toBe('merged-name');
    expect(result.current.testCase[1]).toBe(other);
  });

  it('should add the filter, prefetch its options and write the URL when a new menu item is clicked', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    act(() => {
      result.current.handleMenuClick({ key: 'tier' });
    });

    expect(result.current.selectedFilter).toContain('tier');
    expect(getTags).toHaveBeenCalledWith({ parent: 'Tier', limit: 50 });
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should remove an active filter and reset its form field when its menu item is clicked again', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    const setFieldsSpy = jest
      .spyOn(result.current.form, 'setFieldsValue')
      .mockImplementation(() => undefined);

    act(() => {
      result.current.handleMenuClick({ key: 'testCaseStatus' });
    });

    expect(result.current.selectedFilter).not.toContain('testCaseStatus');
    expect(setFieldsSpy).toHaveBeenCalledWith({ testCaseStatus: undefined });
  });

  it('should send the pinned request payload on mount with empty params', async () => {
    renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    const payload = (getListTestCaseBySearch as jest.Mock).mock.calls.at(
      -1
    )?.[0];

    expect(payload.fields).toEqual([
      TabSpecificField.TEST_CASE_RESULT,
      TabSpecificField.TESTSUITE,
      TabSpecificField.INCIDENT_ID,
    ]);
    expect(payload.includeAllTests).toBe(true);
    expect(payload.limit).toBe(10);
    expect(payload.offset).toBe(0);
    // No searchValue in the URL -> q is left undefined.
    expect(payload.q).toBeUndefined();
    // Empty testCaseStatus params -> forced undefined via the isEmpty guard.
    expect(payload.testCaseStatus).toBeUndefined();
    // Default sort order is spread into the request.
    expect(payload.sortField).toBe('testCaseResult.timestamp');
    expect(payload.sortType).toBe('desc');
  });

  it('should prefetch the default table and tag filter options on mount', async () => {
    const getTagsSpy = jest
      .spyOn(tagClassBase, 'getTags')
      .mockResolvedValue({ data: [], paging: { total: 0 } });

    renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    await waitFor(() =>
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.TABLE })
      )
    );

    expect(getTagsSpy).toHaveBeenCalledWith('', 1);

    getTagsSpy.mockRestore();
  });

  it('should expose the filter descriptors with the expected shape and wiring', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    const byKey = (key: string) =>
      result.current.filters.find((descriptor) => descriptor.key === key);

    // Descriptors track selectedFilter (defaults: table/type/status/tags).
    expect(result.current.filters.map((descriptor) => descriptor.key)).toEqual([
      TEST_CASE_FILTERS.table,
      TEST_CASE_FILTERS.type,
      TEST_CASE_FILTERS.status,
      TEST_CASE_FILTERS.tags,
    ]);

    result.current.filters.forEach((descriptor) => {
      expect(typeof descriptor.key).toBe('string');
      expect(descriptor.paramKey).toBe(descriptor.key);
      expect(typeof descriptor.label).toBe('string');
      expect(typeof descriptor.isLoading).toBe('boolean');
      expect(descriptor.isLoading).toBe(result.current.isOptionsLoading);
      expect(Array.isArray(descriptor.options)).toBe(true);
      expect(typeof descriptor.onGetInitialOptions).toBe('function');
      expect(typeof descriptor.onChange).toBe('function');
      // onSearch exists only for searchable filters (the onSearchByKey set).
      expect(descriptor.searchable).toBe(
        typeof descriptor.onSearch === 'function'
      );
      // No URL params on mount -> every descriptor value is undefined.
      expect(descriptor.value).toBeUndefined();
    });

    const tableDescriptor = byKey(TEST_CASE_FILTERS.table);
    const statusDescriptor = byKey(TEST_CASE_FILTERS.status);
    const typeDescriptor = byKey(TEST_CASE_FILTERS.type);
    const tagsDescriptor = byKey(TEST_CASE_FILTERS.tags);

    // Labels are mapped by param value back to the filter-name label.
    expect(tableDescriptor?.label).toBe(TEST_CASE_FILTERS_LABELS.table);
    expect(tagsDescriptor?.label).toBe(TEST_CASE_FILTERS_LABELS.tags);

    // controlType: single-select vs multiselect membership.
    expect(tableDescriptor?.controlType).toBe('select');
    expect(statusDescriptor?.controlType).toBe('select');
    expect(typeDescriptor?.controlType).toBe('select');
    expect(tagsDescriptor?.controlType).toBe('multiselect');

    // searchable: SEARCHABLE_FILTERS membership.
    expect(tableDescriptor?.searchable).toBe(true);
    expect(tagsDescriptor?.searchable).toBe(true);
    expect(statusDescriptor?.searchable).toBe(false);
    expect(typeDescriptor?.searchable).toBe(false);

    // options: static option sets vs (initially empty) async option sets.
    expect(statusDescriptor?.options.length).toBeGreaterThan(0);
    expect(typeDescriptor?.options.length).toBeGreaterThan(0);

    statusDescriptor?.options.forEach((option) => {
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
    });

    expect(tableDescriptor?.options).toEqual([]);
    expect(tagsDescriptor?.options).toEqual([]);
  });

  it('should route a descriptor onChange through handleSearchParam to the URL', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    const tableDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.table
    );

    act(() => {
      tableDescriptor?.onChange('svc.db.tbl');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('tableFqn=svc.db.tbl'),
      })
    );
  });

  it('should surface date and multiselect control types for lastRun and platform filters', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

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

  it('should reflect the URL filter value on the matching descriptor', async () => {
    mockLocation.search = QueryString.stringify({ tableFqn: 'svc.db.tbl' });

    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    const tableDescriptor = result.current.filters.find(
      (descriptor) => descriptor.key === TEST_CASE_FILTERS.table
    );

    expect(tableDescriptor?.value).toBe('svc.db.tbl');
  });

  it('should map URL filter params to the getListTestCaseBySearch request args', async () => {
    mockLocation.search = QueryString.stringify({
      tableFqn: 'sample_data.ecommerce_db.shopify.dim_customer',
      serviceName: 'sample_data',
      tags: 'PII.Sensitive',
      testCaseStatus: TestCaseStatus.Failed,
    });

    renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    const payload = (getListTestCaseBySearch as jest.Mock).mock.calls.at(
      -1
    )?.[0];

    // tableFqn is converted to an entityLink via generateEntityLink.
    expect(payload.entityLink).toContain(
      'sample_data.ecommerce_db.shopify.dim_customer'
    );
    expect(payload.serviceName).toBe('sample_data');
    expect(payload.tags).toBe('PII.Sensitive');
    // testCaseStatus is non-empty -> passed through as-is.
    expect(payload.testCaseStatus).toBe(TestCaseStatus.Failed);
    // No searchValue -> q stays undefined even with filters present.
    expect(payload.q).toBeUndefined();
  });

  it('should force testCaseStatus to undefined when the URL param is empty', async () => {
    mockLocation.search = QueryString.stringify({ testCaseStatus: '' });

    renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    const payload = (getListTestCaseBySearch as jest.Mock).mock.calls.at(
      -1
    )?.[0];

    expect(payload.testCaseStatus).toBeUndefined();
  });

  it('should reset filters, form and URL while preserving searchValue on clearAll', async () => {
    mockLocation.search = QueryString.stringify({
      searchValue: 'orders',
      tableFqn: 'svc.db.tbl',
    });

    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    const resetFieldsSpy = jest
      .spyOn(result.current.form, 'resetFields')
      .mockImplementation(() => undefined);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.selectedFilter).toEqual([
      TEST_CASE_FILTERS.status,
      TEST_CASE_FILTERS.type,
      TEST_CASE_FILTERS.table,
      TEST_CASE_FILTERS.tags,
    ]);
    expect(resetFieldsSpy).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenLastCalledWith({
      search: 'searchValue=orders',
    });

    const lastNavigateSearch = mockNavigate.mock.calls.at(-1)?.[0]?.search;

    expect(lastNavigateSearch).not.toContain('tableFqn');
  });

  it('should keep carrying sort options on a later fetch after sortTestCase', async () => {
    const { result } = renderHook(() => useTestCaseListPage());

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      await result.current.sortTestCase({
        sortField: 'name',
        sortType: 'asc',
      } as unknown as TestCaseSearchParams);
    });

    act(() => {
      result.current.pagingData.pagingHandler({ currentPage: 2 });
    });

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortField: 'name',
          sortType: 'asc',
          offset: 10,
        })
      )
    );
  });
});

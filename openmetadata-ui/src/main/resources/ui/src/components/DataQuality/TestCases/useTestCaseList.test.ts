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
import { FormInstance } from 'antd';
import { act } from 'react';
import { TEST_CASE_FILTERS } from '../../../constants/profiler.constant';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from '../../../enums/entity.enum';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { TestCaseSearchParams } from '../DataQuality.interface';
import { useTestCaseList, UseTestCaseListProps } from './useTestCaseList';

jest.mock('../../../rest/testAPI', () => ({
  ...jest.requireActual('../../../rest/testAPI'),
  getListTestCaseBySearch: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  ...jest.requireActual('../../../utils/ToastUtils'),
  showErrorToast: jest.fn(),
}));

const DEFAULT_SELECTED_FILTERS = [
  TEST_CASE_FILTERS.status,
  TEST_CASE_FILTERS.type,
  TEST_CASE_FILTERS.table,
  TEST_CASE_FILTERS.tags,
];

const buildProps = (
  overrides: Partial<UseTestCaseListProps> = {}
): UseTestCaseListProps => ({
  params: {},
  selectedFilter: [...DEFAULT_SELECTED_FILTERS],
  setSelectedFilter: jest.fn(),
  searchValue: '',
  form: { setFieldsValue: jest.fn() } as unknown as FormInstance,
  getInitialOptions: jest.fn(),
  tab: DataQualityPageTabs.TEST_CASES,
  testCasePermission: {
    ViewAll: true,
    ViewBasic: true,
  } as unknown as OperationPermission,
  currentPage: 1,
  pageSize: 10,
  paging: { after: '', before: '', total: 0 },
  handlePageChange: jest.fn(),
  handlePageSizeChange: jest.fn(),
  handlePagingChange: jest.fn(),
  showPagination: true,
  ...overrides,
});

const renderList = (overrides: Partial<UseTestCaseListProps> = {}) => {
  const props = buildProps(overrides);
  const rendered = renderHook(() => useTestCaseList(props));

  return { ...rendered, props };
};

const lastPayload = () =>
  (getListTestCaseBySearch as jest.Mock).mock.calls.at(-1)?.[0];

describe('useTestCaseList', () => {
  beforeEach(() => {
    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  it('should return the data concern shape with an empty list that starts loading', () => {
    const { result } = renderList();

    expect(Array.isArray(result.current.testCase)).toBe(true);
    expect(result.current.testCase).toEqual([]);
    expect(typeof result.current.setTestCase).toBe('function');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.fetchTestCases).toBe('function');
    expect(typeof result.current.sortTestCase).toBe('function');
    expect(typeof result.current.pagingData).toBe('object');
    expect(result.current.showPagination).toBe(true);
  });

  it('should fetch test cases on mount with the pinned request payload when permission and tab match', async () => {
    renderList();

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    const payload = lastPayload();

    expect(payload.fields).toEqual([
      TabSpecificField.TEST_CASE_RESULT,
      TabSpecificField.TESTSUITE,
      TabSpecificField.INCIDENT_ID,
    ]);
    expect(payload.includeAllTests).toBe(true);
    expect(payload.limit).toBe(10);
    expect(payload.offset).toBe(0);
    expect(payload.q).toBeUndefined();
    expect(payload.testCaseStatus).toBeUndefined();
    expect(payload.sortField).toBe('testCaseResult.timestamp');
    expect(payload.sortType).toBe('desc');
  });

  it('should wrap the searchValue in wildcards as the q param', async () => {
    renderList({ searchValue: 'orders' });

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    expect(lastPayload().q).toBe('*orders*');
  });

  it('should pass a non-empty testCaseStatus through as-is', async () => {
    renderList({
      params: { testCaseStatus: TestCaseStatus.Failed },
    });

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    expect(lastPayload().testCaseStatus).toBe(TestCaseStatus.Failed);
  });

  it('should not fetch and should stop loading when the view permission is missing', async () => {
    const { result } = renderList({
      testCasePermission: {
        ViewAll: false,
        ViewBasic: false,
      } as unknown as OperationPermission,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });

  it('should not fetch and should stop loading when the tab is not the test-cases tab', async () => {
    const { result } = renderList({
      tab: DataQualityPageTabs.TEST_SUITES,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });

  it('should apply the URL params through setSelectedFilter, getInitialOptions and the form before fetching', async () => {
    const { props } = renderList({
      params: { serviceName: 'sample_data' },
    });

    await waitFor(() => expect(getListTestCaseBySearch).toHaveBeenCalled());

    expect(props.getInitialOptions).toHaveBeenCalledWith(
      TEST_CASE_FILTERS.service,
      true
    );
    expect(props.getInitialOptions).toHaveBeenCalledWith(
      TEST_CASE_FILTERS.status,
      true
    );

    const updatedValue = (props.setSelectedFilter as jest.Mock).mock
      .calls[0][0];

    expect(updatedValue).toEqual([
      ...DEFAULT_SELECTED_FILTERS,
      TEST_CASE_FILTERS.service,
    ]);
    expect(props.form.setFieldsValue).toHaveBeenCalledWith({
      serviceName: 'sample_data',
    });
  });

  it('should change the page and refetch for the requested page when the paging handler is called', async () => {
    const { result, props } = renderList();

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    act(() => {
      result.current.pagingData.pagingHandler({ currentPage: 3 });
    });

    expect(props.handlePageChange).toHaveBeenCalledWith(3);

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 20 })
      )
    );
  });

  it('should persist the sort options across later fetches after sortTestCase', async () => {
    const { result } = renderList();

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

  it('should expose a number-based pagingData wired to the injected paging bag', async () => {
    const { result, props } = renderList();

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1)
    );

    const { pagingData } = result.current;

    expect(pagingData.isNumberBased).toBe(true);
    expect(pagingData.paging).toBe(props.paging);
    expect(pagingData.currentPage).toBe(1);
    expect(pagingData.pageSize).toBe(10);
    expect(pagingData.onShowSizeChange).toBe(props.handlePageSizeChange);
    expect(typeof pagingData.pagingHandler).toBe('function');
  });
});

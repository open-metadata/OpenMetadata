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
import { act } from 'react';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { TestSuite } from '../../../../generated/tests/testCase';
import { DataQualitySubTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestSuitesBySearch } from '../../../../rest/testAPI';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useTestSuitesData, UseTestSuitesDataProps } from './useTestSuitesData';

jest.mock('../../../../rest/testAPI', () => ({
  getListTestSuitesBySearch: jest.fn(),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetListTestSuitesBySearch =
  getListTestSuitesBySearch as jest.MockedFunction<
    typeof getListTestSuitesBySearch
  >;

type SuitesResponse = Awaited<ReturnType<typeof getListTestSuitesBySearch>>;

const createDeferred = () => {
  let resolve!: (value: SuitesResponse) => void;
  const promise = new Promise<SuitesResponse>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const suite = (name: string): TestSuite =>
  ({ id: name, name, fullyQualifiedName: name } as unknown as TestSuite);

const testSuitePermission = {
  ViewAll: true,
  ViewBasic: true,
} as OperationPermission;
const handlePageChange = jest.fn();
const handlePageSizeChange = jest.fn();
const handlePagingChange = jest.fn();

const buildProps = (
  overrides: Partial<UseTestSuitesDataProps> = {}
): UseTestSuitesDataProps => ({
  searchValue: '',
  owner: '',
  ownerFilterValue: undefined,
  subTab: DataQualitySubTabs.TABLE_SUITES,
  testSuitePermission,
  currentPage: 1,
  pageSize: 10,
  handlePageChange,
  handlePageSizeChange,
  handlePagingChange,
  ...overrides,
});

const renderData = (props: UseTestSuitesDataProps = buildProps()) =>
  renderHook((current: UseTestSuitesDataProps) => useTestSuitesData(current), {
    initialProps: props,
  });

describe('useTestSuitesData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPrioritizedViewPermission as jest.Mock).mockReturnValue(true);
    mockGetListTestSuitesBySearch.mockResolvedValue({
      data: [],
      paging: {},
    } as SuitesResponse);
  });

  it('should expose the documented data return shape', async () => {
    const { result } = renderData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(Array.isArray(result.current.testSuites)).toBe(true);
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.handleTestSuitesPageChange).toBe('function');
    expect(result.current.handlePageSizeChange).toBe(handlePageSizeChange);
  });

  it('should fetch table (basic) suites with offset 0 and the default params on mount', async () => {
    renderData();

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 0,
        fields: ['owners', 'summary'],
        q: undefined,
        includeEmptyTestSuites: false,
        testSuiteType: 'basic',
        sortField: 'lastResultTimestamp',
        sortType: 'desc',
      })
    );
  });

  it('should apply the fetched suites and stop loading', async () => {
    mockGetListTestSuitesBySearch.mockResolvedValue({
      data: [suite('a')],
      paging: {},
    } as SuitesResponse);

    const { result } = renderData();

    await waitFor(() =>
      expect(result.current.testSuites).toEqual([suite('a')])
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('should not fetch and should stop loading when the injected view permission is absent', async () => {
    (getPrioritizedViewPermission as jest.Mock).mockReturnValue(false);

    const { result } = renderData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetListTestSuitesBySearch).not.toHaveBeenCalled();
  });

  it('should gate the fetch on the injected testSuite permission for ViewBasic', async () => {
    renderData();

    await waitFor(() =>
      expect(getPrioritizedViewPermission).toHaveBeenCalled()
    );

    expect(getPrioritizedViewPermission).toHaveBeenCalledWith(
      testSuitePermission,
      Operation.ViewBasic
    );
  });

  it('should compute the fetch offset as (currentPage - 1) * pageSize', async () => {
    renderData(buildProps({ currentPage: 3, pageSize: 10 }));

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });

  it('should request logical suites and include empty suites for the bundle sub-tab', async () => {
    renderData(buildProps({ subTab: DataQualitySubTabs.BUNDLE_SUITES }));

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        includeEmptyTestSuites: true,
        testSuiteType: 'logical',
      })
    );
  });

  it('should pass the wildcard query and the owner filter key to the fetch', async () => {
    renderData(
      buildProps({
        searchValue: 'abc',
        ownerFilterValue: { key: 'u1', label: 'U1' },
      })
    );

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({ q: '*abc*', owner: 'u1' })
    );
  });

  it('should refetch when an injected filter changes (driving effect)', async () => {
    const { rerender } = renderData(buildProps());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    mockGetListTestSuitesBySearch.mockClear();
    rerender(buildProps({ searchValue: 'xyz' }));

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '*xyz*' })
    );
  });

  it('should drop a stale out-of-order response and keep only the latest request data', async () => {
    const first = createDeferred();
    const second = createDeferred();
    mockGetListTestSuitesBySearch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderData(buildProps());

    rerender(buildProps({ searchValue: 'abc' }));

    await act(async () => {
      second.resolve({ data: [suite('latest')], paging: {} } as SuitesResponse);
    });
    await act(async () => {
      first.resolve({ data: [suite('stale')], paging: {} } as SuitesResponse);
    });

    expect(result.current.testSuites).toEqual([suite('latest')]);
    expect(handlePagingChange).toHaveBeenCalledTimes(1);
  });

  it('should not toast a stale rejection once a newer request has settled', async () => {
    let rejectFirst!: (reason: unknown) => void;
    const firstPromise = new Promise<SuitesResponse>((_, reject) => {
      rejectFirst = reject;
    });
    const second = createDeferred();
    mockGetListTestSuitesBySearch
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderData(buildProps());

    rerender(buildProps({ searchValue: 'abc' }));

    await act(async () => {
      second.resolve({ data: [suite('latest')], paging: {} } as SuitesResponse);
    });
    await act(async () => {
      rejectFirst(new Error('stale-failure'));
      await Promise.resolve();
    });

    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result.current.testSuites).toEqual([suite('latest')]);
  });

  it('should show an error toast and stop loading when the fetch rejects', async () => {
    const error = new Error('boom');
    mockGetListTestSuitesBySearch.mockRejectedValueOnce(error);

    const { result } = renderData();

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(result.current.isLoading).toBe(false);
  });

  it('should delegate handleTestSuitesPageChange to handlePageChange without fetching itself', async () => {
    const { result } = renderData();

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    mockGetListTestSuitesBySearch.mockClear();

    act(() => {
      result.current.handleTestSuitesPageChange({
        currentPage: 3,
      } as Parameters<typeof result.current.handleTestSuitesPageChange>[0]);
    });

    expect(handlePageChange).toHaveBeenCalledWith(3);
    expect(mockGetListTestSuitesBySearch).not.toHaveBeenCalled();
  });
});

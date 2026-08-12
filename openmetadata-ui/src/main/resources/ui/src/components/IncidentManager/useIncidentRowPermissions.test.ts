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
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { TestCaseResolutionStatus } from '../../generated/tests/testCaseResolutionStatus';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import { useIncidentRowPermissions } from './useIncidentRowPermissions';

const mockGetPermission = jest.fn();

const listWithFqns = (...fqns: string[]): TestCaseIncidentStatusData => ({
  data: fqns.map((fullyQualifiedName) => ({
    testCaseReference: { fullyQualifiedName },
  })) as unknown as TestCaseResolutionStatus[],
  isLoading: false,
});

describe('useIncidentRowPermissions', () => {
  beforeEach(() => {
    mockGetPermission.mockResolvedValue({ ViewAll: true });
  });

  it('should stay loading with empty permissions when there are no rows', () => {
    const testCaseListData = listWithFqns();
    const { result } = renderHook(() =>
      useIncidentRowPermissions({
        testCaseListData,
        getEntityPermissionByFqn: mockGetPermission,
      })
    );

    expect(result.current.isPermissionLoading).toBe(true);
    expect(result.current.testCasePermissions).toEqual([]);
    expect(mockGetPermission).not.toHaveBeenCalled();
  });

  it('should resolve a TEST_CASE permission for every referenced test case', async () => {
    const testCaseListData = listWithFqns('fqn1', 'fqn2');
    const { result } = renderHook(() =>
      useIncidentRowPermissions({
        testCaseListData,
        getEntityPermissionByFqn: mockGetPermission,
      })
    );

    await waitFor(() => expect(result.current.isPermissionLoading).toBe(false));

    expect(mockGetPermission).toHaveBeenCalledTimes(2);
    expect(mockGetPermission).toHaveBeenCalledWith(
      ResourceEntity.TEST_CASE,
      'fqn1'
    );
    expect(mockGetPermission).toHaveBeenCalledWith(
      ResourceEntity.TEST_CASE,
      'fqn2'
    );
  });

  it('should keep only fulfilled permissions and tag each with its fqn', async () => {
    mockGetPermission
      .mockResolvedValueOnce({ ViewAll: true })
      .mockRejectedValueOnce(new Error('denied'));
    const testCaseListData = listWithFqns('fqn1', 'fqn2');
    const { result } = renderHook(() =>
      useIncidentRowPermissions({
        testCaseListData,
        getEntityPermissionByFqn: mockGetPermission,
      })
    );

    await waitFor(() => expect(result.current.isPermissionLoading).toBe(false));

    expect(result.current.testCasePermissions).toEqual([
      { ViewAll: true, fullyQualifiedName: 'fqn1' },
    ]);
  });

  it('should toggle the loading flag from true to false around resolution', async () => {
    const testCaseListData = listWithFqns('fqn1');
    const { result } = renderHook(() =>
      useIncidentRowPermissions({
        testCaseListData,
        getEntityPermissionByFqn: mockGetPermission,
      })
    );

    expect(result.current.isPermissionLoading).toBe(true);

    await waitFor(() => expect(result.current.isPermissionLoading).toBe(false));
  });

  it('should fall back to an empty fqn for a row without a test-case reference', async () => {
    const testCaseListData: TestCaseIncidentStatusData = {
      data: [{}] as unknown as TestCaseResolutionStatus[],
      isLoading: false,
    };
    const { result } = renderHook(() =>
      useIncidentRowPermissions({
        testCaseListData,
        getEntityPermissionByFqn: mockGetPermission,
      })
    );

    await waitFor(() => expect(result.current.isPermissionLoading).toBe(false));

    expect(mockGetPermission).toHaveBeenCalledWith(
      ResourceEntity.TEST_CASE,
      ''
    );
    expect(result.current.testCasePermissions).toEqual([
      { ViewAll: true, fullyQualifiedName: '' },
    ]);
  });

  it('should re-resolve permissions when the loaded rows change', async () => {
    const { result, rerender } = renderHook(
      ({ testCaseListData }) =>
        useIncidentRowPermissions({
          testCaseListData,
          getEntityPermissionByFqn: mockGetPermission,
        }),
      { initialProps: { testCaseListData: listWithFqns('fqn1') } }
    );

    await waitFor(() => expect(result.current.isPermissionLoading).toBe(false));

    mockGetPermission.mockClear();
    rerender({ testCaseListData: listWithFqns('fqn2') });

    await waitFor(() =>
      expect(mockGetPermission).toHaveBeenCalledWith(
        ResourceEntity.TEST_CASE,
        'fqn2'
      )
    );
  });
});

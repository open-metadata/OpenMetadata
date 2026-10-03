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
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { IncidentGroupFilters } from './IncidentGroups.types';
import { useIncidentGroupIncidents } from './useIncidentGroupIncidents';

const mockList = getListTestCaseIncidentStatus as jest.Mock;

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const FILTERS: IncidentGroupFilters = {
  status: [],
  severity: [],
  dateField: 'timestamp',
};
const GROUP: TestCaseIncidentGroup = {
  groupBy: IncidentGroupBy.TestDefinition,
  id: 'definition-id',
  name: 'tableRowCountToEqual',
  fullyQualifiedName: 'tableRowCountToEqual',
  incidentCount: 2,
};
const INCIDENTS = [{ id: 'incident-1' }, { id: 'incident-2' }];

const renderIncidents = (group?: TestCaseIncidentGroup) =>
  renderHook(
    ({ current }) =>
      useIncidentGroupIncidents({
        group: current,
        filters: FILTERS,
        defaultPageSize: 4,
      }),
    { initialProps: { current: group } }
  );

describe('useIncidentGroupIncidents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({
      data: INCIDENTS,
      paging: { total: 9, after: 'cursor-2' },
    });
  });

  it('should fetch nothing until a group is picked', () => {
    renderIncidents();

    expect(mockList).not.toHaveBeenCalled();
  });

  it("should list the group's incidents in the default page size", async () => {
    const { result } = renderIncidents(GROUP);

    await waitFor(() => expect(result.current.incidents).toEqual(INCIDENTS));

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        testDefinition: 'tableRowCountToEqual',
        latest: true,
        limit: 4,
      })
    );
    expect(mockList.mock.calls[0][0].page).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.paging).toEqual({ total: 9, after: 'cursor-2' });
  });

  it('should jump to a page and refetch in a new page size', async () => {
    const { result } = renderIncidents(GROUP);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handlePageChange(3));

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3, limit: 4 })
      )
    );

    expect(result.current.currentPage).toBe(3);

    act(() => result.current.handlePageSizeChange(8));

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 8 })
      )
    );

    expect(result.current.currentPage).toBe(1);
  });

  it('should scope the incidents to the active domain', async () => {
    useDomainStore.setState({ activeDomain: 'Marketing' });

    try {
      const { result } = renderIncidents(GROUP);
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'Marketing' })
      );
    } finally {
      useDomainStore.setState({ activeDomain: DEFAULT_DOMAIN_VALUE });
    }
  });

  it('should report a failed fetch', async () => {
    mockList.mockRejectedValue(new Error('failure'));
    const { result } = renderIncidents(GROUP);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.incidents).toEqual([]);
    // The list says so in place, so no toast repeats it.
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('should read the page again on refresh', async () => {
    mockList.mockRejectedValueOnce(new Error('failure'));
    const { result } = renderIncidents(GROUP);
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.incidents).toEqual(INCIDENTS));

    expect(result.current.isError).toBe(false);
  });

  it('should drop a response that lands after the group was closed', async () => {
    let resolveList: (value: unknown) => void = jest.fn();
    mockList.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );
    const { result, rerender } = renderIncidents(GROUP);

    rerender({ current: undefined });
    await act(async () => {
      resolveList({ data: INCIDENTS, paging: { total: 2 } });
    });

    expect(result.current.incidents).toEqual([]);
  });

  it("should not show the previous group's incidents while the next one loads", async () => {
    const { result, rerender } = renderIncidents(GROUP);
    await waitFor(() => expect(result.current.incidents).toEqual(INCIDENTS));

    mockList.mockReturnValue(new Promise(jest.fn()));
    rerender({ current: undefined });
    rerender({
      current: { ...GROUP, id: 'other-id', name: 'columnValuesToBeUnique' },
    });

    expect(result.current.incidents).toEqual([]);
    expect(result.current.paging).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('should not refetch when the same group is handed in again as a new object', async () => {
    const { result, rerender } = renderIncidents(GROUP);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ current: { ...GROUP, incidentCount: 3 } });

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(result.current.incidents).toEqual(INCIDENTS);
  });

  it('should step back to the last page when a refresh empties the current one', async () => {
    const { result } = renderIncidents(GROUP);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handlePageChange(3));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockList.mockResolvedValueOnce({ data: [], paging: { total: 5 } });
    act(() => result.current.refresh());

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    );

    expect(result.current.currentPage).toBe(2);
  });
});

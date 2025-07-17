/*
 *  Copyright 2024 Collate.
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
/* eslint-disable i18next/no-literal-string */
import { act, render, screen, waitFor } from '@testing-library/react';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_TABLE } from '../../../../mocks/TableData.mock';
import { getListTestCaseBySearch } from '../../../../rest/testAPI';
import { TableProfilerProvider } from './TableProfilerProvider';

// Mock dependencies
jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest
    .fn()
    .mockImplementation(() => ({ search: '?activeTab=Data%20Quality' }));
});

jest.mock('../../../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockReturnValue({ isTourOpen: false }),
}));
jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest
    .fn()
    .mockReturnValue({ handlePagingChange: jest.fn(), pageSize: 10 }),
}));
jest.mock('../../../../rest/tableAPI', () => ({
  getLatestTableProfileByFqn: jest.fn().mockResolvedValue({}),
  getTableDetailsByFQN: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest
    .fn()
    .mockResolvedValue({ data: [], paging: {} }),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../../../utils/TableUtils', () => ({
  generateEntityLink: jest.fn().mockReturnValue('entityLink'),
}));
jest.mock('../../../../constants/mockTourData.constants', () => ({
  mockDatasetData: { tableDetails: {} },
}));
jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue('table1'),
}));
jest.mock('../../../../constants/profiler.constant', () => ({
  DEFAULT_RANGE_DATA: {
    startTs: 1710825218156,
    endTs: 1711084418157,
  },
  DEFAULT_SELECTED_RANGE: {
    key: 'last7Days',
    title: 'Last 7 days',
    days: 7,
  },
}));

jest.mock('../../../../constants/DataInsight.constants', () => ({
  INITIAL_CHART_FILTER: {
    startTs: 1710825218156,
    endTs: 1711084418157,
  },
}));
jest.mock('./ProfilerSettingsModal/ProfilerSettingsModal', () =>
  jest.fn().mockReturnValue(<div>ProfilerSettingsModal.component</div>)
);
jest.mock('../../../../constants/constants', () => ({
  PAGE_SIZE: 10,
  ROUTES: {
    OBSERVABILITY_ALERTS: '/observability-alerts',
  },
}));

jest.mock('../../../../constants/LeftSidebar.constants', () => ({
  SIDEBAR_NESTED_KEYS: {},
  SIDEBAR_LIST: [],
}));
const mockPermissions = {
  ViewAll: true,
  ViewBasic: true,
  ViewTests: true,
} as OperationPermission;

describe('TableProfilerProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children without crashing', async () => {
    await act(async () => {
      render(
        <TableProfilerProvider permissions={mockPermissions} table={MOCK_TABLE}>
          <div>Test Children</div>
        </TableProfilerProvider>
      );
    });

    expect(await screen.findByText('Test Children')).toBeInTheDocument();

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByText('Test Children')).toBeInTheDocument();
    });
  });

  it('test cases should be fetch on data quality tab', async () => {
    await act(async () => {
      render(
        <TableProfilerProvider permissions={mockPermissions} table={MOCK_TABLE}>
          <div>Test Children</div>
        </TableProfilerProvider>
      );
    });

    const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

    await waitFor(() => {
      expect(mockGetListTestCase).toHaveBeenCalledTimes(1);
      expect(mockGetListTestCase).toHaveBeenCalledWith({
        entityLink: 'entityLink',
        fields: ['testCaseResult', 'incidentId'],
        includeAllTests: true,
        limit: 10,
        include: 'non-deleted',
      });
    });
  });

  it('test cases should be fetch on data quality tab with deleted', async () => {
    await act(async () => {
      render(
        <TableProfilerProvider
          permissions={mockPermissions}
          table={{ ...MOCK_TABLE, deleted: true }}>
          <div>Test Children</div>
        </TableProfilerProvider>
      );
    });

    const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

    await waitFor(() => {
      expect(mockGetListTestCase).toHaveBeenCalledTimes(1);
      expect(mockGetListTestCase).toHaveBeenCalledWith({
        entityLink: 'entityLink',
        fields: ['testCaseResult', 'incidentId'],
        includeAllTests: true,
        limit: 10,
        include: 'deleted',
      });
    });
  });
});

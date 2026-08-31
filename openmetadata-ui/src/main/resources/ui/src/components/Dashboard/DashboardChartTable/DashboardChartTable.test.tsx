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
import { act, render, waitFor } from '@testing-library/react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { fetchCharts } from '../../../utils/DashboardDetailsUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { ColumnsType } from '../../common/Table/Table.interface';
import { ChartType } from '../DashboardDetails/DashboardDetails.interface';
import { DashboardChartTable } from './DashboardChartTable';

// No prior test coverage for this file (Task 8 characterization-first rule). Scope is
// deliberately narrow — only the permission-flag wiring this batch touched, following the
// WorksheetColumnsTable.test.tsx precedent: the mocked <Table> renders nothing but captures
// the `columns` prop it was called with, and tests invoke each column's `render()` directly.

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../../../utils/DashboardDetailsUtils', () => ({
  fetchCharts: jest.fn(),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockReturnValue({
    filters: { showDeletedCharts: false },
    setFilters: jest.fn(),
  }),
}));

let capturedColumns: ColumnsType<ChartType> = [];

jest.mock('../../common/Table/Table', () =>
  jest.fn().mockImplementation((props: { columns: unknown }) => {
    capturedColumns = props.columns as typeof capturedColumns;

    return <div data-testid="dashboard-chart-table" />;
  })
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div />)
);

const mockChart = {
  id: 'chart-1',
  name: 'chart-1',
  displayName: 'Chart 1',
  fullyQualifiedName: 'test-dashboard.chart-1',
  description: 'chart description',
} as unknown as ChartType;

const mockDashboardDetails = {
  id: 'dashboard-id',
  fullyQualifiedName: 'test-dashboard',
  deleted: false,
  charts: [{ id: 'chart-1' }],
} as unknown as Dashboard;

const getColumnByKey = (key: string) =>
  capturedColumns.find((col) => 'key' in col && col.key === key);

describe('DashboardChartTable permission wiring', () => {
  const mockGetEntityPermission = jest.fn();

  /**
   * Renders and waits for the full two-stage async chain to settle: initializeCharts()
   * (fetchCharts) sets `charts`, which triggers the effect that calls
   * getAllChartsPermissions() (one getEntityPermission per chart), which sets
   * chartsPermissionsArray. A `waitFor` on the final assertion alone is not reliable here —
   * it can pass "early" on the transient state where chartsPermissionsArray is still empty
   * (permissionsObject undefined, which also reads as denied), giving a false GREEN that
   * never actually exercised the settled, fetched permissions. Waiting for the mock to have
   * been called, then explicitly flushing several microtask turns, avoids that race.
   */
  const renderAndFlush = async () => {
    render(<DashboardChartTable />);
    await waitFor(() => {
      expect(mockGetEntityPermission).toHaveBeenCalled();
    });
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedColumns = [];
    (fetchCharts as jest.Mock).mockResolvedValue([mockChart]);
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission: mockGetEntityPermission,
    });
    (useGenericContext as jest.Mock).mockReturnValue({
      data: mockDashboardDetails,
      onThreadLinkSelect: jest.fn(),
    });
  });

  it('grants description/tags/glossary-term edit via EditAll', async () => {
    mockGetEntityPermission.mockResolvedValue({ EditAll: true });

    await renderAndFlush();

    const descriptionCol = getColumnByKey('description');
    const tagsCol = getColumnByKey('tags');
    const glossaryCol = getColumnByKey('glossary');
    const descriptionEl = descriptionCol?.render?.(
      undefined,
      mockChart,
      0
    ) as React.ReactElement;
    const tagsEl = tagsCol?.render?.([], mockChart, 0) as React.ReactElement;
    const glossaryEl = glossaryCol?.render?.(
      [],
      mockChart,
      0
    ) as React.ReactElement;

    expect(descriptionEl.props.hasEditPermission).toBe(true);
    expect(tagsEl.props.hasTagEditAccess).toBe(true);
    expect(glossaryEl.props.hasTagEditAccess).toBe(true);
  });

  it('denies description edit when EditDescription is explicitly false, even with EditAll true', async () => {
    // Explicit-deny-wins fix (Task 6 Finding 1): the old raw `EditDescription || EditAll` OR
    // granted regardless of an explicit EditDescription:false.
    mockGetEntityPermission.mockResolvedValue({
      EditAll: true,
      EditDescription: false,
    });

    await renderAndFlush();

    const descriptionCol = getColumnByKey('description');
    const descriptionEl = descriptionCol?.render?.(
      undefined,
      mockChart,
      0
    ) as React.ReactElement;

    expect(descriptionEl.props.hasEditPermission).toBe(false);
  });

  it('denies tag/glossary-term edit when the permission fetch fails (falls back to DEFAULT_ENTITY_PERMISSION)', async () => {
    mockGetEntityPermission.mockRejectedValue(new Error('fetch failed'));

    await renderAndFlush();

    const tagsCol = getColumnByKey('tags');
    const tagsEl = tagsCol?.render?.([], mockChart, 0) as React.ReactElement;

    expect(tagsEl.props.hasTagEditAccess).toBe(false);
  });
});

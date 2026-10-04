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

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { updateTestCaseIncidentById } from '../../../../rest/incidentManagerAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import IncidentList from './IncidentList';

const mockGetEntityPermissionByFqn = jest.fn();
const mockOnIncidentChange = jest.fn();

jest.mock('../../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: (...args: unknown[]) =>
    mockGetEntityPermissionByFqn(...args),
}));

// The permission API answers with operation/access pairs.
const resourcePermission = (operations: Record<string, boolean>) => ({
  permissions: Object.entries(operations).map(([operation, allowed]) => ({
    operation,
    access: allowed ? 'allow' : 'deny',
  })),
});

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  updateTestCaseIncidentById: jest.fn().mockResolvedValue({}),
}));

// The chips own their popovers and workflow calls; a row only has to hand
// them the incident and hear back.
jest.mock(
  '../../../DataQuality/IncidentManager/TestCaseStatus/InlineTestCaseIncidentStatus.component',
  () => ({
    __esModule: true,
    default: ({ onSubmit }: { onSubmit: () => void }) => (
      <button data-testid="status-chip" onClick={onSubmit}>
        status
      </button>
    ),
  })
);

jest.mock(
  '../../../DataQuality/IncidentManager/Severity/InlineSeverity.component',
  () => ({
    __esModule: true,
    default: ({ onSubmit }: { onSubmit: (severity?: string) => void }) => (
      <button data-testid="severity-chip" onClick={() => onSubmit('Severity2')}>
        severity
      </button>
    ),
  })
);

const TEST_CASE_FQN = 'svc.db.shop.customers.customers_row_count';

// Only the first test case may be edited.
const grantEditOnFirstTestCase = () =>
  mockGetEntityPermissionByFqn.mockImplementation(
    async (_resource: string, fqn: string) =>
      resourcePermission({
        EditStatus: fqn === TEST_CASE_FQN,
        EditAll: false,
        ViewAll: true,
      })
  );

const assigned: TestCaseResolutionStatus = {
  id: 'incident-1',
  stateId: 'state-1',
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
  testCaseResolutionStatusDetails: {
    assignee: {
      id: 'user-1',
      type: 'user',
      name: 'tomas.montiel',
      displayName: 'Tomas Montiel',
    },
  },
  severity: Severities.Severity1,
  updatedAt: 1781000000000,
  testCaseReference: {
    id: 'case-1',
    type: 'testCase',
    name: 'customers_row_count',
    fullyQualifiedName: TEST_CASE_FQN,
  },
  failureSummary: 'Expected 48,210 rows, found 47,006',
};

const fresh: TestCaseResolutionStatus = {
  id: 'incident-2',
  stateId: 'state-2',
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
  updatedAt: 1781000000000,
  testCaseReference: {
    id: 'case-2',
    type: 'testCase',
    name: 'orders_rows',
    fullyQualifiedName: 'svc.db.shop.orders.orders_rows',
  },
};

const LocationState = () => (
  <span data-testid="location-state">
    {JSON.stringify(useLocation().state)}
  </span>
);

const renderList = (
  incidents: TestCaseResolutionStatus[] = [assigned, fresh],
  isLoading = false
) =>
  renderWithQueryClient(
    <MemoryRouter>
      <IncidentList
        incidents={incidents}
        isLoading={isLoading}
        onIncidentChange={mockOnIncidentChange}
      />
    </MemoryRouter>
  );

describe('IncidentList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityPermissionByFqn.mockResolvedValue(
      resourcePermission({ EditStatus: false, EditAll: false, ViewAll: true })
    );
  });

  it('should render one row per incident under the design columns', () => {
    renderList();

    expect(
      screen.getByRole('columnheader', { name: 'label.test-case-name' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'label.last-updated' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('should link the test case and name the table it runs on', () => {
    renderList();

    const row = screen.getByTestId('incident-row-incident-1');

    expect(
      within(row).getByRole('link', { name: 'customers_row_count' })
    ).toHaveAttribute(
      'href',
      observabilityRouterClassBase.getTestCaseDetailPagePath(TEST_CASE_FQN)
    );
    expect(within(row).getByTestId('incident-table')).toHaveTextContent(
      'customers'
    );
  });

  it('should hand the test case page a breadcrumb back to the listing as left', () => {
    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          '/observability/incident-manager?groupBy=table&group=svc.db.shop.customers',
        ]}>
        <IncidentList incidents={[assigned]} isLoading={false} />
        <LocationState />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: 'customers_row_count' }));

    expect(
      JSON.parse(screen.getByTestId('location-state').textContent ?? '')
    ).toEqual({
      breadcrumbData: [
        {
          name: 'label.incident-manager',
          url: '/observability/incident-manager?groupBy=table&group=svc.db.shop.customers',
        },
      ],
    });
  });

  it('should show the failure reason, status, severity and assignee', () => {
    renderList();

    const row = screen.getByTestId('incident-row-incident-1');

    expect(
      within(row).getByTestId('incident-failure-summary')
    ).toHaveTextContent('Expected 48,210 rows, found 47,006');
    expect(within(row).getByTestId('incident-status')).toHaveTextContent(
      'label.assigned'
    );
    expect(within(row).getByTestId('incident-severity')).toHaveTextContent(
      'Severity 1'
    );
    expect(within(row).getByTestId('incident-assignee')).toHaveTextContent(
      'Tomas Montiel'
    );
    // A label, not a disabled control sitting in the row.
    expect(
      within(within(row).getByTestId('incident-severity')).queryByRole('button')
    ).not.toBeInTheDocument();
  });

  it('should show the last update as a short date over its time', () => {
    renderList();

    expect(
      within(screen.getByTestId('incident-row-incident-1')).getByTestId(
        'incident-last-updated'
      )
    ).toHaveTextContent(formatDate(assigned.updatedAt));
  });

  it('should fall back for an incident with no reason and no assignee', () => {
    renderList();

    const row = screen.getByTestId('incident-row-incident-2');

    expect(
      within(row).queryByTestId('incident-failure-summary')
    ).not.toBeInTheDocument();
    expect(within(row).getByTestId('incident-severity')).toHaveTextContent(
      'label.no-entity'
    );
    expect(within(row).getByTestId('incident-status')).toHaveTextContent(
      'label.new'
    );
    expect(
      within(row).queryByTestId('incident-assignee')
    ).not.toBeInTheDocument();
  });

  it('should show a loader while the first page loads', () => {
    renderList([], true);

    expect(screen.getByTestId('incident-list-loader')).toBeInTheDocument();
  });

  it('should mark the rows on screen while the next page loads', () => {
    renderList([assigned], true);

    expect(screen.getByTestId('incident-list')).toHaveClass('tw:opacity-60');
  });

  it('should show the empty state when the group has no incident left', () => {
    renderList([]);

    expect(screen.getByTestId('incident-list-empty')).toBeInTheDocument();
  });

  it('should still render an incident that lost its test case reference', () => {
    renderList([
      {
        stateId: 'state-3',
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
        testCaseResolutionStatusDetails: {
          assignee: { id: 'team-1', type: 'team' },
        },
        timestamp: 1781000000000,
      },
    ]);

    expect(screen.getByTestId('incident-row-state-3')).toBeInTheDocument();
    expect(screen.getByTestId('incident-assignee')).toHaveTextContent('team-1');
  });

  describe('editing an incident in its row', () => {
    beforeEach(grantEditOnFirstTestCase);

    it('should offer the chips only where the test case may be edited', async () => {
      renderList();

      const editable = screen.getByTestId('incident-row-incident-1');
      const readOnly = screen.getByTestId('incident-row-incident-2');

      await waitFor(() =>
        expect(within(editable).getByTestId('status-chip')).toBeInTheDocument()
      );

      expect(within(editable).getByTestId('severity-chip')).toBeInTheDocument();
      expect(within(readOnly).queryByRole('button')).not.toBeInTheDocument();
      expect(within(readOnly).getByTestId('incident-status')).toHaveTextContent(
        'label.new'
      );
    });

    it('should patch a severity picked in the row and say so', async () => {
      renderList();
      const row = screen.getByTestId('incident-row-incident-1');
      await waitFor(() =>
        expect(within(row).getByTestId('severity-chip')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(within(row).getByTestId('severity-chip'));
      });

      expect(updateTestCaseIncidentById).toHaveBeenCalledWith('incident-1', [
        { op: 'replace', path: '/severity', value: 'Severity2' },
      ]);
      expect(mockOnIncidentChange).toHaveBeenCalledTimes(1);
    });

    it('should report a severity the server refused', async () => {
      (updateTestCaseIncidentById as jest.Mock).mockRejectedValueOnce(
        new Error('denied')
      );
      renderList();
      const row = screen.getByTestId('incident-row-incident-1');
      await waitFor(() =>
        expect(within(row).getByTestId('severity-chip')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(within(row).getByTestId('severity-chip'));
      });

      expect(mockOnIncidentChange).not.toHaveBeenCalled();
    });

    it('should keep a row read-only when its permission cannot be read', async () => {
      mockGetEntityPermissionByFqn.mockRejectedValue(new Error('forbidden'));
      renderList([assigned]);

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalled()
      );

      expect(
        within(screen.getByTestId('incident-row-incident-1')).queryByRole(
          'button'
        )
      ).not.toBeInTheDocument();
    });

    it('should still edit when nobody listens for the change', async () => {
      const { id: _id, ...withoutId } = assigned;
      renderWithQueryClient(
        <MemoryRouter>
          <IncidentList incidents={[withoutId]} isLoading={false} />
        </MemoryRouter>
      );
      await waitFor(() =>
        expect(screen.getByTestId('status-chip')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('status-chip'));
        fireEvent.click(screen.getByTestId('severity-chip'));
      });

      expect(updateTestCaseIncidentById).toHaveBeenCalledWith(
        '',
        expect.any(Array)
      );
    });

    it('should say so once a status was changed from the row', async () => {
      renderList();
      const row = screen.getByTestId('incident-row-incident-1');
      await waitFor(() =>
        expect(within(row).getByTestId('status-chip')).toBeInTheDocument()
      );

      fireEvent.click(within(row).getByTestId('status-chip'));

      expect(mockOnIncidentChange).toHaveBeenCalledTimes(1);
    });
  });
});

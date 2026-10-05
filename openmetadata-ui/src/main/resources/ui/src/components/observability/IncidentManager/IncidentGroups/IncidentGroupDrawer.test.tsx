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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  IncidentGroupBy,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import IncidentGroupDrawer from './IncidentGroupDrawer';

const mockList = getListTestCaseIncidentStatus as jest.Mock;
const mockOnClose = jest.fn();
const mockOnViewAll = jest.fn();

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
  updateTestCaseIncidentById: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn().mockResolvedValue({
    permissions: ['EditStatus', 'EditAll', 'ViewAll'].map((operation) => ({
      operation,
      access: 'allow',
    })),
  }),
}));

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

jest.mock('../../../common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <span>avatar</span>),
}));

const mockOnIncidentChange = jest.fn();

const GROUP: TestCaseIncidentGroup = {
  groupBy: IncidentGroupBy.TestDefinition,
  id: 'definition-id',
  name: 'tableRowCountToEqual',
  displayName: 'Row count',
  fullyQualifiedName: 'tableRowCountToEqual',
  incidentCount: 5,
  severity: Severities.Severity1,
  firstSeen: 1755000000000,
  lastSeen: 1781000000000,
  tableCount: 3,
};

runQueryNotificationsSynchronously();

const renderDrawer = (group?: TestCaseIncidentGroup) =>
  renderWithQueryClient(
    <MemoryRouter>
      <IncidentGroupDrawer
        filters={{ status: [], severity: [], dateField: 'timestamp' }}
        group={group}
        onClose={mockOnClose}
        onIncidentChange={mockOnIncidentChange}
        onViewAll={mockOnViewAll}
      />
    </MemoryRouter>
  );

describe('IncidentGroupDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({
      data: [
        {
          id: 'incident-1',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
          testCaseReference: {
            id: 'case-1',
            type: 'testCase',
            name: 'customers_row_count',
            fullyQualifiedName: 'svc.db.shop.customers.customers_row_count',
          },
        },
      ],
      paging: { total: 20, after: 'cursor-2' },
    });
  });

  it('should stay closed, and fetch nothing, without a group', () => {
    renderDrawer();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('should summarise the group and list its incidents', async () => {
    await act(async () => {
      renderDrawer(GROUP);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('label.incident-group')).toBeInTheDocument();
    expect(screen.getByTestId('incident-group-drawer-name')).toHaveTextContent(
      'Row count'
    );
    expect(screen.getByTestId('group-related')).toHaveTextContent(
      'label.table-count'
    );
    expect(screen.getByTestId('incident-group-stat-count')).toHaveTextContent(
      '5'
    );
    expect(
      screen.getByTestId('incident-group-stat-first-seen')
    ).toHaveTextContent(formatDate(GROUP.firstSeen));
    expect(
      screen.getByTestId('incident-group-stat-last-seen')
    ).toHaveTextContent(formatDate(GROUP.lastSeen));
    expect(screen.getByTestId('incident-row-incident-1')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        testDefinition: 'tableRowCountToEqual',
        limit: 15,
      })
    );
  });

  it('should say a failed read in place, not as no incidents, and retry it', async () => {
    mockList.mockRejectedValueOnce(new Error('failure'));

    await act(async () => {
      renderDrawer(GROUP);
    });

    expect(
      screen.getByTestId('incident-group-incidents-error')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('incident-list-empty')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('incident-row-incident-1')).toBeInTheDocument();
  });

  it('should open the full drill-down of the group', async () => {
    await act(async () => {
      renderDrawer(GROUP);
    });

    fireEvent.click(screen.getByTestId('incident-group-view-all'));

    expect(mockOnViewAll).toHaveBeenCalledWith(GROUP);
  });

  it('should close from its close button and on Escape', async () => {
    await act(async () => {
      renderDrawer(GROUP);
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(mockOnClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('should page through the incidents', async () => {
    await act(async () => {
      renderDrawer(GROUP);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });

  it('should name the owner bucket of no entity', async () => {
    await act(async () => {
      renderDrawer({
        groupBy: IncidentGroupBy.Owner,
        name: 'No Owner',
        incidentCount: 2,
      });
    });

    expect(screen.getByTestId('incident-group-drawer-name')).toHaveTextContent(
      'label.no-entity'
    );
  });

  it('should re-read its incidents and flag the groups stale after a row change', async () => {
    await act(async () => {
      renderDrawer(GROUP);
    });
    await waitFor(() =>
      expect(screen.getByTestId('severity-chip')).toBeInTheDocument()
    );
    const reads = mockList.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('severity-chip'));
    });

    expect(mockOnIncidentChange).toHaveBeenCalledTimes(1);
    expect(mockList.mock.calls.length).toBeGreaterThan(reads);
  });
});

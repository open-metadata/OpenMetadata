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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  IncidentGroupBy,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import IncidentGroupDrawer from './IncidentGroupDrawer';

const mockList = getListTestCaseIncidentStatus as jest.Mock;
const mockOnClose = jest.fn();
const mockOnViewAll = jest.fn();

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

jest.mock('../../../common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <span>avatar</span>),
}));

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

const renderDrawer = (group?: TestCaseIncidentGroup) =>
  render(
    <MemoryRouter>
      <IncidentGroupDrawer
        filters={{ status: [], dateField: 'timestamp' }}
        group={group}
        onClose={mockOnClose}
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
      paging: { total: 5, after: 'cursor-2' },
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
        limit: 4,
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
});

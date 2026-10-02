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

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import IncidentList from './IncidentList';

import { formatDate } from '../../../../utils/date-time/DateTimeUtils';

const TEST_CASE_FQN = 'svc.db.shop.customers.customers_row_count';

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

const renderList = (
  incidents: TestCaseResolutionStatus[] = [assigned, fresh],
  isLoading = false
) =>
  render(
    <MemoryRouter>
      <IncidentList incidents={incidents} isLoading={isLoading} />
    </MemoryRouter>
  );

describe('IncidentList', () => {
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
});

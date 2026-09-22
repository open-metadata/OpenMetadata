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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { IncidentTrendSparklineProps } from './IncidentGroups.types';
import IncidentGroupsTable from './IncidentGroupsTable';

jest.mock('./IncidentTrendSparkline', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      ({ trend, trendDirection }: IncidentTrendSparklineProps) => (
        <div data-testid="trend-sparkline">
          {`${trendDirection ?? 'none'}:${trend?.join(',') ?? ''}`}
        </div>
      )
    ),
  isRecurring: jest.fn(),
}));

const mockOnSortTypeChange = jest.fn();

const fixtureGroup: TestCaseIncidentGroup = {
  groupBy: IncidentGroupBy.Table,
  id: 'a3f6b0de-1a0e-4a2f-9f2e-8c6a9f1b2c3d',
  name: 'dim_address',
  displayName: 'Dim Address',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
  incidentCount: 5,
  severity: Severities.Severity1,
  status: TestCaseResolutionStatusTypes.Assigned,
  assignees: ['tomas.montiel', 'mohit', 'paul.jones'],
  assigneeCount: 5,
  firstSeen: 1755000000000,
  lastSeen: 1781000000000,
  trend: [1, 0, 0, 2, 0, 1, 3, 4],
  trendDirection: IncidentTrendDirection.Rising,
};

const renderTable = (
  groups: TestCaseIncidentGroup[] = [fixtureGroup],
  groupBy = IncidentGroupBy.Table
) =>
  render(
    <IncidentGroupsTable
      groupBy={groupBy}
      groups={groups}
      sortType="desc"
      onSortTypeChange={mockOnSortTypeChange}
    />
  );

describe('IncidentGroupsTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should map every column of a group onto the row', () => {
    renderTable();

    expect(screen.getByTestId('group-name')).toHaveTextContent('Dim Address');
    expect(screen.getByTestId('group-sub-line')).toHaveTextContent(
      'sample_data · ecommerce_db · shopify'
    );
    expect(screen.getByTestId('group-dimension')).toHaveTextContent(
      'label.table'
    );
    expect(screen.getByTestId('group-incident-count')).toHaveTextContent('5');
    expect(screen.getByTestId('group-severity')).toHaveTextContent(
      'Severity 1'
    );
    expect(screen.getByTestId('group-status')).toHaveTextContent(
      'label.assigned'
    );
    expect(screen.getByTestId('group-last-seen')).toHaveTextContent(
      formatDate(fixtureGroup.lastSeen)
    );
    expect(screen.getByTestId('group-first-seen')).toHaveTextContent(
      'label.first-seen-date'
    );
    expect(screen.getByTestId('trend-sparkline')).toHaveTextContent(
      'Rising:1,0,0,2,0,1,3,4'
    );
  });

  it('should draw three avatars and count the rest from assigneeCount', () => {
    renderTable();

    expect(
      screen.getByTestId('group-assignee-tomas.montiel')
    ).toHaveTextContent('TM');
    expect(screen.getByTestId('group-assignee-mohit')).toHaveTextContent('M');
    expect(screen.getByTestId('group-assignee-paul.jones')).toHaveTextContent(
      'PJ'
    );
    // 5 assignees, 3 in the (server-capped) array.
    expect(screen.getByTestId('group-assignee-overflow')).toHaveTextContent(
      '+2'
    );
  });

  it('should fall back for every field the group does not carry', () => {
    renderTable([
      {
        groupBy: IncidentGroupBy.TestDefinition,
        name: 'columnValuesToBeUnique',
        incidentCount: 1,
      },
    ]);

    expect(screen.getByTestId('group-name')).toHaveTextContent(
      'columnValuesToBeUnique'
    );
    expect(screen.queryByTestId('group-sub-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('group-severity')).toHaveTextContent(
      'label.no-entity'
    );
    expect(screen.getByTestId('group-status')).toHaveTextContent('--');
    expect(screen.getByTestId('group-last-seen')).toHaveTextContent('--');
    expect(screen.queryByTestId('group-first-seen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('group-assignees')).not.toBeInTheDocument();
    expect(screen.getByText('label.none')).toBeInTheDocument();
    expect(screen.getByTestId('trend-sparkline')).toHaveTextContent('none:');
  });

  it('should name the first column after the dimension in use', () => {
    renderTable([fixtureGroup], IncidentGroupBy.Owner);

    expect(
      screen.getByRole('columnheader', { name: 'label.test-case-owner' })
    ).toBeInTheDocument();
  });

  it('should hand the flipped ordering back as a sortType', () => {
    renderTable();

    fireEvent.click(
      screen.getByRole('columnheader', { name: /label.incident-plural/ })
    );

    expect(mockOnSortTypeChange).toHaveBeenCalledWith('asc');
  });
});

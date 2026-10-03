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

import { fireEvent, render, screen, within } from '@testing-library/react';
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

// The global mock drops the interpolated values; the related badge is a count,
// so this one keeps it to assert what the badge was handed.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { language: 'en-US', dir: jest.fn().mockReturnValue('ltr') },
  }),
}));

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
}));

const mockOnSortChange = jest.fn();
const mockOnGroupPreview = jest.fn();
const mockOnGroupOpen = jest.fn();
const mockOnGroupSelect = jest.fn();
const mockOnPageSelect = jest.fn();

// Same press sequence react-aria listens for on rows and buttons.
const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

const fixtureGroup: TestCaseIncidentGroup = {
  groupBy: IncidentGroupBy.Table,
  id: 'a3f6b0de-1a0e-4a2f-9f2e-8c6a9f1b2c3d',
  name: 'dim_address',
  displayName: 'Dim Address',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
  incidentCount: 5,
  severity: Severities.Severity1,
  status: TestCaseResolutionStatusTypes.Assigned,
  statusCounts: [
    { status: TestCaseResolutionStatusTypes.Assigned, count: 3 },
    { status: TestCaseResolutionStatusTypes.ACK, count: 1 },
    { status: TestCaseResolutionStatusTypes.New, count: 1 },
  ],
  assignees: ['tomas.montiel', 'mohit', 'paul.jones', 'data-eng', 'wei'],
  assigneeCount: 5,
  assigneeReferences: [
    { id: 'u1', type: 'user', name: 'tomas.montiel', displayName: 'Tomas' },
    { id: 'u2', type: 'user', name: 'mohit' },
    { id: 'u3', type: 'user', name: 'paul.jones' },
    { id: 't1', type: 'team', name: 'data-eng' },
    { id: 'u4', type: 'user', name: 'wei' },
  ],
  firstSeen: 1755000000000,
  lastSeen: 1781000000000,
  trend: [1, 0, 0, 2, 0, 1, 3, 4],
  trendDirection: IncidentTrendDirection.Rising,
  tableCount: 1,
  tables: [{ id: 't1', type: 'table', name: 'dim_address' }],
  testDefinitionCount: 3,
  testDefinitions: [
    {
      id: 'd1',
      type: 'testDefinition',
      name: 'rowCount',
      displayName: 'Row count',
    },
    {
      id: 'd2',
      type: 'testDefinition',
      name: 'uniqueness',
      displayName: 'Uniqueness',
    },
    {
      id: 'd3',
      type: 'testDefinition',
      name: 'nullCheck',
      displayName: 'Null check',
    },
  ],
};

const renderTable = (
  groups: TestCaseIncidentGroup[] = [fixtureGroup],
  groupBy = IncidentGroupBy.Table,
  selectedKeys: ReadonlySet<string> = new Set(),
  isSelectable = true
) =>
  render(
    <IncidentGroupsTable
      groupBy={groupBy}
      groups={groups}
      isSelectable={isSelectable}
      selectedKeys={selectedKeys}
      sort={{ field: 'incidentCount', type: 'desc' }}
      onGroupOpen={mockOnGroupOpen}
      onGroupPreview={mockOnGroupPreview}
      onGroupSelect={mockOnGroupSelect}
      onPageSelect={mockOnPageSelect}
      onSortChange={mockOnSortChange}
    />
  );

describe('IncidentGroupsTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should map every column of a group onto the row', () => {
    renderTable();

    expect(screen.getByTestId('group-name')).toHaveTextContent('Dim Address');
    expect(screen.getByTestId('group-sub-line')).toHaveTextContent(
      'Row count · Uniqueness · Null check'
    );
    expect(screen.getByTestId('group-related')).toHaveTextContent(
      'label.type-count:3'
    );
    expect(screen.getByTestId('group-incident-count')).toHaveTextContent('5');
    expect(screen.getByTestId('group-severity')).toHaveTextContent(
      'Severity 1'
    );
    expect(screen.getByTestId('group-status-counts')).toHaveTextContent(
      '3 label.assigned-lowercase · 1 label.ack-lowercase · 1 label.new-lowercase'
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

  it('should stack three assignees and fold the rest into +N', () => {
    renderTable();

    expect(screen.getAllByTestId('avatar-group-item')).toHaveLength(3);
    expect(screen.getByTestId('Tomas')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-group-overflow')).toHaveTextContent('+2');
  });

  it('should show the full FQNs of the name and the sub-line on hover', () => {
    renderTable(
      [
        {
          ...fixtureGroup,
          groupBy: IncidentGroupBy.TestDefinition,
          tables: [
            {
              id: 't1',
              type: 'table',
              name: 'orders',
              fullyQualifiedName: 'svc.db.shop.orders',
            },
          ],
        },
      ],
      IncidentGroupBy.TestDefinition
    );

    expect(screen.getByTestId('group-name')).toHaveAttribute(
      'title',
      fixtureGroup.fullyQualifiedName
    );
    expect(screen.getByTestId('group-sub-line')).toHaveAttribute(
      'title',
      'svc.db.shop.orders'
    );
  });

  it('should show severity as a read-only badge, not a control', () => {
    renderTable();

    expect(
      within(screen.getByTestId('group-severity')).queryByRole('button')
    ).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('group-related')).not.toBeInTheDocument();
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

  it('should name the owner dimension bucket of unowned test cases', () => {
    renderTable(
      [{ groupBy: IncidentGroupBy.Owner, name: 'No Owner', incidentCount: 4 }],
      IncidentGroupBy.Owner
    );

    expect(screen.getByTestId('group-name')).toHaveTextContent(
      'label.no-entity'
    );
    expect(screen.getByTestId('group-incident-count')).toHaveTextContent('4');
  });

  it('should name the first column after the dimension in use', () => {
    renderTable([fixtureGroup], IncidentGroupBy.Owner);

    expect(
      screen.getByRole('columnheader', { name: 'label.test-case-owner' })
    ).toBeInTheDocument();
  });

  it('should flip the ordering of the column it is sorted by', () => {
    renderTable();

    fireEvent.click(
      screen.getByRole('columnheader', { name: /label.incident-plural/ })
    );

    expect(mockOnSortChange).toHaveBeenCalledWith({
      field: 'incidentCount',
      type: 'asc',
    });
  });

  it.each([
    ['label.severity', 'severity'],
    ['label.last-seen', 'lastSeen'],
  ])(
    'should open the %s column on its useful end, worst or latest first',
    (header, field) => {
      renderTable();

      fireEvent.click(
        screen.getByRole('columnheader', { name: new RegExp(header) })
      );

      expect(mockOnSortChange).toHaveBeenCalledWith({ field, type: 'desc' });
    }
  );

  it('should leave the other columns unsortable', () => {
    renderTable();

    fireEvent.click(screen.getByRole('columnheader', { name: 'label.status' }));

    expect(mockOnSortChange).not.toHaveBeenCalled();
  });

  it('should head the related column after what it counts', () => {
    renderTable([fixtureGroup], IncidentGroupBy.TestDefinition);

    expect(
      screen.getByRole('columnheader', { name: 'label.table-plural' })
    ).toBeInTheDocument();
  });

  it('should head the related column with the check type for a table', () => {
    renderTable();

    expect(
      screen.getByRole('columnheader', { name: 'label.check-type' })
    ).toBeInTheDocument();
  });

  it('should count the tables of a test definition group', () => {
    renderTable(
      [
        {
          ...fixtureGroup,
          groupBy: IncidentGroupBy.TestDefinition,
          tableCount: 3,
        },
      ],
      IncidentGroupBy.TestDefinition
    );

    expect(screen.getByTestId('group-related')).toHaveTextContent(
      'label.table-count:3'
    );
    // The array is capped server-side, so the sub-line lists what it holds
    // while the pill counts from the field.
    expect(screen.getByTestId('group-sub-line')).toHaveTextContent(
      'dim_address'
    );
  });

  it('should read a single table in the singular', () => {
    renderTable(
      [{ ...fixtureGroup, groupBy: IncidentGroupBy.TestDefinition }],
      IncidentGroupBy.TestDefinition
    );

    expect(screen.getByTestId('group-related')).toHaveTextContent(
      'label.table-count:1'
    );
  });

  it('should name the only test definition of a group instead of counting it', () => {
    renderTable(
      [
        {
          ...fixtureGroup,
          groupBy: IncidentGroupBy.Owner,
          testDefinitionCount: 1,
          testDefinitions: [fixtureGroup.testDefinitions?.[0]].filter(
            Boolean
          ) as TestCaseIncidentGroup['testDefinitions'],
        },
      ],
      IncidentGroupBy.Owner
    );

    expect(screen.getByTestId('group-related')).toHaveTextContent('Row count');
    expect(screen.getByTestId('group-sub-line')).toHaveTextContent(
      'dim_address'
    );
  });

  it('should count a single test definition it cannot name', () => {
    renderTable([
      { ...fixtureGroup, testDefinitionCount: 1, testDefinitions: [] },
    ]);

    expect(screen.getByTestId('group-related')).toHaveTextContent(
      'label.type-count:1'
    );
  });

  it('should preview a group when its row is pressed', () => {
    renderTable();

    press(screen.getByTestId('group-name'));

    expect(mockOnGroupPreview).toHaveBeenCalledWith(fixtureGroup);
    expect(mockOnGroupOpen).not.toHaveBeenCalled();
  });

  it('should open the drill-down from the row chevron, not the preview', () => {
    renderTable();

    const open = screen.getByTestId(`group-open-${fixtureGroup.id}`);

    expect(open).toHaveAccessibleName('label.view-entity');

    press(open);

    expect(mockOnGroupOpen).toHaveBeenCalledWith(fixtureGroup);
    expect(mockOnGroupPreview).not.toHaveBeenCalled();
  });

  it('should still preview a row pressed while other groups are selected', () => {
    renderTable([fixtureGroup], IncidentGroupBy.Table, new Set(['other']));

    press(screen.getByTestId('group-name'));

    expect(mockOnGroupPreview).toHaveBeenCalledWith(fixtureGroup);
    expect(mockOnGroupSelect).not.toHaveBeenCalled();
  });

  it('should select a group from its checkbox, without previewing it', () => {
    renderTable();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.select-entity' })
    );

    expect(mockOnGroupSelect).toHaveBeenCalledWith(fixtureGroup, true);
    expect(mockOnGroupPreview).not.toHaveBeenCalled();
  });

  it('should offer no checkboxes to a user who cannot change incidents', () => {
    renderTable([fixtureGroup], IncidentGroupBy.Table, new Set(), false);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('group-severity')).toBeInTheDocument();
  });

  it('should show a partly selected page and select all of it', () => {
    const second = { ...fixtureGroup, id: 'second', name: 'second' };
    renderTable(
      [fixtureGroup, second],
      IncidentGroupBy.Table,
      new Set([fixtureGroup.id as string])
    );

    const pageCheckbox = within(
      screen.getByTestId('group-select-page')
    ).getByRole('checkbox', { name: 'label.select-all' });

    expect(pageCheckbox).toBePartiallyChecked();

    fireEvent.click(pageCheckbox);

    expect(mockOnPageSelect).toHaveBeenCalledWith(true);
  });
});

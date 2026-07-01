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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { NextPreviousProps } from '../common/NextPrevious/NextPrevious.interface';
import { TestCasePermission } from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { TestCaseResolutionStatus } from '../../generated/tests/testCaseResolutionStatus';
import IncidentManagerTable, {
  IncidentManagerTableProps,
} from './IncidentManagerTable.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const TableMock = Object.assign(
    ({
      children,
      'data-testid': testId,
      'aria-label': ariaLabel,
    }: {
      children?: React.ReactNode;
      'data-testid'?: string;
      'aria-label'?: string;
    }) => (
      <table aria-label={ariaLabel} data-testid={testId}>
        {children}
      </table>
    ),
    {
      Header: ({
        columns,
        children,
      }: {
        columns?: { id: string; label: string }[];
        children: (col: { id: string; label: string }) => React.ReactNode;
      }) => (
        <thead>
          <tr>
            {columns?.map((col) => (
              <th key={col.id}>{children(col)}</th>
            ))}
          </tr>
        </thead>
      ),
      Head: ({ label }: { label?: string }) => <span>{label}</span>,
      Body: ({
        items,
        children,
        renderEmptyState,
      }: {
        items?: unknown[];
        children: (item: unknown) => React.ReactNode;
        renderEmptyState?: () => React.ReactNode;
        dependencies?: unknown[];
      }) => (
        <tbody>
          {!items || items.length === 0
            ? renderEmptyState?.()
            : items.map((item) => children(item))}
        </tbody>
      ),
      Row: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
        <tr data-rowid={id}>{children}</tr>
      ),
      Cell: ({ children }: { children?: React.ReactNode }) => (
        <td>{children}</td>
      ),
    }
  );

  return {
    Skeleton: jest
      .fn()
      .mockImplementation(() => <div data-testid="skeleton" />),
    Table: TableMock,
  };
});

jest.mock('../common/NextPrevious/NextPrevious', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="next-previous">NextPrevious</div>);
});

jest.mock('../common/DateTimeDisplay/DateTimeDisplay', () => {
  return jest.fn().mockImplementation(() => <div>DateTimeDisplay</div>);
});

jest.mock('../common/ErrorWithPlaceholder/FilterTablePlaceHolder', () => {
  return jest
    .fn()
    .mockImplementation(({ placeholderText }: { placeholderText?: string }) => (
      <div data-testid="filter-table-placeholder">{placeholderText}</div>
    ));
});

jest.mock('../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

jest.mock('../DataQuality/IncidentManager/Severity/Severity.component', () => {
  return jest.fn().mockImplementation(() => <div>Severity</div>);
});

jest.mock(
  '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TestCaseIncidentManagerStatus</div>);
  }
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, ...rest }) => (
    <a {...rest}>{children}</a>
  )),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('EntityName'),
}));

jest.mock('../../utils/FqnUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('NameFromFQN'),
  getPartialNameFromTableFQN: jest.fn().mockReturnValue('PartialName'),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('entity-details-path'),
}));

jest.mock('../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getTestCaseDetailPagePath: jest.fn().mockReturnValue('test-case-path'),
  },
}));

const mockRecords: TestCaseResolutionStatus[] = [
  {
    id: 'tcr-1',
    testCaseReference: {
      id: 'tc-1',
      type: 'testCase',
      name: 'test_case_1',
      fullyQualifiedName: 'svc.db.schema.table.test_case_1',
    },
    testCaseResolutionStatusType: 'New',
    timestamp: 1710161424255,
  } as TestCaseResolutionStatus,
  {
    id: 'tcr-2',
    testCaseReference: {
      id: 'tc-2',
      type: 'testCase',
      name: 'test_case_2',
      fullyQualifiedName: 'svc.db.schema.table.test_case_2',
    },
    testCaseResolutionStatusType: 'Ack',
    timestamp: 1710161424256,
  } as TestCaseResolutionStatus,
];

const mockPagingData: NextPreviousProps = {
  currentPage: 1,
  pageSize: 10,
  paging: { total: 25 },
  pagingHandler: jest.fn(),
  onShowSizeChange: jest.fn(),
} as unknown as NextPreviousProps;

const defaultProps: IncidentManagerTableProps = {
  isIncidentPage: true,
  testCaseListData: { data: mockRecords, isLoading: false },
  isPermissionLoading: false,
  testCasePermissions: [] as TestCasePermission[],
  showPagination: true,
  pagingData: mockPagingData,
  handleStatusSubmit: jest.fn(),
  handleSeveritySubmit: jest.fn(),
  handleAssigneeUpdate: jest.fn(),
};

const renderTable = (props: Partial<IncidentManagerTableProps> = {}) =>
  render(<IncidentManagerTable {...defaultProps} {...props} />);

describe('IncidentManagerTable', () => {
  it('should render the incident manager table', () => {
    renderTable();

    expect(
      screen.getByTestId('test-case-incident-manager-table')
    ).toBeInTheDocument();
  });

  it('should render a row for each resolution status record', () => {
    renderTable();

    expect(screen.getByTestId('test-case-test_case_1')).toBeInTheDocument();
    expect(screen.getByTestId('test-case-test_case_2')).toBeInTheDocument();
    expect(screen.getAllByText('TestCaseIncidentManagerStatus')).toHaveLength(
      mockRecords.length
    );
    expect(screen.getAllByText('Severity')).toHaveLength(mockRecords.length);
    expect(screen.getAllByTestId('assignee')).toHaveLength(mockRecords.length);
  });

  it('should show the empty-state placeholder when data is empty and not loading', () => {
    renderTable({
      testCaseListData: { data: [], isLoading: false },
    });

    expect(
      screen.getByTestId('filter-table-placeholder')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('test-case-test_case_1')
    ).not.toBeInTheDocument();
  });

  it('should show loading skeletons when data is loading', () => {
    renderTable({
      testCaseListData: {
        data: [] as TestCaseResolutionStatus[],
        isLoading: true,
      },
    });

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(
      screen.queryByTestId('filter-table-placeholder')
    ).not.toBeInTheDocument();
  });

  it('should render NextPrevious when showPagination is true', () => {
    renderTable({ showPagination: true });

    expect(screen.getByTestId('next-previous')).toBeInTheDocument();
  });

  it('should not render NextPrevious when showPagination is false', () => {
    renderTable({ showPagination: false });

    expect(screen.queryByTestId('next-previous')).not.toBeInTheDocument();
  });

  it('should render the table column when isIncidentPage is true', () => {
    renderTable({ isIncidentPage: true });

    expect(screen.getByText('label.table')).toBeInTheDocument();
    expect(screen.getAllByTestId('table-link')).toHaveLength(
      mockRecords.length
    );
  });

  it('should not render the table column when isIncidentPage is false', () => {
    renderTable({ isIncidentPage: false });

    expect(screen.queryByText('label.table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-link')).not.toBeInTheDocument();
  });
});

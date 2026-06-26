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
import { MemoryRouter } from 'react-router-dom';
import { TestSuite } from '../../../../generated/tests/testCase';
import { Paging } from '../../../../generated/type/paging';
import { DataQualitySubTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { TestSuitesTable } from './TestSuitesTable.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const SortContext = require('react').createContext<{
    sortDescriptor?: { column?: string; direction?: string };
    onSortChange?: (desc: {
      column?: string;
      direction?: 'ascending' | 'descending';
    }) => void;
  }>({});

  const MockTableHead = ({
    label,
    id,
    allowsSorting,
    isRowHeader,
  }: {
    label?: string;
    id?: string;
    allowsSorting?: boolean;
    isRowHeader?: boolean;
  }) => {
    const { onSortChange, sortDescriptor } =
      require('react').useContext(SortContext);
    const handleClick = () => {
      if (!allowsSorting || !onSortChange) {
        return;
      }
      const currentDir =
        sortDescriptor?.column === id ? sortDescriptor.direction : undefined;
      const newDir = currentDir === 'ascending' ? 'descending' : 'ascending';
      onSortChange({ column: id, direction: newDir });
    };

    return (
      <th
        data-row-header={isRowHeader ? 'true' : 'false'}
        id={id}
        onClick={handleClick}>
        {label}
      </th>
    );
  };

  const MockTable = ({
    children,
    'data-testid': testId,
    onSortChange,
    sortDescriptor,
  }: React.PropsWithChildren<{
    'data-testid'?: string;
    onSortChange?: (desc: {
      column?: string;
      direction?: 'ascending' | 'descending';
    }) => void;
    sortDescriptor?: { column?: string; direction?: string };
    [key: string]: unknown;
  }>) => (
    <SortContext.Provider value={{ sortDescriptor, onSortChange }}>
      <table data-testid={testId}>{children}</table>
    </SortContext.Provider>
  );

  MockTable.Header = ({
    columns,
    children,
  }: {
    columns: unknown[];
    children: (col: unknown) => React.ReactNode;
  }) => (
    <thead>
      <tr>{(columns || []).map((col) => children(col))}</tr>
    </thead>
  );

  MockTable.Head = MockTableHead;

  MockTable.Body = ({
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
      {items && items.length > 0
        ? items.map((item) => children(item))
        : renderEmptyState?.()}
    </tbody>
  );

  MockTable.Row = ({
    children,
    id,
  }: React.PropsWithChildren<{ id?: string }>) => <tr id={id}>{children}</tr>;

  MockTable.Cell = ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <td className={className}>{children}</td>
  );

  return {
    Table: MockTable,
  };
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => (
      <div {...rest}>{children}</div>
    )),
}));

jest.mock('../../../common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(() => <div data-testid="next-previous" />)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ type }) => (
      <div data-testid={`error-placeholder-type-${type}`} />
    )),
}));

jest.mock(
  '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => <div data-testid="filter-table-placeholder" />),
  })
);

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(() => <div data-testid="owner-label" />),
}));

jest.mock(
  '../../../Database/Profiler/TableProfiler/ProfilerProgressWidget/ProfilerProgressWidget',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div data-testid="profiler-progress-widget" />)
);

jest.mock('../../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getTestSuitePath: jest
      .fn()
      .mockImplementation((fqn: string) => `/test-suites/${fqn}`),
  },
}));

const columnList = [
  { id: 'name', name: 'label.name', allowsSorting: true },
  { id: 'tests', name: 'label.test-plural' },
  { id: 'success', name: 'label.success %', allowsSorting: true },
  { id: 'owners', name: 'label.owner-plural' },
];

const mockData: TestSuite[] = [
  {
    id: 'logical-id',
    name: 'svc.suite',
    fullyQualifiedName: 'svc.suite',
    basic: false,
    summary: { total: 10, success: 8 },
  } as TestSuite,
];

const mockPaging: Paging = { offset: 0, limit: 15, total: 1 };

const mockOnSortChange = jest.fn();
const mockPagingHandler = jest.fn();
const mockOnShowSizeChange = jest.fn();

const defaultProps = {
  columnList,
  data: mockData,
  isLoading: false,
  subTab: DataQualitySubTabs.TABLE_SUITES,
  hasActiveFilters: false,
  onSortChange: mockOnSortChange,
  currentPage: 1,
  pageSize: 15,
  paging: mockPaging,
  showPagination: true,
  pagingHandler: mockPagingHandler,
  onShowSizeChange: mockOnShowSizeChange,
};

const renderTable = (props = {}) =>
  render(<TestSuitesTable {...defaultProps} {...props} />, {
    wrapper: MemoryRouter,
  });

describe('TestSuitesTable component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table with all column headers', () => {
    renderTable();

    const headers = screen.getAllByRole('columnheader');

    expect(screen.getByTestId('test-suite-table')).toBeInTheDocument();
    expect(headers.map((h) => h.textContent)).toStrictEqual([
      'label.name',
      'label.test-plural',
      'label.success %',
      'label.owner-plural',
    ]);
  });

  it('should mark the name column as the row header', () => {
    renderTable();

    const nameHeader = screen.getByText('label.name');

    expect(nameHeader.getAttribute('data-row-header')).toBe('true');

    const testsHeader = screen.getByText('label.test-plural');

    expect(testsHeader.getAttribute('data-row-header')).toBe('false');
  });

  it('should render a row for each data item with name, tests, success and owner cells', () => {
    renderTable();

    expect(screen.getByTestId('svc.suite')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByTestId('profiler-progress-widget')).toBeInTheDocument();
    expect(screen.getByTestId('owner-label')).toBeInTheDocument();
  });

  it('should render the logical suite link via observabilityRouterClassBase', () => {
    renderTable();

    const link = screen.getByTestId('svc.suite');

    expect(link.getAttribute('to')).toBe('/test-suites/svc.suite');
  });

  it('should call onSortChange when a sortable header is clicked', () => {
    renderTable();

    fireEvent.click(screen.getByText('label.name'));

    expect(mockOnSortChange).toHaveBeenCalledWith({
      column: 'name',
      direction: 'ascending',
    });
  });

  it('should not call onSortChange for a non-sortable header', () => {
    renderTable();

    fireEvent.click(screen.getByText('label.test-plural'));

    expect(mockOnSortChange).not.toHaveBeenCalled();
  });

  it('should render FilterTablePlaceHolder when data is empty for table suites', () => {
    renderTable({ data: [] });

    expect(screen.getByTestId('filter-table-placeholder')).toBeInTheDocument();
  });

  it('should render create placeholder when empty bundle suites with no active filters', () => {
    renderTable({
      data: [],
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
      hasActiveFilters: false,
    });

    expect(
      screen.getByTestId('error-placeholder-type-CREATE')
    ).toBeInTheDocument();
  });

  it('should render FilterTablePlaceHolder for empty bundle suites when filters are active', () => {
    renderTable({
      data: [],
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
      hasActiveFilters: true,
    });

    expect(screen.getByTestId('filter-table-placeholder')).toBeInTheDocument();
  });

  it('should not render rows while loading', () => {
    renderTable({ isLoading: true });

    expect(screen.queryByTestId('svc.suite')).not.toBeInTheDocument();
  });

  it('should render pagination when showPagination is true', () => {
    renderTable();

    expect(screen.getByTestId('next-previous')).toBeInTheDocument();
  });

  it('should not render pagination when showPagination is false', () => {
    renderTable({ showPagination: false });

    expect(screen.queryByTestId('next-previous')).not.toBeInTheDocument();
  });

  it('should render basic test suite link to the table profiler path', () => {
    const basicData = [
      {
        id: 'basic-id',
        name: 'basic.suite',
        basic: true,
        basicEntityReference: {
          fullyQualifiedName: 'svc.db.schema.table',
          name: 'table',
        },
        summary: { total: 5, success: 5 },
      } as TestSuite,
    ];

    renderTable({ data: basicData });

    const link = screen.getByTestId('basic.suite');

    expect(link).toBeInTheDocument();
    expect(link.textContent).toBe('svc.db.schema.table');
  });

  it('should fall back to name/zero when fqn, id and summary are missing', () => {
    const edgeData = [
      {
        name: 'basic-no-fqn',
        basic: true,
        basicEntityReference: { name: 'entity-name' },
      } as TestSuite,
      {
        id: 'logical-no-fqn-id',
        name: 'logical-no-fqn',
        basic: false,
        summary: { total: 5 },
      } as TestSuite,
    ];

    renderTable({ data: edgeData });

    // basic suite without fqn falls back to the entity reference name
    expect(screen.getByTestId('basic-no-fqn').textContent).toBe('entity-name');
    // logical suite without fqn falls back to its name in the route
    expect(screen.getByTestId('logical-no-fqn')).toHaveAttribute(
      'to',
      '/test-suites/logical-no-fqn'
    );
    // summary without success still renders the progress widget (0%)
    expect(screen.getAllByTestId('profiler-progress-widget')).toHaveLength(2);
  });
});

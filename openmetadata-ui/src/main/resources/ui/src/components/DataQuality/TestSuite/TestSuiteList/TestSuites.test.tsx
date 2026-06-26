/*
 *  Copyright 2023 Collate.
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
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestSuitesBySearch } from '../../../../rest/testAPI';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { TestSuites } from './TestSuites.component';

const testSuitePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

const mockLocation = {
  search: '',
};

const mockList = {
  data: [
    {
      id: 'id',
      name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.testSuite',
      description: 'This is an basic test suite linked to an entity',
      serviceType: 'TestSuite',
      href: 'href',
      deleted: false,
      basic: true,
      basicEntityReference: {
        id: 'id1',
        type: 'table',
        name: 'dim_address',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
      },
      testCaseResultSummary: [],
    },
  ],
  paging: {
    offset: 0,
    limit: 15,
    total: 1,
  },
};

jest.mock('@openmetadata/ui-core-components', () => {
  const { createContext } = require('react') as typeof import('react');
  const SortContext = createContext<{
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
  }: {
    label?: string;
    id?: string;
    allowsSorting?: boolean;
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
      <th id={id} onClick={handleClick}>
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

  const cloneWith = (children: React.ReactNode, props: object) =>
    require('react').Children.map(children, (child: React.ReactNode) =>
      require('react').isValidElement(child)
        ? require('react').cloneElement(child, props)
        : child
    );

  const MockTabs = ({
    children,
    onSelectionChange,
    selectedKey,
  }: React.PropsWithChildren<{
    onSelectionChange?: (key: string | number) => void;
    selectedKey?: string | number;
  }>) => (
    <div data-selected-key={selectedKey} data-testid="sub-tabs">
      {cloneWith(children, { onSelectionChange })}
    </div>
  );
  MockTabs.List = ({
    children,
    onSelectionChange,
  }: React.PropsWithChildren<{
    onSelectionChange?: (key: string | number) => void;
  }>) => (
    <div data-testid="sub-tabs-list">
      {cloneWith(children, { onSelectionChange })}
    </div>
  );
  MockTabs.Item = ({
    children,
    id,
    'data-testid': testId,
    onSelectionChange,
  }: React.PropsWithChildren<{
    id?: string;
    'data-testid'?: string;
    onSelectionChange?: (key: string | number) => void;
  }>) => (
    <button
      data-id={id}
      data-testid={testId}
      onClick={() => id !== undefined && onSelectionChange?.(id)}>
      {children}
    </button>
  );

  const MockBox = ({
    children,
    className,
    'data-testid': testId,
  }: React.PropsWithChildren<{
    className?: string;
    'data-testid'?: string;
  }>) => (
    <div className={className} data-testid={testId}>
      {children}
    </div>
  );

  const MockInput = ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

  return {
    Box: MockBox,
    Input: MockInput,
    Tabs: MockTabs,
    Table: MockTable,
  };
});

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testSuite: testSuitePermission,
    },
  })),
}));

jest.mock('../../../../rest/testAPI', () => {
  return {
    ...jest.requireActual('../../../../rest/testAPI'),
    getListTestSuitesBySearch: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockList)),
  };
});

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ ...mockLocation }));
});

jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    Link: jest
      .fn()
      .mockImplementation(({ children, ...rest }) => (
        <div {...rest}>{children}</div>
      )),
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    useParams: jest.fn().mockReturnValue({
      tab: 'test-cases',
      subTab: 'table-suites',
    }),
  };
});

jest.mock('../../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});

jest.mock('../../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getDataQualityPagePath: jest
      .fn()
      .mockImplementation(
        (tab: string, subTab: string) => `/data-quality/${tab}/${subTab}`
      ),
    getTestSuitePath: jest
      .fn()
      .mockImplementation((fqn: string) => `/test-suites/${fqn}`),
  },
}));

const mockDataQualityContext = {
  isTestCaseSummaryLoading: false,
  testCaseSummary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
  activeTab: DataQualityPageTabs.TEST_CASES,
};

jest.mock('../../../../pages/DataQuality/DataQualityProvider', () => {
  return {
    useDataQualityProvider: jest
      .fn()
      .mockImplementation(() => mockDataQualityContext),
  };
});

jest.mock(
  '../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

jest.mock('@untitledui/icons', () => ({
  SearchLg: () => <span data-testid="search-icon" />,
}));

jest.mock('../../SummaryPannel/PieChartSummaryPanel.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>SummaryPanel.component</div>),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ type }) => (
      <div data-testid={`error-placeholder-type-${type}`}>
        ErrorPlaceHolder.component
      </div>
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

describe('TestSuites component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testSuitePermission.ViewAll = true;
    mockLocation.search = '';
  });

  it('component should render', async () => {
    render(<TestSuites />);
    const tableHeader = await screen.findAllByRole('columnheader');
    const labels = tableHeader.map((header) => header.textContent);

    expect(tableHeader).toHaveLength(4);
    expect(labels).toStrictEqual([
      'label.name',
      'label.test-plural',
      'label.success %',
      'label.owner-plural',
    ]);
    expect(await screen.findByTestId('test-suite-table')).toBeInTheDocument();
    expect(
      await screen.findByTestId('owner-select-filter')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('searchbar-component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('SummaryPanel.component')
    ).toBeInTheDocument();
  });

  it('should send testSuiteType basic in api, if active tab is tables', async () => {
    const mockGetListTestSuites = getListTestSuitesBySearch as jest.Mock;

    render(<TestSuites />);

    expect(
      await screen.findByTestId('test-suite-container')
    ).toBeInTheDocument();
    expect(mockGetListTestSuites).toHaveBeenCalledWith({
      fields: ['owners', 'summary'],
      includeEmptyTestSuites: false,
      limit: 15,
      offset: 0,
      owner: undefined,
      q: undefined,
      sortField: 'lastResultTimestamp',
      sortType: 'desc',
      testSuiteType: 'basic',
    });
  });

  it('filters API call should be made, if owner is selected', async () => {
    mockLocation.search =
      '?owner={"id":"84c3e66f-a4a6-42ab-b85c-b578f46d3bca","type":"user","name":"admin","fullyQualifiedName":"admin"}&searchValue=sales';
    const mockGetListTestSuites = getListTestSuitesBySearch as jest.Mock;

    render(<TestSuites />, { wrapper: MemoryRouter });

    expect(mockGetListTestSuites).toHaveBeenCalledWith({
      fields: ['owners', 'summary'],
      includeEmptyTestSuites: false,
      limit: 15,
      offset: 0,
      owner: 'admin',
      q: '*sales*',
      sortField: 'lastResultTimestamp',
      sortType: 'desc',
      testSuiteType: 'basic',
    });
  });

  it('pagination should visible if total is greater than 15', async () => {
    (getListTestSuitesBySearch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 16 } })
    );

    render(<TestSuites />);

    expect(
      await screen.findByText('NextPrevious.component')
    ).toBeInTheDocument();
  });

  it('should render the sub-tab toggle with table and bundle suite options', async () => {
    render(<TestSuites />, { wrapper: MemoryRouter });

    expect(await screen.findByTestId('sub-tabs')).toBeInTheDocument();
    expect(
      await screen.findByTestId('table-suite-radio-btn')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('bundle-suite-radio-btn')
    ).toBeInTheDocument();
  });

  it('should navigate to bundle-suites path when bundle suite button is clicked', async () => {
    render(<TestSuites />, { wrapper: MemoryRouter });

    const mockNavigate = (useNavigate as jest.Mock).mock.results[0].value;
    const bundleBtn = await screen.findByTestId('bundle-suite-radio-btn');

    await act(async () => {
      fireEvent.click(bundleBtn);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/data-quality/test-cases/bundle-suites'
    );
  });

  it('should navigate to table-suites path when table suite button is clicked', async () => {
    render(<TestSuites />, { wrapper: MemoryRouter });

    const mockNavigate = (useNavigate as jest.Mock).mock.results[0].value;
    const tableBtn = await screen.findByTestId('table-suite-radio-btn');

    await act(async () => {
      fireEvent.click(tableBtn);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/data-quality/test-cases/table-suites'
    );
  });

  it('should send testSuiteType basic by default', async () => {
    const mockGetListTestSuites = getListTestSuitesBySearch as jest.Mock;

    render(<TestSuites />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId('test-suite-container')
    ).toBeInTheDocument();
    expect(mockGetListTestSuites).toHaveBeenCalledWith({
      fields: ['owners', 'summary'],
      includeEmptyTestSuites: false,
      limit: 15,
      offset: 0,
      owner: undefined,
      q: undefined,
      sortField: 'lastResultTimestamp',
      sortType: 'desc',
      testSuiteType: 'basic',
    });
  });

  it('should render no data placeholder, if there is no permission', async () => {
    testSuitePermission.ViewAll = false;

    render(<TestSuites />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId('error-placeholder-type-PERMISSION')
    ).toBeInTheDocument();
  });

  it('should render table rows with name, tests, success and owner cells', async () => {
    await act(async () => {
      render(<TestSuites />);
    });

    expect(
      await screen.findByTestId('profiler-progress-widget')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('owner-label')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');

    expect(rows.length).toBeGreaterThan(1);
  });

  it('should render empty placeholder when no test suites are returned', async () => {
    (getListTestSuitesBySearch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 0 } })
    );

    render(<TestSuites />);

    expect(
      await screen.findByTestId('filter-table-placeholder')
    ).toBeInTheDocument();
  });

  it('should not render pagination when showPagination is false', async () => {
    (getListTestSuitesBySearch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 5 } })
    );

    render(<TestSuites />);

    await screen.findByTestId('test-suite-container');

    expect(
      screen.queryByText('NextPrevious.component')
    ).not.toBeInTheDocument();
  });

  describe('observabilityRouterClassBase migration', () => {
    it('logical test suite name link should use observabilityRouterClassBase.getTestSuitePath', async () => {
      // Restore permission for this test
      testSuitePermission.ViewAll = true;
      mockLocation.search = '';

      const logicalSuiteName = 'svc.suite';
      (getListTestSuitesBySearch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          data: [
            {
              id: 'logical-id',
              name: logicalSuiteName,
              fullyQualifiedName: logicalSuiteName,
              description: 'logical suite',
              serviceType: 'TestSuite',
              href: 'href',
              deleted: false,
              basic: false,
              testCaseResultSummary: [],
            },
          ],
          paging: { offset: 0, limit: 15, total: 1 },
        })
      );

      render(<TestSuites />, { wrapper: MemoryRouter });

      const link = await screen.findByTestId(logicalSuiteName);

      expect(link.getAttribute('to')).toBe(
        observabilityRouterClassBase.getTestSuitePath(logicalSuiteName)
      );
      expect(link.getAttribute('to')).toBe(`/test-suites/${logicalSuiteName}`);
    });
  });
});

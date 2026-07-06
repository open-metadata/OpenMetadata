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
import { ReactNode } from 'react';
import { MemoryRouter, useNavigate, useParams } from 'react-router-dom';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestSuitesBySearch } from '../../../../rest/testAPI';
import {
  getDataQualityPagePath,
  getTestSuitePath,
} from '../../../../utils/RouterUtils';
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

type MockTableRecord = Record<string, unknown> & {
  id?: string;
  name?: string;
};

type MockTableColumn = {
  dataIndex: string;
  key?: string;
  render?: (
    value: unknown,
    record: MockTableRecord,
    index: number
  ) => ReactNode;
  title: ReactNode;
};

type MockTableProps = {
  columns: MockTableColumn[];
  customPaginationProps?: {
    showPagination?: boolean;
  };
  dataSource: MockTableRecord[];
  loading?: boolean;
  locale?: {
    emptyText?: ReactNode;
  };
  'data-testid'?: string;
};

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
jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(
    (entity) =>
      entity?.displayName ?? entity?.fullyQualifiedName ?? entity?.name
  ),
}));
jest.mock('../../../../utils/formUtils', () => ({
  getPopupContainer: jest.fn(),
}));
jest.mock('../../../../utils/RouterUtils', () => ({
  getDataQualityPagePath: jest.fn(
    (tab: string, subTab?: string) =>
      `/data-quality/${tab}${subTab ? `/${subTab}` : ''}`
  ),
  getEntityDetailsPath: jest.fn(
    (entityType: string, fqn: string, tab?: string, subTab?: string) =>
      `/${entityType}/${fqn}${tab ? `/${tab}` : ''}${
        subTab ? `/${subTab}` : ''
      }`
  ),
  getTestSuitePath: jest.fn((fqn: string) => `/test-suites/${fqn}`),
}));
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
jest.mock('../../../common/Table/Table', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      ({
        columns,
        customPaginationProps,
        dataSource,
        loading,
        locale,
        ...rest
      }: MockTableProps) => (
        <div>
          <table data-testid={rest['data-testid']}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key ?? column.dataIndex}>{column.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div data-testid="test-suite-table-loader">Loading</div>
                  </td>
                </tr>
              ) : dataSource.length ? (
                dataSource.map((record, index) => (
                  <tr key={record.id ?? record.name}>
                    {columns.map((column) => (
                      <td key={column.key ?? column.dataIndex}>
                        {column.render
                          ? column.render(
                              record[column.dataIndex],
                              record,
                              index
                            )
                          : (record[column.dataIndex] as ReactNode)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>{locale?.emptyText}</td>
                </tr>
              )}
            </tbody>
          </table>
          {customPaginationProps?.showPagination && (
            <div>NextPrevious.component</div>
          )}
        </div>
      )
    ),
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
jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>SearchBar.component</div>),
}));
jest.mock('../../SummaryPannel/PieChartSummaryPanel.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>SummaryPanel.component</div>),
}));
jest.mock(
  '../../../Database/Profiler/TableProfiler/ProfilerProgressWidget/ProfilerProgressWidget',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div data-testid="profiler-progress-widget" />)
);
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

jest.mock('../../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([
    {
      title: 'label.owner-plural',
      dataIndex: 'owners',
      key: 'owners',
      width: 180,
      render: () => <div>OwnerLabel</div>,
    },
  ]),
  descriptionTableObject: jest.fn().mockReturnValue([]),
}));

describe('TestSuites component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testSuitePermission.ViewAll = true;
    mockLocation.search = '';
    (useParams as jest.Mock).mockReturnValue({
      tab: 'test-cases',
      subTab: 'table-suites',
    });
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
    expect(await screen.findByText('SearchBar.component')).toBeInTheDocument();
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

    expect(
      await screen.findByTestId('test-suite-container')
    ).toBeInTheDocument();
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

  it('pagination should visible if total is grater than 15', async () => {
    (getListTestSuitesBySearch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 16 } })
    );

    render(<TestSuites />);

    expect(
      await screen.findByText('NextPrevious.component')
    ).toBeInTheDocument();
  });

  // TestSuite type test
  it('should render radio buttons for table and bundle suites', async () => {
    render(<TestSuites />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId('table-suite-radio-btn')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('bundle-suite-radio-btn')
    ).toBeInTheDocument();
  });

  it('should send testSuiteType basic by default', async () => {
    mockLocation.search = '';
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

  it('should render table loader while test suites are loading', async () => {
    (getListTestSuitesBySearch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    render(<TestSuites />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId('test-suite-table-loader')
    ).toBeInTheDocument();
  });

  it('should navigate to suite type path when suite type changes', async () => {
    render(<TestSuites />, { wrapper: MemoryRouter });

    const mockNavigate = (useNavigate as jest.Mock).mock.results[0].value;

    fireEvent.click(await screen.findByTestId('bundle-suite-radio-btn'));

    expect(mockNavigate).toHaveBeenCalledWith(
      getDataQualityPagePath(
        DataQualityPageTabs.TEST_CASES,
        DataQualitySubTabs.BUNDLE_SUITES
      )
    );
  });

  it('should ignore stale table suite response after switching to bundle suites', async () => {
    let resolveTableSuites!: (value: typeof mockList) => void;
    let resolveBundleSuites!: (value: typeof mockList) => void;
    const tableSuitesResponse = new Promise<typeof mockList>((resolve) => {
      resolveTableSuites = resolve;
    });
    const bundleSuitesResponse = new Promise<typeof mockList>((resolve) => {
      resolveBundleSuites = resolve;
    });
    const bundleSuiteName = 'bundle.suite';

    (getListTestSuitesBySearch as jest.Mock)
      .mockImplementationOnce(() => tableSuitesResponse)
      .mockImplementationOnce(() => bundleSuitesResponse);

    const { rerender } = render(<TestSuites />);

    (useParams as jest.Mock).mockReturnValue({
      tab: DataQualityPageTabs.TEST_CASES,
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
    });

    rerender(<TestSuites />);

    await act(async () => {
      resolveBundleSuites({
        data: [
          {
            id: 'bundle-id',
            name: bundleSuiteName,
            fullyQualifiedName: bundleSuiteName,
            description: 'logical suite',
            serviceType: 'TestSuite',
            href: 'href',
            deleted: false,
            basic: false,
            basicEntityReference: {
              id: 'id1',
              type: 'table',
              name: 'dim_address',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address',
            },
            testCaseResultSummary: [],
          },
        ],
        paging: {
          offset: 0,
          limit: 15,
          total: 1,
        },
      });
    });

    expect(await screen.findByTestId(bundleSuiteName)).toBeInTheDocument();

    await act(async () => {
      resolveTableSuites(mockList);
    });

    expect(screen.getByTestId(bundleSuiteName)).toBeInTheDocument();
    expect(
      screen.queryByTestId(
        'sample_data.ecommerce_db.shopify.dim_address.testSuite'
      )
    ).not.toBeInTheDocument();
  });

  it('logical test suite link should use test suite route path', async () => {
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

    expect(link.getAttribute('to')).toBe(getTestSuitePath(logicalSuiteName));
  });
});

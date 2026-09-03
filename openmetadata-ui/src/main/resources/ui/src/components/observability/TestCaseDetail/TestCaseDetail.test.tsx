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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import TestCaseDetail from './TestCaseDetail';

const INCIDENT_MANAGER_PAGE_HEADER_TEST_ID = 'incident-manager-page-header';
const HEADER_BREADCRUMB_TEST_ID = 'header-breadcrumb';
const BREADCRUMB_COUNT_ATTR = 'data-item-count';
const BREADCRUMB_LABELS_ATTR = 'data-labels';
const BREADCRUMB_HREFS_ATTR = 'data-hrefs';
const ASSET_TRAIL_LABELS = '|service|db|schema|table|test_case_name';
const mockUseTestCaseDetailPage = jest.fn();
const mockUseTestCaseIncidentHeader = jest.fn();
const mockNavigate = jest.fn();
const mockHandleTabChange = jest.fn();
const mockOnVersionClick = jest.fn();
const mockToggleTabExpanded = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

const mockUseCustomLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => mockUseCustomLocation(),
}));

jest.mock(
  'pages/IncidentManager/IncidentManagerDetailPage/useTestCaseDetailPage',
  () => ({
    useTestCaseDetailPage: (props: any) => mockUseTestCaseDetailPage(props),
  })
);

jest.mock(
  'components/DataQuality/IncidentManager/IncidentManagerPageHeader/useTestCaseIncidentHeader',
  () => ({
    useTestCaseIncidentHeader: (props: any) =>
      mockUseTestCaseIncidentHeader(props),
  })
);

jest.mock('components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: (Component: any) => Component,
}));

jest.mock('components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => (
    <div data-testid="page-layout-v1">{children}</div>
  ),
}));

jest.mock('components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">Loader</div>,
}));

jest.mock('components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: ({ type }: { type?: string }) => (
    <div data-testid="error-placeholder" data-type={type ?? 'default'}>
      error-placeholder
    </div>
  ),
}));

jest.mock(
  'components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => ({
    __esModule: true,
    default: ({ items }: any) => (
      <div
        data-first-item-icon={String(Boolean(items[0]?.icon))}
        data-hrefs={items.map((item: any) => item.href ?? '').join('|')}
        data-item-count={items.length}
        data-labels={items.map((item: any) => item.label ?? '').join('|')}
        data-testid={HEADER_BREADCRUMB_TEST_ID}>
        breadcrumb
      </div>
    ),
  })
);

jest.mock('hooks/useClipBoard', () => ({
  useClipboard: () => ({
    onCopyToClipBoard: jest.fn(),
    hasCopied: false,
  }),
}));

jest.mock(
  'components/DataQuality/IncidentManager/IncidentManagerPageHeader/IncidentManagerPageHeader.component',
  () => ({
    __esModule: true,
    default: ({ incidentHeaderData, isVersionPage }: any) => (
      <div
        data-is-version-page={String(isVersionPage)}
        data-test-case-name={incidentHeaderData?.testCaseData?.name}
        data-testid={INCIDENT_MANAGER_PAGE_HEADER_TEST_ID}>
        incident-manager-page-header
      </div>
    ),
  })
);

jest.mock(
  'components/common/EntityPageInfos/ManageButton/ManageButton',
  () => ({
    __esModule: true,
    default: () => <div data-testid="manage-button">manage-button</div>,
  })
);

jest.mock(
  'components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () => ({
    __esModule: true,
    default: () => (
      <div data-testid="entity-version-timeline">version-timeline</div>
    ),
  })
);

jest.mock(
  'components/DataQuality/AddDataQualityTest/components/TestCaseFormDrawer',
  () => ({
    __esModule: true,
    default: ({ open, variant }: { open?: boolean; variant?: string }) => (
      <div
        data-open={String(open)}
        data-testid="test-case-form-drawer"
        data-variant={variant}>
        test-case-form-drawer
      </div>
    ),
  })
);

jest.mock('components/common/Badge/Badge.component', () => ({
  BetaBadge: () => <span data-testid="beta-badge">beta</span>,
}));

jest.mock('components/common/IconButtons/EditIconButton', () => ({
  AlignRightIconButton: ({
    onClick,
  }: {
    onClick?: (...args: unknown[]) => void;
  }) => (
    <button
      aria-label="expand-collapse-button"
      data-testid="expand-collapse-button"
      onClick={onClick}
    />
  ),
}));

jest.mock('utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getDataQualityPagePath: jest.fn().mockReturnValue('/dq-path'),
    getTestCaseDetailPagePath: jest.fn().mockReturnValue('/test-case-path'),
  },
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test Case Display Name'),
}));

const MockResultTab = jest.fn(({ showSidePanel }: any) => (
  <div
    data-show-side-panel={String(showSidePanel)}
    data-testid="result-tab-body">
    result-tab
  </div>
));

const MockIncidentTab = jest.fn(() => (
  <div data-testid="incident-tab-body">incident-tab</div>
));

const MockTabLabel = ({ name }: { name?: string }) => <span>{name}</span>;

const baseHookReturn = {
  testCase: {
    id: 'test-case-id',
    name: 'test_case_name',
    displayName: 'Test Case Display Name',
    fullyQualifiedName: 'service.db.schema.table.test_case_name',
    version: 0.2,
    entityLink: '<#E::table::service.db.schema.table>',
  },
  isLoading: false,
  hasViewPermission: true,
  hasDeletePermission: true,
  editDisplayNamePermission: true,
  displayName: 'Test Case Display Name',
  tabs: [
    {
      key: 'test-case-results',
      labelProps: { id: 'test-case-result', name: 'Test Case Results' },
      LabelComponent: MockTabLabel,
      Tab: MockResultTab,
    },
    {
      key: 'issues',
      labelProps: { id: 'incident', name: 'Incidents', count: 2 },
      LabelComponent: MockTabLabel,
      Tab: MockIncidentTab,
    },
  ],
  activeTab: 'test-case-results',
  handleTabChange: mockHandleTabChange,
  isExpandViewSupported: true,
  isTabExpanded: true,
  toggleTabExpanded: mockToggleTabExpanded,
  version: undefined,
  versionList: { entityType: 'testCase', versions: [] },
  versionHandler: jest.fn(),
  onVersionClick: mockOnVersionClick,
  isDimensionPage: false,
  dimensionKey: undefined,
  isDimensionEdit: false,
  handleCancelDimension: jest.fn(),
  extraDropdownContent: [],
  handleOwnerChange: jest.fn(),
  handleDisplayNameChange: jest.fn(),
  getEntityFeedCount: jest.fn(),
  setTestCase: jest.fn(),
};

const baseIncidentHeaderData = {
  testCaseData: baseHookReturn.testCase,
};

describe('TestCaseDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTestCaseDetailPage.mockReturnValue(baseHookReturn);
    mockUseTestCaseIncidentHeader.mockReturnValue(baseIncidentHeaderData);
    mockUseCustomLocation.mockReturnValue({ state: undefined });
  });

  it('should render the breadcrumb, title row, details row, tabs and active tab body', () => {
    render(<TestCaseDetail />);

    expect(screen.getByTestId('observability-page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('test-case-detail-page')).toBeInTheDocument();
    expect(screen.getByTestId(HEADER_BREADCRUMB_TEST_ID)).toHaveAttribute(
      'data-first-item-icon',
      'true'
    );

    expect(screen.getByTestId('entity-header-title')).toBeInTheDocument();
    expect(screen.getByTestId('entity-header-name')).toHaveTextContent(
      'test_case_name'
    );
    expect(screen.getByTestId('entity-header-display-name')).toHaveTextContent(
      'Test Case Display Name'
    );
    expect(
      screen.getByTestId(INCIDENT_MANAGER_PAGE_HEADER_TEST_ID)
    ).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('result-tab-body')).toBeInTheDocument();
  });

  it('should provide the shared incident data to the details header', () => {
    render(<TestCaseDetail />);

    expect(mockUseTestCaseIncidentHeader).toHaveBeenCalledWith({
      fetchTaskCount: baseHookReturn.getEntityFeedCount,
      isVersionPage: false,
    });
    expect(
      screen.getByTestId(INCIDENT_MANAGER_PAGE_HEADER_TEST_ID)
    ).toHaveAttribute('data-test-case-name', baseHookReturn.testCase.name);
  });

  it('should pass the expand state down to the tab body as showSidePanel', () => {
    render(<TestCaseDetail />);

    expect(screen.getByTestId('result-tab-body')).toHaveAttribute(
      'data-show-side-panel',
      'true'
    );
  });

  it('should call toggleTabExpanded from the expand/collapse button', () => {
    render(<TestCaseDetail />);

    fireEvent.click(screen.getByTestId('expand-collapse-button'));

    expect(mockToggleTabExpanded).toHaveBeenCalled();
  });

  it('should call handleTabChange when another tab is clicked', () => {
    render(<TestCaseDetail />);

    fireEvent.click(screen.getByText('Incidents'));

    expect(mockHandleTabChange).toHaveBeenCalledWith('issues');
  });

  it('should build the compact asset hierarchy from the test case entity link', () => {
    render(<TestCaseDetail />);

    // module icon + service/database/schema/table + test case name
    expect(screen.getByTestId(HEADER_BREADCRUMB_TEST_ID)).toHaveAttribute(
      BREADCRUMB_COUNT_ATTR,
      '6'
    );
  });

  it('should fall back to the data quality crumb when the entity link is missing', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      testCase: { ...baseHookReturn.testCase, entityLink: undefined },
    });

    render(<TestCaseDetail />);

    // module icon + data quality + test case name
    expect(screen.getByTestId(HEADER_BREADCRUMB_TEST_ID)).toHaveAttribute(
      BREADCRUMB_COUNT_ATTR,
      '3'
    );
  });

  describe('origin breadcrumb', () => {
    const renderWithOrigin = (breadcrumbData: unknown) => {
      mockUseCustomLocation.mockReturnValue({ state: { breadcrumbData } });

      render(<TestCaseDetail />);

      return screen.getByTestId(HEADER_BREADCRUMB_TEST_ID);
    };

    it('should lead with the Incident Manager crumb when navigated from the incident listing', () => {
      const breadcrumb = renderWithOrigin([
        { name: 'Incident Manager', url: '/incident-manager' },
      ]);

      // module icon + Incident Manager + test case name
      expect(breadcrumb).toHaveAttribute(BREADCRUMB_COUNT_ATTR, '3');
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_LABELS_ATTR,
        '|Incident Manager|test_case_name'
      );
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_HREFS_ATTR,
        '/observability|/incident-manager|'
      );
    });

    it('should lead with the Data Quality crumb when navigated from the test cases tab', () => {
      const breadcrumb = renderWithOrigin([
        { name: 'Data Quality', url: '/data-quality/test-cases' },
      ]);

      expect(breadcrumb).toHaveAttribute(BREADCRUMB_COUNT_ATTR, '3');
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_LABELS_ATTR,
        '|Data Quality|test_case_name'
      );
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_HREFS_ATTR,
        '/observability|/data-quality/test-cases|'
      );
    });

    it('should keep the whole suite trail when navigated from a bundle suite', () => {
      const breadcrumb = renderWithOrigin([
        { name: 'Data Quality', url: '/data-quality/test-suites' },
        { name: 'critical_suite', url: '/test-suites/critical_suite' },
      ]);

      // module icon + Data Quality + critical_suite + test case name
      expect(breadcrumb).toHaveAttribute(BREADCRUMB_COUNT_ATTR, '4');
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_LABELS_ATTR,
        '|Data Quality|critical_suite|test_case_name'
      );
    });

    it('should fall back to the asset trail when the navigation state is null', () => {
      mockUseCustomLocation.mockReturnValue({ state: null });

      render(<TestCaseDetail />);

      // module icon + service/database/schema/table + test case name
      expect(screen.getByTestId(HEADER_BREADCRUMB_TEST_ID)).toHaveAttribute(
        BREADCRUMB_LABELS_ATTR,
        ASSET_TRAIL_LABELS
      );
    });

    it('should fall back to the asset trail when the origin trail is empty', () => {
      const breadcrumb = renderWithOrigin([]);

      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_LABELS_ATTR,
        ASSET_TRAIL_LABELS
      );
    });

    it('should append the test case and dimension crumbs after the origin trail', () => {
      mockUseTestCaseDetailPage.mockReturnValue({
        ...baseHookReturn,
        isDimensionPage: true,
        dimensionKey: 'completeness',
      });

      const breadcrumb = renderWithOrigin([
        { name: 'Incident Manager', url: '/incident-manager' },
      ]);

      // module icon + Incident Manager + test case name + dimension
      expect(breadcrumb).toHaveAttribute(BREADCRUMB_COUNT_ATTR, '4');
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_LABELS_ATTR,
        '|Incident Manager|test_case_name|completeness'
      );
      expect(breadcrumb).toHaveAttribute(
        BREADCRUMB_HREFS_ATTR,
        '/observability|/incident-manager|/test-case-path|'
      );
    });
  });

  it('should render the OSS incident tab body on the incident tab', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      activeTab: 'issues',
    });

    render(<TestCaseDetail />);

    expect(screen.getByTestId('incident-tab-body')).toBeInTheDocument();
    expect(screen.queryByTestId('result-tab-body')).not.toBeInTheDocument();
  });

  it('should render the loader while loading', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      isLoading: true,
    });

    render(<TestCaseDetail />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('test-case-detail-page')
    ).not.toBeInTheDocument();
  });

  it('should render the permission placeholder without view permission', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      hasViewPermission: false,
    });

    render(<TestCaseDetail />);

    expect(screen.getByTestId('error-placeholder')).toHaveAttribute(
      'data-type',
      'PERMISSION'
    );
  });

  it('should render the no-data placeholder without a test case', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      testCase: undefined,
    });

    render(<TestCaseDetail />);

    expect(screen.getByTestId('error-placeholder')).toHaveAttribute(
      'data-type',
      'default'
    );
  });

  it('should render the version button and manage button on detail pages', () => {
    render(<TestCaseDetail />);

    expect(screen.getByTestId('version-button')).toBeInTheDocument();
    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('entity-version-timeline')
    ).not.toBeInTheDocument();
  });

  it('should navigate to the version page from the version button', () => {
    render(<TestCaseDetail />);

    fireEvent.click(screen.getByTestId('version-button'));

    expect(mockOnVersionClick).toHaveBeenCalled();
  });

  it('should render the version timeline and hide the manage button on version pages', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      version: '0.2',
    });

    render(<TestCaseDetail isVersionPage />);

    expect(mockUseTestCaseDetailPage).toHaveBeenCalledWith({
      isVersionPage: true,
    });
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('should hide the version button on dimension pages', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      isDimensionPage: true,
      dimensionKey: 'completeness',
    });

    render(<TestCaseDetail />);

    expect(screen.queryByTestId('version-button')).not.toBeInTheDocument();
  });

  it('should render the test case form drawer in modal variant while editing dimensions', () => {
    mockUseTestCaseDetailPage.mockReturnValue({
      ...baseHookReturn,
      isDimensionEdit: true,
    });

    render(<TestCaseDetail />);

    const drawer = screen.getByTestId('test-case-form-drawer');

    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute('data-open', 'true');
    expect(drawer).toHaveAttribute('data-variant', 'modal');
  });
});

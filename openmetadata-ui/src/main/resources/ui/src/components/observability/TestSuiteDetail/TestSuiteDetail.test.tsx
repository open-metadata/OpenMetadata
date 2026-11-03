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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import TestSuiteDetail from './TestSuiteDetail';

const mockUseTestSuiteDetailsPage = jest.fn();
const mockNavigate = jest.fn();
const mockSetActiveTab = jest.fn();
const mockHandleTestCaseSearch = jest.fn();
const mockDataQualityTab = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('pages/TestSuiteDetailsPage/useTestSuiteDetailsPage', () => ({
  useTestSuiteDetailsPage: () => mockUseTestSuiteDetailsPage(),
}));

jest.mock('components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => (
    <div data-testid="page-layout-v1">{children}</div>
  ),
}));

jest.mock('components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">Loader</div>,
}));

jest.mock(
  'components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => ({
    __esModule: true,
    default: ({ items }: any) => (
      <div
        data-first-item-icon={String(Boolean(items[0]?.icon))}
        data-item-count={items.length}
        data-testid="header-breadcrumb">
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
  'components/common/EntityPageInfos/ManageButton/ManageButton',
  () => ({
    __esModule: true,
    default: () => <div data-testid="manage-button">manage-button</div>,
  })
);

jest.mock('components/common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: () => <div data-testid="domain-label">domain-label</div>,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const TabsCtx = React.createContext<((key: string) => void) | undefined>(
    undefined
  );

  const Box = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const Button = ({ children, onPress, onClick, ...props }: any) => (
    <button onClick={onPress ?? onClick} {...props}>
      {children}
    </button>
  );
  const Dialog = Object.assign(
    ({ children }: any) => <div role="dialog">{children}</div>,
    { Content: ({ children }: any) => <div>{children}</div> }
  );
  const DialogTrigger = ({ children }: any) => <div>{children}</div>;
  const CloseButton = ({ label, onPress }: any) => (
    <button aria-label={label} onClick={onPress} />
  );
  const Input = ({
    'aria-label': ariaLabel,
    inputDataTestId,
    onChange,
    placeholder,
    trailingSlot,
    value,
  }: any) => (
    <>
      <input
        aria-label={ariaLabel}
        data-testid={inputDataTestId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {trailingSlot}
    </>
  );
  const Modal = ({ children }: any) => <div>{children}</div>;
  const ModalOverlay = ({ children }: any) => <div>{children}</div>;
  const Owner = () => <div data-testid="owner-label">owner-label</div>;
  const TabsList = ({ children }: any) => <div role="tablist">{children}</div>;
  const TabsItem = ({ children, id, label }: any) => {
    const onSelectionChange = React.useContext(TabsCtx);

    return (
      <button role="tab" onClick={() => onSelectionChange?.(id)}>
        {label ?? children}
      </button>
    );
  };
  const TabsPanel = ({ children }: any) => (
    <div role="tabpanel">{children}</div>
  );
  const Tabs = Object.assign(
    ({ children, onSelectionChange, ...props }: any) => (
      <TabsCtx.Provider value={onSelectionChange}>
        <div data-testid="tabs" {...props}>
          {children}
        </div>
      </TabsCtx.Provider>
    ),
    { List: TabsList, Item: TabsItem, Panel: TabsPanel }
  );
  const Tooltip = ({ children, title }: any) => (
    <div title={title}>{children}</div>
  );
  const Typography = ({ children, as: As = 'span', ...props }: any) => (
    <As {...props}>{children}</As>
  );

  return {
    EmptyPlaceholder: jest.requireActual('@openmetadata/ui-core-components')
      .EmptyPlaceholder,
    Box,
    Button,
    CloseButton,
    Dialog,
    DialogTrigger,
    Input,
    Modal,
    ModalOverlay,
    Owner,
    Tabs,
    Tooltip,
    Typography,
  };
});

jest.mock('components/common/EntityDescription/Description', () => ({
  __esModule: true,
  default: () => <div data-testid="description-v1">description</div>,
}));

jest.mock('components/Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDataQualityTab(props);

    return (
      <div data-testid="data-quality-tab">
        data-quality-tab
        {props.tableHeader}
      </div>
    );
  },
}));

jest.mock(
  'components/DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="pipeline-tab-body">pipeline-tab</div>,
  })
);

jest.mock(
  'components/DataQuality/AddTestCaseList/AddTestCaseList.component',
  () => ({
    AddTestCaseList: () => (
      <div data-testid="add-test-case-list">add-test-case-list</div>
    ),
  })
);

jest.mock('utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getDataQualityPagePath: jest.fn().mockReturnValue('/dq-path'),
  },
}));

const baseHookReturn = {
  testSuite: {
    id: 'suite-id',
    name: 'bundle_suite',
    displayName: 'Bundle Suite',
    fullyQualifiedName: 'bundle_suite_fqn',
    tests: [],
    deleted: false,
  },
  testSuiteDescription: 'suite description',
  testOwners: [],
  isLoading: false,
  isTestCaseLoading: false,
  testCaseResult: [],
  testCaseSearchQuery: '',
  testSuitePermissions: {
    ViewAll: true,
    ViewBasic: true,
    EditAll: true,
    EditTests: true,
    EditDisplayName: true,
    Delete: true,
  },
  permissions: {
    hasViewPermission: true,
    hasEditPermission: true,
    hasEditOwnerPermission: true,
    hasEditDescriptionPermission: true,
    hasDeletePermission: true,
  },
  extraDropdownContent: [],
  activeTab: 'test-cases',
  setActiveTab: mockSetActiveTab,
  isTestCaseModalOpen: false,
  setIsTestCaseModalOpen: jest.fn(),
  slashedBreadCrumb: [],
  incidentUrlState: [],
  pagingData: { paging: { total: 4 } },
  showPagination: false,
  ingestionPipelineCount: 2,
  canAddMultipleDomains: true,
  canAddMultipleUserOwners: true,
  canAddMultipleTeamOwner: false,
  fetchTestCases: jest.fn(),
  handleTestCasesRemoved: jest.fn(),
  handleSortTestCase: jest.fn(),
  handleTestCaseSearch: mockHandleTestCaseSearch,
  handleAddTestCaseSubmit: jest.fn(),
  onUpdateOwner: jest.fn(),
  handleDomainUpdate: jest.fn(),
  onDescriptionUpdate: jest.fn(),
  handleDisplayNameChange: jest.fn(),
  handleTestSuiteUpdate: jest.fn(),
};

describe('TestSuiteDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTestSuiteDetailsPage.mockReturnValue(baseHookReturn);
  });

  it('should render the breadcrumb, title row, strip, tabs and test cases tab body', () => {
    render(<TestSuiteDetail />);

    expect(screen.getByTestId('test-suite-detail-page')).toBeInTheDocument();
    expect(screen.getByTestId('header-breadcrumb')).toHaveAttribute(
      'data-item-count',
      '3'
    );
    expect(screen.getByTestId('header-breadcrumb')).toHaveAttribute(
      'data-first-item-icon',
      'true'
    );
    expect(screen.getByTestId('entity-header-display-name')).toHaveTextContent(
      'Bundle Suite'
    );
    expect(screen.getByTestId('entity-header-name')).toHaveTextContent(
      'bundle_suite'
    );
    expect(screen.getByTestId('domain-label')).toBeInTheDocument();
    expect(screen.getByTestId('owner-label')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('description-v1')).toBeInTheDocument();
    expect(screen.getByTestId('data-quality-tab')).toBeInTheDocument();
  });

  it('should keep the detail header card on the shell header band', () => {
    render(<TestSuiteDetail />);

    // AI padding standard: the header band sits at the shell's 8px padding,
    // 8px outside the 16px-inset tab content, like the other shell pages.
    expect(screen.getByTestId('test-suite-header-container')).not.toHaveClass(
      'tw:mx-4'
    );
  });

  it('should render the pipeline tab body when the pipeline tab is active', () => {
    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      activeTab: 'pipeline',
    });

    render(<TestSuiteDetail />);

    expect(screen.getByTestId('pipeline-tab-body')).toBeInTheDocument();
    expect(screen.queryByTestId('data-quality-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('description-v1')).not.toBeInTheDocument();
  });

  it('should call setActiveTab when another tab is clicked', () => {
    render(<TestSuiteDetail />);

    fireEvent.click(screen.getByText('label.pipeline-plural'));

    expect(mockSetActiveTab).toHaveBeenCalledWith('pipeline');
  });

  it('should render the loader while loading', () => {
    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      isLoading: true,
    });

    render(<TestSuiteDetail />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('test-suite-detail-page')
    ).not.toBeInTheDocument();
  });

  it('should render the permission placeholder without view permission', () => {
    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      testSuitePermissions: { ViewAll: false, ViewBasic: false },
    });

    render(<TestSuiteDetail />);

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
  });

  it('should render the permission placeholder before the undefined guard when permission is denied and testSuite is undefined', () => {
    const DocumentTitleMock = jest.requireMock(
      'components/common/DocumentTitle/DocumentTitle'
    ).default;

    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      testSuite: undefined,
      isLoading: false,
      testSuitePermissions: { ViewAll: false, ViewBasic: false },
    });

    render(<TestSuiteDetail />);

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(DocumentTitleMock).not.toHaveBeenCalled();
  });

  it('should render ErrorPlaceHolder and skip the page shell when testSuite is undefined after a fetch error', () => {
    const DocumentTitleMock = jest.requireMock(
      'components/common/DocumentTitle/DocumentTitle'
    ).default;

    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      testSuite: undefined,
      isLoading: false,
      testSuitePermissions: { ViewAll: true, ViewBasic: true },
    });

    render(<TestSuiteDetail />);

    expect(
      screen.getByTestId(
        /(no-data|permission-error|search-error|create-error|assign-error)-placeholder/
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
    expect(
      screen.queryByTestId('test-suite-detail-page')
    ).not.toBeInTheDocument();
    expect(DocumentTitleMock).not.toHaveBeenCalled();
  });

  it('should show the add test case button with edit permission', () => {
    render(<TestSuiteDetail />);

    expect(screen.getByTestId('add-test-case-btn')).toBeInTheDocument();
    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
  });

  it('should hide the add test case button without edit permission', () => {
    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      testSuitePermissions: {
        ...baseHookReturn.testSuitePermissions,
        EditAll: false,
        EditTests: false,
      },
    });

    render(<TestSuiteDetail />);

    expect(screen.queryByTestId('add-test-case-btn')).not.toBeInTheDocument();
  });

  it('should render the copy URL button in the title row', () => {
    render(<TestSuiteDetail />);

    expect(screen.getByTestId('entity-header-copy-button')).toBeInTheDocument();
  });

  it('should search the suite test cases from the table header', async () => {
    render(<TestSuiteDetail />);

    fireEvent.change(screen.getByTestId('test-suite-test-case-search'), {
      target: { value: 'ReVeNuE' },
    });

    await waitFor(() => {
      expect(mockHandleTestCaseSearch).toHaveBeenCalledWith('ReVeNuE');
    });
  });

  it('should show the applied query and flag active filters for the empty state', () => {
    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      testCaseSearchQuery: 'revenue',
    });

    render(<TestSuiteDetail />);

    expect(screen.getByTestId('test-suite-test-case-search')).toHaveValue(
      'revenue'
    );
    expect(mockDataQualityTab).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasActiveFilters: true })
    );
  });

  it('should clear the search immediately from the clear button', () => {
    mockUseTestSuiteDetailsPage.mockReturnValue({
      ...baseHookReturn,
      testCaseSearchQuery: 'revenue',
    });

    render(<TestSuiteDetail />);

    fireEvent.click(
      screen.getByRole('button', { name: 'label.clear-entity:label.search' })
    );

    expect(mockHandleTestCaseSearch).toHaveBeenCalledWith('');
  });

  it('should not flag active filters without a query', () => {
    render(<TestSuiteDetail />);

    expect(mockDataQualityTab).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasActiveFilters: false })
    );
  });
});

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
import TestSuiteDetail from './TestSuiteDetail';

const mockUseTestSuiteDetailsPage = jest.fn();
const mockNavigate = jest.fn();
const mockSetActiveTab = jest.fn();

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

jest.mock('components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: () => <div data-testid="owner-label">owner-label</div>,
}));

jest.mock('components/common/EntityDescription/Description', () => ({
  __esModule: true,
  default: () => <div data-testid="description-v1">description</div>,
}));

jest.mock('components/Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: ({ editVariant }: any) => (
    <div data-edit-variant={editVariant} data-testid="data-quality-tab">
      data-quality-tab
    </div>
  ),
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
  handleSortTestCase: jest.fn(),
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
    expect(screen.getByTestId('data-quality-tab')).toHaveAttribute(
      'data-edit-variant',
      'modal'
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

    expect(screen.getByTestId('error-placeholder')).toHaveAttribute(
      'data-type',
      'PERMISSION'
    );
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
});

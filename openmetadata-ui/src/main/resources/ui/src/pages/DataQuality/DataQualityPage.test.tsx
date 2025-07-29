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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DataQualityPage from './DataQualityPage';
import { DataQualityPageTabs } from './DataQualityPage.interface';

const mockUseParam = { tab: DataQualityPageTabs.TEST_CASES } as {
  tab?: DataQualityPageTabs;
};

// Mock navigation function
const mockNavigate = jest.fn();

// mock components
jest.mock('./DataQualityProvider', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../components/common/LeftPanelCard/LeftPanelCard', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
// Import DataQualityClassBase before mocking to avoid hoisting issues
jest.mock('./DataQualityClassBase', () => {
  const MockTestCasesComponent = () => <div>Test Cases Component</div>;
  const MockTestSuitesComponent = () => <div>Test Suites Component</div>;
  const MockDashboardComponent = () => <div>Dashboard Component</div>;

  return {
    __esModule: true,
    default: {
      getLeftSideBar: jest.fn().mockReturnValue([
        {
          key: 'tables',
          label: 'Tables',
          icon: jest.fn(),
          iconProps: {
            className: 'side-panel-icons',
          },
        },
      ]),
      getDataQualityTab: jest.fn().mockReturnValue([
        {
          component: MockTestCasesComponent,
          key: 'test-cases',
          label: 'Test Cases',
          path: '/data-quality/test-cases',
        },
        {
          component: MockTestSuitesComponent,
          key: 'test-suites',
          label: 'Test Suites',
          path: '/data-quality/test-suites',
        },
        {
          component: MockDashboardComponent,
          key: 'dashboard',
          label: 'Dashboard',
          path: '/data-quality/dashboard',
        },
      ]),
      getDefaultActiveTab: jest.fn().mockReturnValue('test-cases'),
      getManageExtraOptions: jest.fn().mockReturnValue([]),
      getExportDataQualityDashboardButton: jest.fn().mockReturnValue(null),
    },
  };
});
jest.mock('../../components/common/ResizablePanels/ResizableLeftPanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ));
});

jest.mock('../../hoc/withPageLayout', () => ({
  __esModule: true,
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest
    .fn()
    .mockImplementation(() => ({ tab: mockUseParam.tab })),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      testSuite: {
        Create: true,
        Delete: true,
        ViewAll: true,
        ViewBasic: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));

// Mock TabsLabel component
jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ name }) => <span>{name}</span>),
}));

// Mock PageHeader component
jest.mock('../../components/PageHeader/PageHeader.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ data }) => (
    <div className="page-header-container" data-testid="page-header-container">
      <h5 className="ant-typography heading" data-testid="heading">
        {data?.header}
      </h5>
      <div className="ant-typography sub-heading" data-testid="sub-heading">
        {data?.subHeader}
      </div>
    </div>
  )),
}));

// Mock TestCaseFormV1 and BundleSuiteForm components
jest.mock(
  '../../components/DataQuality/AddDataQualityTest/components/TestCaseFormV1',
  () => {
    return jest.fn().mockImplementation(({ drawerProps, onCancel }) => (
      <div data-testid="test-case-form-v1-modal">
        <div>TestCaseFormV1 Modal</div>
        <button data-testid="test-case-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <div>title: {drawerProps?.title}</div>
        <div>open: {drawerProps?.open ? 'true' : 'false'}</div>
      </div>
    ));
  }
);

jest.mock(
  '../../components/DataQuality/BundleSuiteForm/BundleSuiteForm',
  () => {
    return jest
      .fn()
      .mockImplementation(({ drawerProps, onCancel, onSuccess }) => (
        <div data-testid="bundle-suite-form-modal">
          <div>BundleSuiteForm Modal</div>
          <button data-testid="bundle-suite-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button data-testid="bundle-suite-success-btn" onClick={onSuccess}>
            Success
          </button>
          <div>open: {drawerProps?.open ? 'true' : 'false'}</div>
        </div>
      ));
  }
);

const mockProps = {
  pageTitle: 'data-quality',
};

describe('DataQualityPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParam.tab = DataQualityPageTabs.TEST_CASES;
  });

  describe('Component Rendering', () => {
    it('should render component with basic elements', async () => {
      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      expect(await screen.findByTestId('heading')).toBeInTheDocument();
      expect(await screen.findByTestId('sub-heading')).toBeInTheDocument();
      expect(await screen.findByTestId('tabs')).toBeInTheDocument();
      expect(
        await screen.findByTestId('data-insight-container')
      ).toBeInTheDocument();
    });

    it('should render with correct page header content', async () => {
      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      expect(await screen.findByText('label.data-quality')).toBeInTheDocument();
      expect(
        await screen.findByText('message.page-sub-header-for-data-quality')
      ).toBeInTheDocument();
    });

    it('should show "Add Test Case" button on TEST_CASES tab with Create permission', async () => {
      mockUseParam.tab = DataQualityPageTabs.TEST_CASES;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      // Debug: Check if the tab content is being rendered
      expect(screen.getByTestId('data-insight-container')).toBeInTheDocument();

      expect(
        await screen.findByTestId('add-test-case-btn')
      ).toBeInTheDocument();
      expect(screen.getByText('label.add-a-entity')).toBeInTheDocument();
    });

    it('should show "Add Test Suite" button on TEST_SUITES tab with Create permission', async () => {
      mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      expect(
        await screen.findByTestId('add-test-suite-btn')
      ).toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open TestCaseFormV1 modal when Add Test Case button is clicked', async () => {
      mockUseParam.tab = DataQualityPageTabs.TEST_CASES;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      const addButton = await screen.findByTestId('add-test-case-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(
        await screen.findByTestId('test-case-form-v1-modal')
      ).toBeInTheDocument();
      expect(screen.getByText('TestCaseFormV1 Modal')).toBeInTheDocument();
      expect(screen.getByText('open: true')).toBeInTheDocument();
    });

    it('should close TestCaseFormV1 modal when cancel is clicked', async () => {
      mockUseParam.tab = DataQualityPageTabs.TEST_CASES;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      const addButton = await screen.findByTestId('add-test-case-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(
        await screen.findByTestId('test-case-form-v1-modal')
      ).toBeInTheDocument();

      const cancelButton = screen.getByTestId('test-case-cancel-btn');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('test-case-form-v1-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('should open BundleSuiteForm modal when Add Test Suite button is clicked', async () => {
      mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      const addButton = await screen.findByTestId('add-test-suite-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(
        await screen.findByTestId('bundle-suite-form-modal')
      ).toBeInTheDocument();
      expect(screen.getByText('BundleSuiteForm Modal')).toBeInTheDocument();
      expect(screen.getByText('open: true')).toBeInTheDocument();
    });

    it('should close BundleSuiteForm modal when cancel is clicked', async () => {
      mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      const addButton = await screen.findByTestId('add-test-suite-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(
        await screen.findByTestId('bundle-suite-form-modal')
      ).toBeInTheDocument();

      const cancelButton = screen.getByTestId('bundle-suite-cancel-btn');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('bundle-suite-form-modal')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Tab Integration', () => {
    it('should render tabs correctly', async () => {
      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      const tabs = await screen.findByTestId('tabs');

      expect(tabs).toBeInTheDocument();
    });

    it('should show dropdown menu on DASHBOARD tab', async () => {
      mockUseParam.tab = DataQualityPageTabs.DASHBOARD;

      render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

      expect(
        await screen.findByTestId('data-quality-add-button-menu')
      ).toBeInTheDocument();
      expect(screen.getByText('label.add')).toBeInTheDocument();
    });
  });
});

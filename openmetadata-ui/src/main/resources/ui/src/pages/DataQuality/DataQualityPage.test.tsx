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
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import DataQualityClassBase from './DataQualityClassBase';
import DataQualityPage from './DataQualityPage';
import { DataQualityPageTabs } from './DataQualityPage.interface';
import DataQualityProvider from './DataQualityProvider';

const DATA_QUALITY_TEST_PATHS = {
  testCases: `/data-quality/${DataQualityPageTabs.TEST_CASES}`,
  testSuites: `/data-quality/${DataQualityPageTabs.TEST_SUITES}`,
  dashboard: `/data-quality/${DataQualityPageTabs.DASHBOARD}`,
} as const;

const mockProps = {
  pageTitle: 'data-quality',
};

const dataQualityPageAt = (initialPath: string) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route
        element={<DataQualityPage {...mockProps} />}
        path="/data-quality/:tab/:subTab"
      />
      <Route
        element={<DataQualityPage {...mockProps} />}
        path="/data-quality/:tab"
      />
    </Routes>
  </MemoryRouter>
);

const renderDataQualityPage = (initialPath: string) =>
  render(dataQualityPageAt(initialPath));

// Renders the live URL so tab switches can be asserted on the real router's
// location instead of on navigate-call wiring.
const LocationProbe = () => {
  const location = useLocation();

  return (
    <span data-testid="location-probe">
      {location.pathname}
      {location.search}
    </span>
  );
};

// Drives the URL the same ways real users do: a filter change pushes a new
// search onto the history, and browser back jumps across entries, both
// bypassing the page's own tab handler.
const UrlMutator = () => {
  const navigate = useNavigate();

  return (
    <>
      <button
        aria-label="Mutate search"
        data-testid="mutate-search"
        onClick={() => navigate({ search: '?testSuiteFqn=suite1' })}
      />
      <button
        aria-label="Go back"
        data-testid="go-back"
        onClick={() => navigate(-2)}
      />
    </>
  );
};

// Mock navigation function
const mockNavigate = jest.fn();
const mockShowModal = jest.fn();
// Tab-preservation tests drive the real router; the rest assert on mockNavigate.
let mockUseRealNavigate = false;
const HOOK_ERROR =
  /Do not call Hooks|change in the order of Hooks|Rendered (more|fewer) hooks/;

// A real context read stands in for the provider, so a call that moves back
// inside a memo (or a menu helper it runs) trips React's hook-order checks.
jest.mock(
  '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => {
    const { createContext, useContext } = jest.requireActual('react');
    const context = createContext({
      showModal: (data: unknown) => mockShowModal(data),
    });

    return { useEntityExportModalProvider: () => useContext(context) };
  }
);

jest.mock('./DataQualityProvider', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  useDataQualityProvider: jest.fn().mockImplementation(() => ({})),
}));
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
  useNavigate: jest
    .fn()
    .mockImplementation((...args) =>
      mockUseRealNavigate
        ? jest.requireActual('react-router-dom').useNavigate(...args)
        : mockNavigate
    ),
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
      testCase: {
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
      <h5 className="heading" data-testid="heading">
        {data?.header}
      </h5>
      <div className="sub-heading" data-testid="sub-heading">
        {data?.subHeader}
      </div>
    </div>
  )),
}));

// Mock TestCaseFormDrawer and BundleSuiteFormDrawer components
jest.mock(
  '../../components/DataQuality/AddDataQualityTest/components/TestCaseFormDrawer',
  () => {
    return jest.fn().mockImplementation(({ open, onClose }) => (
      <div data-testid="test-case-form-drawer">
        <div>TestCaseFormDrawer</div>
        <button data-testid="test-case-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <div>open: {open ? 'true' : 'false'}</div>
      </div>
    ));
  }
);

jest.mock(
  '../../components/DataQuality/BundleSuiteForm/BundleSuiteFormDrawer',
  () => {
    return jest.fn().mockImplementation(({ onClose, onSuccess, open }) => (
      <div data-testid="bundle-suite-form-drawer">
        <div>BundleSuiteFormDrawer</div>
        <button data-testid="bundle-suite-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button data-testid="bundle-suite-success-btn" onClick={onSuccess}>
          Success
        </button>
        <div>open: {open ? 'true' : 'false'}</div>
      </div>
    ));
  }
);

describe('DataQualityPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRealNavigate = false;
  });

  describe('Component Rendering', () => {
    it('should render component with basic elements', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      expect(await screen.findByTestId('heading')).toBeInTheDocument();
      expect(await screen.findByTestId('sub-heading')).toBeInTheDocument();
      expect(await screen.findByTestId('tabs')).toBeInTheDocument();
      expect(
        await screen.findByTestId('data-insight-container')
      ).toBeInTheDocument();
    });

    it('should render with correct page header content', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      expect(await screen.findByText('label.data-quality')).toBeInTheDocument();
      expect(
        await screen.findByText('message.page-sub-header-for-data-quality')
      ).toBeInTheDocument();
    });

    it('should show "Add Test Case" button on TEST_CASES tab with Create permission', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      // Debug: Check if the tab content is being rendered
      expect(screen.getByTestId('data-insight-container')).toBeInTheDocument();

      expect(
        await screen.findByTestId('add-test-case-btn')
      ).toBeInTheDocument();
      expect(screen.getByText('label.add-a-entity')).toBeInTheDocument();
    });

    it('should show "Add Test Suite" button on TEST_SUITES tab with Create permission', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testSuites);

      expect(
        await screen.findByTestId('add-test-suite-btn')
      ).toBeInTheDocument();
    });
  });

  describe('DataQualityContext create-action registration', () => {
    it('should pass create handlers and permissions into DataQualityProvider', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      await screen.findByTestId('data-insight-container');

      await waitFor(() => {
        const calls = (DataQualityProvider as unknown as jest.Mock).mock.calls;
        const lastProps = calls[calls.length - 1][0];

        expect(lastProps.createActions).toEqual(
          expect.objectContaining({
            canCreateTestCase: true,
            canCreateBundleSuite: true,
            onAddTestCase: expect.any(Function),
            onAddBundleSuite: expect.any(Function),
          })
        );
      });
    });
  });

  describe('Modal Functionality', () => {
    it('should open TestCaseFormDrawer when Add Test Case button is clicked', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      const drawer = await screen.findByTestId('test-case-form-drawer');

      expect(drawer).toBeInTheDocument();
      expect(within(drawer).getByText('open: false')).toBeInTheDocument();

      const addButton = await screen.findByTestId('add-test-case-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(
        within(drawer).getByText('TestCaseFormDrawer')
      ).toBeInTheDocument();
      expect(within(drawer).getByText('open: true')).toBeInTheDocument();
    });

    it('should close TestCaseFormDrawer when cancel is clicked', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      const drawer = await screen.findByTestId('test-case-form-drawer');
      const addButton = await screen.findByTestId('add-test-case-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(within(drawer).getByText('open: true')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('test-case-cancel-btn');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(within(drawer).getByText('open: false')).toBeInTheDocument();
      });
    });

    it('should open BundleSuiteFormDrawer when Add Test Suite button is clicked', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testSuites);

      const drawer = await screen.findByTestId('bundle-suite-form-drawer');

      expect(drawer).toBeInTheDocument();
      expect(within(drawer).getByText('open: false')).toBeInTheDocument();

      const addButton = await screen.findByTestId('add-test-suite-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(
        within(drawer).getByText('BundleSuiteFormDrawer')
      ).toBeInTheDocument();
      expect(within(drawer).getByText('open: true')).toBeInTheDocument();
    });

    it('should close BundleSuiteFormDrawer when cancel is clicked', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testSuites);

      const drawer = await screen.findByTestId('bundle-suite-form-drawer');
      const addButton = await screen.findByTestId('add-test-suite-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(within(drawer).getByText('open: true')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('bundle-suite-cancel-btn');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(within(drawer).getByText('open: false')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Integration', () => {
    it('should render tabs correctly', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.testCases);

      const tabs = await screen.findByTestId('tabs');

      expect(tabs).toBeInTheDocument();
    });

    it('should show dropdown menu on DASHBOARD tab', async () => {
      renderDataQualityPage(DATA_QUALITY_TEST_PATHS.dashboard);

      expect(
        await screen.findByTestId('data-quality-add-button-menu')
      ).toBeInTheDocument();
      expect(screen.getByText('label.add')).toBeInTheDocument();
    });

    it('should restore each tab query string when switching between tabs', async () => {
      mockUseRealNavigate = true;
      const initialSearch =
        '?testCaseStatus%5B%5D=Failed&lastRunRange%5BstartTs%5D=100&lastRunRange%5BendTs%5D=200';
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      });
      const dataQualityTabs = (activeTab: string) => (
        <MemoryRouter initialEntries={[activeTab]}>
          <LocationProbe />
          <Routes>
            <Route
              element={<DataQualityPage {...mockProps} />}
              path="/data-quality/:tab/:subTab"
            />
            <Route
              element={<DataQualityPage {...mockProps} />}
              path="/data-quality/:tab"
            />
          </Routes>
        </MemoryRouter>
      );

      render(
        dataQualityTabs(`${DATA_QUALITY_TEST_PATHS.testCases}${initialSearch}`)
      );

      await screen.findByTestId('tabs');

      // Leaving Test Cases must not carry its filters into the next tab. The
      // full-URL equality catches a leaked query string, which a substring
      // match on the path alone would let through.
      await user.click(screen.getByRole('tab', { name: 'Test Suites' }));

      expect((await screen.findByTestId('location-probe')).textContent).toBe(
        DATA_QUALITY_TEST_PATHS.testSuites
      );

      // Coming back must re-send the filters the user had selected.
      await user.click(screen.getByRole('tab', { name: 'Test Cases' }));

      expect((await screen.findByTestId('location-probe')).textContent).toBe(
        `${DATA_QUALITY_TEST_PATHS.testCases}${initialSearch}`
      );
    });

    it('should restore a tab latest URL even when the user left it via history back', async () => {
      mockUseRealNavigate = true;
      const initialSearch = '?testCaseStatus%5B%5D=Failed';
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      });
      const dataQualityTabs = (initialPath: string) => (
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationProbe />
          <UrlMutator />
          <Routes>
            <Route
              element={<DataQualityPage {...mockProps} />}
              path="/data-quality/:tab/:subTab"
            />
            <Route
              element={<DataQualityPage {...mockProps} />}
              path="/data-quality/:tab"
            />
          </Routes>
        </MemoryRouter>
      );

      render(
        dataQualityTabs(`${DATA_QUALITY_TEST_PATHS.testCases}${initialSearch}`)
      );

      await screen.findByTestId('tabs');

      // Switching to Test Suites records its (empty) search.
      await user.click(screen.getByRole('tab', { name: 'Test Suites' }));

      expect((await screen.findByTestId('location-probe')).textContent).toBe(
        DATA_QUALITY_TEST_PATHS.testSuites
      );

      // A filter change on Test Suites rewrites its URL…
      await user.click(screen.getByTestId('mutate-search'));

      expect((await screen.findByTestId('location-probe')).textContent).toBe(
        `${DATA_QUALITY_TEST_PATHS.testSuites}?testSuiteFqn=suite1`
      );

      // …and leaving Test Suites via history back (not a tab click) must not
      // lose that search — returning to the tab must restore the latest URL.
      await user.click(screen.getByTestId('go-back'));

      expect((await screen.findByTestId('location-probe')).textContent).toBe(
        `${DATA_QUALITY_TEST_PATHS.testCases}${initialSearch}`
      );

      await user.click(screen.getByRole('tab', { name: 'Test Suites' }));

      expect((await screen.findByTestId('location-probe')).textContent).toBe(
        `${DATA_QUALITY_TEST_PATHS.testSuites}?testSuiteFqn=suite1`
      );
    });

    it('should read the export modal hook outside the export button memo and hand its showModal to the builder', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const exportData = { name: 'data-quality', onExport: jest.fn() };

      const { rerender } = renderDataQualityPage(
        DATA_QUALITY_TEST_PATHS.dashboard
      );
      await screen.findByTestId('tabs');
      rerender(dataQualityPageAt(DATA_QUALITY_TEST_PATHS.dashboard));

      const [activeTab, showModal] = (
        DataQualityClassBase.getExportDataQualityDashboardButton as jest.Mock
      ).mock.calls.at(-1);
      showModal(exportData);

      expect(activeTab).toBe(DataQualityPageTabs.DASHBOARD);
      expect(mockShowModal).toHaveBeenCalledWith(exportData);
      expect(
        consoleErrorSpy.mock.calls.filter(([message]) =>
          HOOK_ERROR.test(String(message))
        )
      ).toEqual([]);

      consoleErrorSpy.mockRestore();
    });
  });
});

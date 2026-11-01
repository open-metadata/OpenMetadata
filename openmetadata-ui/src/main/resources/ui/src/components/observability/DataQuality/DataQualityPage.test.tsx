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
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../../../constants/appMode.constants';
import { useAppModeStore } from '../../../hooks/useAppMode';
import DataQualityPage from './DataQualityPage';

const mockShowModal = jest.fn();

jest.mock('../../../pages/DataQuality/DataQualityProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDataQualityProvider: jest.fn().mockImplementation(() => ({
    isTestCaseSummaryLoading: false,
  })),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testCase: { Create: true },
      testSuite: { Create: true },
    },
  })),
}));

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest
      .fn()
      .mockImplementation(() => ({ showModal: mockShowModal })),
  })
);

jest.mock(
  '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer',
  () => ({
    __esModule: true,
    default: () => <div>TestCaseFormDrawer</div>,
  })
);

jest.mock('../../DataQuality/BundleSuiteForm/BundleSuiteFormDrawer', () => ({
  __esModule: true,
  default: () => <div>BundleSuiteFormDrawer</div>,
}));

jest.mock('../ObservabilityPageShell/ObservabilityPageShell', () => ({
  __esModule: true,
  default: ({
    children,
    header,
  }: {
    children: ReactNode;
    header: ReactNode;
  }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

jest.mock('../../Learning/LearningIcon/LearningIcon.component', () => ({
  __esModule: true,
  LearningIcon: () => <div>LearningIcon</div>,
}));

jest.mock('../../common/HeaderBreadcrumb/HeaderBreadcrumb.component', () => ({
  __esModule: true,
  default: () => <div>HeaderBreadcrumb</div>,
}));

jest.mock('../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div>Loader</div>,
}));

jest.mock('./Dashboard/DataQualityDashboard', () => ({
  __esModule: true,
  default: () => <div>Dashboard</div>,
}));

jest.mock('./TestCases/TestCases', () => ({
  __esModule: true,
  default: () => <div>TestCases</div>,
}));

jest.mock('./TestSuites/TestSuites', () => ({
  __esModule: true,
  default: () => <div>TestSuites</div>,
}));

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

// Hands the URL to a route outside Data Quality, the way the AI shell does
// while keeping this page mounted.
const LeaveToAnotherRoute = () => {
  const navigate = useNavigate();

  return (
    <button
      aria-label="Leave to another route"
      data-testid="leave-to-alerts"
      onClick={() => navigate('/observability/alerts/x?foreign=1')}
    />
  );
};

const renderDataQualityPage = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        <Route
          element={<DataQualityPage />}
          path="/observability/data-quality"
        />
        <Route
          element={<DataQualityPage />}
          path="/observability/data-quality/:tab"
        />
      </Routes>
    </MemoryRouter>
  );

describe('observability DataQualityPage', () => {
  beforeEach(() => {
    // The page only owns the URL — and resolves its tab paths with the
    // /observability prefix — while the AI app mode is active.
    useAppModeStore.setState({ currentMode: AI_APP_MODE });
  });

  afterEach(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
  });

  it('should render the page shell with its tabs', async () => {
    renderDataQualityPage('/observability/data-quality/test-cases');

    expect(
      await screen.findByRole('tab', { name: 'label.test-suite-plural' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'label.test-case-plural' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'label.summary' })
    ).toBeInTheDocument();
  });

  it('should restore each tab query string when switching between tabs', async () => {
    const initialSearch =
      '?testCaseStatus%5B%5D=Failed&lastRunRange%5BstartTs%5D=100&lastRunRange%5BendTs%5D=200';
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });

    renderDataQualityPage(
      `/observability/data-quality/test-cases${initialSearch}`
    );

    await screen.findByRole('tab', { name: 'label.test-suite-plural' });

    // Leaving Test Cases must not carry its filters into the next tab; the
    // full-URL equality catches a leaked query string.
    await user.click(
      screen.getByRole('tab', { name: 'label.test-suite-plural' })
    );

    expect((await screen.findByTestId('location-probe')).textContent).toBe(
      '/observability/data-quality/test-suites'
    );

    // Coming back must re-send the filters the user had selected.
    await user.click(
      screen.getByRole('tab', { name: 'label.test-case-plural' })
    );

    expect((await screen.findByTestId('location-probe')).textContent).toBe(
      `/observability/data-quality/test-cases${initialSearch}`
    );
  });

  it('should not capture another route search while app mode keeps the page mounted', async () => {
    const initialSearch = '?testCaseStatus%5B%5D=Failed';
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });

    // One wide route so the page stays mounted while the URL moves to another
    // module — the keep-alive behaviour the ownsTheUrl guard exists for.
    render(
      <MemoryRouter
        initialEntries={[
          `/observability/data-quality/test-cases${initialSearch}`,
        ]}>
        <LocationProbe />
        <LeaveToAnotherRoute />
        <Routes>
          <Route
            element={<DataQualityPage />}
            path="/observability/:module/:tab"
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('tab', { name: 'label.test-case-plural' });

    // The shell hands the URL to another route while keeping this page
    // mounted; that route's query string is not this page's filter state.
    await user.click(screen.getByTestId('leave-to-alerts'));

    expect((await screen.findByTestId('location-probe')).textContent).toBe(
      '/observability/alerts/x?foreign=1'
    );

    // Returning to Test Cases must restore its own search, not the other
    // route's.
    await user.click(
      screen.getByRole('tab', { name: 'label.test-case-plural' })
    );

    expect((await screen.findByTestId('location-probe')).textContent).toBe(
      `/observability/data-quality/test-cases${initialSearch}`
    );

    // The Summary tab was the fallback active tab while the URL was abroad; a
    // missing guard would have saved the other route's search under it.
    await user.click(screen.getByRole('tab', { name: 'label.summary' }));

    expect((await screen.findByTestId('location-probe')).textContent).toBe(
      '/observability/data-quality/dashboard'
    );
  });
});

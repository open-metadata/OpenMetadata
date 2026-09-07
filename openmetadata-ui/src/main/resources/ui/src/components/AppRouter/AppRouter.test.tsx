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
import { MemoryRouter } from 'react-router-dom';
import { AI_APP_MODE } from '../../constants/appMode.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useAppMode } from '../../hooks/useAppMode';
import { isAppModeSessionActive } from '../../utils/appModeSession';
import AppRouter from './AppRouter';

jest.mock('./AuthenticatedApp', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="authenticated-app">{children}</div>
  ),
}));

jest.mock('./AuthenticatedRoutes', () => ({
  __esModule: true,
  AuthenticatedRoutes: () => <div data-testid="classic-shell" />,
}));

jest.mock('../platform/ai-shell/AppModeRoutes/AppModeRoutes', () => ({
  __esModule: true,
  default: () => <div data-testid="classicv1-shell" />,
}));

jest.mock('../../pages/PageNotFound/PageNotFound', () => ({
  __esModule: true,
  default: () => <div data-testid="page-not-found" />,
}));

jest.mock('../../pages/LogoutPage/LogoutPage', () => ({
  LogoutPage: () => <div data-testid="logout-page" />,
}));

jest.mock('../../pages/AccessNotAllowedPage/AccessNotAllowedPage', () => ({
  __esModule: true,
  default: () => <div data-testid="access-not-allowed" />,
}));

jest.mock('../../pages/SamlCallback', () => ({
  __esModule: true,
  default: () => <div data-testid="saml-callback" />,
}));

jest.mock('../../pages/SignUp/SignUpPage', () => ({
  __esModule: true,
  default: () => <div data-testid="sign-up" />,
}));

jest.mock('../../utils/ApplicationRoutesClassBase', () => ({
  __esModule: true,
  default: {
    getUnAuthenticatedRouteElements: () => () =>
      <div data-testid="unauthenticated-router" />,
  },
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../hooks/useAppMode', () => ({
  useAppMode: jest.fn(),
}));

jest.mock('../../utils/appModeSession', () => ({
  isAppModeSessionActive: jest.fn(),
}));

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockUseAppMode = useAppMode as unknown as jest.Mock;
const mockIsAppModeSessionActive =
  isAppModeSessionActive as unknown as jest.Mock;

const setAuthState = (overrides: {
  isAuthenticated?: boolean;
  isApplicationLoading?: boolean;
  isAuthenticating?: boolean;
  currentUser?: Record<string, unknown>;
}) => {
  const state = {
    currentUser: {},
    isAuthenticated: true,
    isApplicationLoading: false,
    isAuthenticating: false,
    ...overrides,
  };

  mockUseApplicationStore.mockImplementation((selector?: unknown) =>
    typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state
  );
};

const renderRouter = () =>
  render(
    <MemoryRouter>
      <AppRouter />
    </MemoryRouter>
  );

describe('AppRouter — mode-based shell selection', () => {
  beforeEach(() => {
    mockUseApplicationStore.mockReset();
    mockUseAppMode.mockReset();
    mockIsAppModeSessionActive.mockReset();
    mockIsAppModeSessionActive.mockReturnValue(false);
  });

  it('renders the AI shell in ai mode', async () => {
    setAuthState({ isAuthenticated: true });
    mockUseAppMode.mockReturnValue(AI_APP_MODE);

    renderRouter();

    expect(await screen.findByTestId('classicv1-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('classic-shell')).not.toBeInTheDocument();
  });

  it('renders Classic in default mode', async () => {
    setAuthState({ isAuthenticated: true });
    mockUseAppMode.mockReturnValue('default');

    renderRouter();

    expect(await screen.findByTestId('classic-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('classicv1-shell')).not.toBeInTheDocument();
  });

  it('renders the AI shell in default mode when an app-mode session is active', async () => {
    setAuthState({ isAuthenticated: true });
    mockUseAppMode.mockReturnValue('default');
    mockIsAppModeSessionActive.mockReturnValue(true);

    renderRouter();

    expect(await screen.findByTestId('classicv1-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('classic-shell')).not.toBeInTheDocument();
  });

  it('wraps the rendered shell in AuthenticatedApp for an authenticated user', async () => {
    setAuthState({ isAuthenticated: true });
    mockUseAppMode.mockReturnValue('default');

    renderRouter();

    expect(await screen.findByTestId('authenticated-app')).toBeInTheDocument();
  });

  it('shows the full-screen loader while the application is loading', () => {
    setAuthState({ isAuthenticated: false, isApplicationLoading: true });
    mockUseAppMode.mockReturnValue('default');

    renderRouter();

    expect(screen.getByTestId('full-screen-loader')).toBeInTheDocument();
  });

  it('renders the unauthenticated router when the user is not authenticated', async () => {
    setAuthState({ isAuthenticated: false });
    mockUseAppMode.mockReturnValue('default');

    renderRouter();

    expect(
      await screen.findByTestId('unauthenticated-router')
    ).toBeInTheDocument();
  });
});

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

import { render, screen, waitFor } from '@testing-library/react';
import { act, ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_APP_MODE } from '../../constants/appMode.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useAppModeStore, writeAppMode } from '../../hooks/useAppMode';
import { useAppRoutesRegistry } from '../../hooks/useAppRoutesRegistry';
import AppRouter from './AppRouter';

jest.mock('./AuthenticatedApp', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="authenticated-app">{children}</div>
  ),
}));

jest.mock('./AuthenticatedRoutes', () => ({
  __esModule: true,
  AuthenticatedRoutes: () => <div data-testid="default-authenticated-routes" />,
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

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;

const setAuthState = (overrides: {
  isAuthenticated?: boolean;
  isApplicationLoading?: boolean;
  isAuthenticating?: boolean;
  currentUser?: Record<string, unknown>;
}) => {
  mockUseApplicationStore.mockImplementation(() => ({
    currentUser: {},
    isAuthenticated: true,
    isApplicationLoading: false,
    isAuthenticating: false,
    ...overrides,
  }));
};

const ModeRoutesMock: ComponentType = () => (
  <div data-testid="custom-mode-routes" />
);

const renderRouter = () =>
  render(
    <MemoryRouter>
      <AppRouter />
    </MemoryRouter>
  );

describe('AppRouter — App Mode routing integration', () => {
  beforeEach(() => {
    mockUseApplicationStore.mockReset();
    globalThis.window.localStorage.clear();
    act(() => {
      useAppRoutesRegistry.setState({ routes: {} });
      useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
    });
  });

  it('renders the default AuthenticatedRoutes when no mode is registered', async () => {
    setAuthState({ isAuthenticated: true });

    renderRouter();

    expect(
      await screen.findByTestId('default-authenticated-routes')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('custom-mode-routes')).not.toBeInTheDocument();
  });

  it('wraps the rendered routes in AuthenticatedApp for an authenticated user', async () => {
    setAuthState({ isAuthenticated: true });

    renderRouter();

    expect(await screen.findByTestId('authenticated-app')).toBeInTheDocument();
  });

  it('renders a registered mode component when the active mode has a registration', async () => {
    setAuthState({ isAuthenticated: true });
    writeAppMode('ai');
    act(() => {
      useAppRoutesRegistry.getState().registerRoutes('ai', ModeRoutesMock);
    });

    renderRouter();

    expect(await screen.findByTestId('custom-mode-routes')).toBeInTheDocument();
    expect(
      screen.queryByTestId('default-authenticated-routes')
    ).not.toBeInTheDocument();
  });

  it('falls back to the default AuthenticatedRoutes when the active mode has no registration', async () => {
    setAuthState({ isAuthenticated: true });
    writeAppMode('ai');

    renderRouter();

    expect(
      await screen.findByTestId('default-authenticated-routes')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('custom-mode-routes')).not.toBeInTheDocument();
  });

  it('swaps to the registered mode component when the AppMode changes mid-session', async () => {
    setAuthState({ isAuthenticated: true });
    act(() => {
      useAppRoutesRegistry.getState().registerRoutes('ai', ModeRoutesMock);
    });

    renderRouter();

    expect(
      await screen.findByTestId('default-authenticated-routes')
    ).toBeInTheDocument();

    act(() => {
      writeAppMode('ai');
    });

    await waitFor(() => {
      expect(screen.getByTestId('custom-mode-routes')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('default-authenticated-routes')
    ).not.toBeInTheDocument();
  });
});

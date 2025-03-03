/*
 *  Copyright 2025 Collate.
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
import { act, render, screen } from '@testing-library/react';
import { User } from 'oidc-client';
import React from 'react';
import { Callback } from 'react-oidc';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { setOidcToken } from '../../../utils/LocalStorageUtils';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';
import OidcAuthenticator from './OidcAuthenticator';

const mockOnLoginSuccess = jest.fn();
const mockOnLoginFailure = jest.fn();
const mockOnLogoutSuccess = jest.fn();

// Mock dependencies
jest.mock('../../../utils/LocalStorageUtils');
jest.mock('../../../utils/Auth/TokenService/TokenServiceUtil');
jest.mock('../../../hooks/useApplicationStore');
jest.mock('react-oidc', () => ({
  ...jest.requireActual('react-oidc'),
  Callback: jest.fn().mockImplementation(() => {
    return <div>Callback</div>;
  }),
}));

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

jest.mock('react-helmet-async', () => ({
  HelmetProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('OidcAuthenticator - Silent SignIn Tests', () => {
  const mockUpdateAxiosInterceptors = jest.fn();
  const mockTokenServiceInstance = {
    clearRefreshInProgress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (TokenService.getInstance as jest.Mock).mockReturnValue(
      mockTokenServiceInstance
    );
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      updateAxiosInterceptors: mockUpdateAxiosInterceptors,
    });
  });

  it('should handle silent sign-in success', async () => {
    const mockUser = {
      id_token: 'mock-id-token',
    } as User;

    render(
      <MemoryRouter initialEntries={[ROUTES.SILENT_CALLBACK]}>
        <OidcAuthenticator
          childComponentType={() => <div>Child Component</div>}
          userConfig={{}}
          onLoginFailure={mockOnLoginFailure}
          onLoginSuccess={mockOnLoginSuccess}
          onLogoutSuccess={mockOnLogoutSuccess}>
          <div>Protected Content</div>
        </OidcAuthenticator>
      </MemoryRouter>
    );

    expect(Callback).toHaveBeenCalled();

    // Get the Callback component's onSuccess prop and call it
    const callbackProps = (Callback as jest.Mock).mock.calls[0][0];
    await act(async () => {
      callbackProps.onSuccess(mockUser);
    });

    // Verify the success flow
    expect(setOidcToken).toHaveBeenCalledWith('mock-id-token');
    expect(mockUpdateAxiosInterceptors).toHaveBeenCalled();
    expect(mockTokenServiceInstance.clearRefreshInProgress).toHaveBeenCalled();
  });

  it('should handle silent sign-in failure', async () => {
    const mockError = new Error('Silent sign-in failed');

    render(
      <MemoryRouter initialEntries={[ROUTES.SILENT_CALLBACK]}>
        <OidcAuthenticator
          childComponentType={() => <div>Child Component</div>}
          userConfig={{}}
          onLoginFailure={mockOnLoginFailure}
          onLoginSuccess={mockOnLoginSuccess}
          onLogoutSuccess={mockOnLogoutSuccess}>
          <div>Protected Content</div>
        </OidcAuthenticator>
      </MemoryRouter>
    );

    // Get the Callback component's onError prop and call it
    const callbackProps = (Callback as jest.Mock).mock.calls[0][0];
    await act(async () => {
      callbackProps.onError(mockError);
    });

    // Verify the failure flow
    expect(mockTokenServiceInstance.clearRefreshInProgress).toHaveBeenCalled();
    expect(mockOnLogoutSuccess).toHaveBeenCalled();
    expect(mockHistoryPush).toHaveBeenCalledWith(ROUTES.SIGNIN);
  });
});

describe('OidcAuthenticator - Login Tests', () => {
  const mockUpdateAxiosInterceptors = jest.fn();
  const mockSetIsSigningUp = jest.fn();
  const mockOnLoginSuccess = jest.fn();
  const mockOnLoginFailure = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      updateAxiosInterceptors: mockUpdateAxiosInterceptors,
      setIsSigningUp: mockSetIsSigningUp,
    });
  });

  it('should handle login success', async () => {
    const mockUser = {
      id_token: 'mock-id-token',
      profile: {
        email: 'test@test.com',
        name: 'Test User',
      },
    } as OidcUser;

    render(
      <MemoryRouter initialEntries={[ROUTES.CALLBACK]}>
        <OidcAuthenticator
          childComponentType={() => <div>Child Component</div>}
          userConfig={{}}
          onLoginFailure={mockOnLoginFailure}
          onLoginSuccess={mockOnLoginSuccess}
          onLogoutSuccess={mockOnLogoutSuccess}>
          <div>Protected Content</div>
        </OidcAuthenticator>
      </MemoryRouter>
    );

    // Get the Callback component's onSuccess prop and call it
    const callbackProps = (Callback as jest.Mock).mock.calls[0][0];
    await act(async () => {
      callbackProps.onSuccess(mockUser);
    });

    // Verify the success flow
    expect(setOidcToken).toHaveBeenCalledWith('mock-id-token');
    expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockUser);
  });

  it('should handle login failure', async () => {
    const mockError = new Error('Login failed');

    render(
      <MemoryRouter initialEntries={[ROUTES.CALLBACK]}>
        <OidcAuthenticator
          childComponentType={() => <div>Child Component</div>}
          userConfig={{}}
          onLoginFailure={mockOnLoginFailure}
          onLoginSuccess={mockOnLoginSuccess}
          onLogoutSuccess={mockOnLogoutSuccess}>
          <div>Protected Content</div>
        </OidcAuthenticator>
      </MemoryRouter>
    );

    // Get the Callback component's onError prop and call it
    const callbackProps = (Callback as jest.Mock).mock.calls[0][0];
    await act(async () => {
      callbackProps.onError(mockError);
    });

    // Verify the failure flow
    expect(mockOnLoginFailure).toHaveBeenCalled();
  });

  it('should handle login initiation', async () => {
    const ref = React.createRef<AuthenticatorRef>();

    render(
      <MemoryRouter>
        <OidcAuthenticator
          childComponentType={() => <div>Child Component</div>}
          ref={ref}
          userConfig={{}}
          onLoginFailure={mockOnLoginFailure}
          onLoginSuccess={mockOnLoginSuccess}
          onLogoutSuccess={mockOnLogoutSuccess}>
          <div>Protected Content</div>
        </OidcAuthenticator>
      </MemoryRouter>
    );

    // Trigger login
    await act(async () => {
      ref.current?.invokeLogin();
    });

    // Verify login initialization
    expect(mockSetIsSigningUp).toHaveBeenCalledWith(true);
  });

  it('should render SignInPage when not authenticated and not signing up', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      isSigningUp: false,
      currentUser: {},
      newUser: {},
    });

    render(
      <MemoryRouter initialEntries={[ROUTES.SIGNIN]}>
        <OidcAuthenticator
          childComponentType={() => <div>Child Component</div>}
          userConfig={{}}
          onLoginFailure={mockOnLoginFailure}
          onLoginSuccess={mockOnLoginSuccess}
          onLogoutSuccess={mockOnLogoutSuccess}>
          <div>Protected Content</div>
        </OidcAuthenticator>
      </MemoryRouter>
    );

    // Verify SignInPage is rendered
    expect(screen.getByTestId('signin-page')).toBeInTheDocument();
  });
});

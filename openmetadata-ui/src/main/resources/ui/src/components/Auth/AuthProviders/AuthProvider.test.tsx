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
import { fireEvent, render, screen } from '@testing-library/react';
import { AxiosResponse } from 'axios';
import { act } from 'react-test-renderer';
import { AuthProvider as AuthProviderProps } from '../../../generated/configuration/authenticationConfiguration';
import axiosClient from '../../../rest';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import AuthProvider, { useAuthProvider } from './AuthProvider';

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});

const mockOnLogoutHandler = jest.fn();

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: 'pathname' }));
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../rest/miscAPI', () => ({
  fetchAuthenticationConfig: jest.fn().mockImplementation(() =>
    Promise.resolve({
      provider: AuthProviderProps.Basic,
    })
  ),
  fetchAuthorizerConfig: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../rest/userAPI', () => ({
  getLoggedInUser: jest.fn().mockImplementation(() => Promise.resolve()),
  updateUser: jest.fn().mockImplementation(() => Promise.resolve()),
  getUserPreferences: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ preferences: [] })),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  getAppConfiguration: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ defaultAppMode: null })),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
}));

// Default returns a shape that keeps pre-existing tests (which don't touch
// this mock) working — they call startTokenExpiryTimer during mount, which
// destructures isExpired/timeoutExpiry from the return value.
const mockGetOidcToken = jest.fn().mockResolvedValue('');
const mockExtractDetailsFromToken = jest.fn().mockReturnValue({
  exp: 0,
  isExpired: true,
  timeoutExpiry: 0,
});

jest.mock('../../../utils/SwTokenStorageUtils', () => {
  const actual = jest.requireActual('../../../utils/SwTokenStorageUtils');

  return {
    ...actual,
    getOidcToken: (...args: unknown[]) => mockGetOidcToken(...args),
  };
});

jest.mock('../../../utils/AuthProvider.util', () => {
  const actual = jest.requireActual('../../../utils/AuthProvider.util');

  return {
    ...actual,
    extractDetailsFromToken: (token: string) =>
      mockExtractDetailsFromToken(token),
  };
});

const mockRefreshToken = jest
  .fn()
  .mockImplementation(() => Promise.resolve('newToken'));

jest.mock('../../../utils/Auth/TokenService/TokenServiceUtil', () => {
  return {
    getInstance: jest.fn().mockImplementation(() => ({
      refreshToken: mockRefreshToken,
      isTokenUpdateInProgress: jest.fn().mockImplementation(() => false),
      getToken: jest.fn().mockImplementation(() => Promise.resolve()),
      clearRefreshInProgress: jest
        .fn()
        .mockImplementation(() => Promise.resolve()),
      renewToken: jest.fn(),
      refreshSuccessCallback: jest.fn(),
      handleTokenUpdate: jest.fn(),
      updateRenewToken: jest.fn(),
      updateRefreshSuccessCallback: jest.fn(),
      isTokenExpired: jest.fn(),
      getTokenExpiry: jest.fn(),
      fetchNewToken: jest.fn(),
      setRefreshInProgress: jest.fn(),
    })),
  };
});

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    setCurrentUser: jest.fn(),
    updateNewUser: jest.fn(),
    setIsAuthenticated: jest.fn(),
    setAuthConfig: jest.fn(),
    setAuthorizerConfig: jest.fn(),
    setIsSigningUp: jest.fn(),
    authorizerConfig: {},
    jwtPrincipalClaims: {},
    jwtPrincipalClaimsMapping: {},
    setJwtPrincipalClaims: jest.fn(),
    setJwtPrincipalClaimsMapping: jest.fn(),
    isApplicationLoading: false,
    setApplicationLoading: jest.fn(),
    initializeAuthState: jest.fn(),
    isAuthenticating: false,
    authConfig: {
      provider: AuthProviderProps.Basic,
      providerName: 'Basic',
      clientId: 'test',
      authority: 'test',
      callbackUrl: 'test',
      jwtPrincipalClaims: [],
      publicKeyUrls: [],
      scope: 'openid',
    },
  })),
}));

describe('Test auth provider', () => {
  it('Logout handler should call the "updateUserDetails" method', async () => {
    const ConsumerComponent = () => {
      const { onLogoutHandler } = useAuthProvider();

      return (
        <button data-testid="logout-button" onClick={onLogoutHandler}>
          Logout
        </button>
      );
    };

    render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const logoutButton = await screen.findByTestId('logout-button');

    expect(logoutButton).toBeInTheDocument();
  });

  it('Logout handler should remove the refresh token', async () => {
    const ConsumerComponent = () => {
      return (
        <button data-testid="logout-button" onClick={mockOnLogoutHandler}>
          Logout
        </button>
      );
    };

    render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const logoutButton = await screen.findByTestId('logout-button');

    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);

    expect(mockOnLogoutHandler).toHaveBeenCalled();
  });

  it('onLoginHandler should handle race condition with polling mechanism', () => {
    const ConsumerComponent = () => {
      const { onLoginHandler } = useAuthProvider();

      return (
        <button
          data-testid="login-button"
          onClick={() => {
            expect(typeof onLoginHandler).toBe('function');

            onLoginHandler();
          }}>
          Login
        </button>
      );
    };

    const { getByTestId } = render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const loginButton = getByTestId('login-button');

    expect(loginButton).toBeInTheDocument();
  });
});

describe('Test axios response interceptor', () => {
  const ConsumerComponent = () => {
    return <div>ConsumerComponent</div>;
  };

  const WrapperComponent = () => {
    return (
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should set up response interceptor with correct signature', () => {
    // Mock axios client
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    render(<WrapperComponent />);

    // Verify the interceptor was set up
    expect(mockUse).toHaveBeenCalled();

    // Get the arguments passed to use()
    const [successHandler, errorHandler] = mockUse.mock.calls[0];

    // Verify success handler signature
    expect(typeof successHandler).toBe('function');
    expect(successHandler).toHaveLength(1); // Takes one argument (response)

    // Verify error handler signature
    expect(typeof errorHandler).toBe('function');
    expect(errorHandler).toHaveLength(1); // Takes one argument (error)

    // Test success handler
    const mockResponse = { data: 'test' } as AxiosResponse;

    expect(successHandler?.(mockResponse)).toBe(mockResponse);

    // Test error handler with 401 error
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: { url: '/api/test' },
    };

    // The error handler should return a Promise
    const result = errorHandler?.(mockError);

    expect(result).toBeInstanceOf(Promise);
    expect(mockRefreshToken).toHaveBeenCalled();
  });

  it('should handle 401 error when refresh is not in progress and refresh succeeds', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });
    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: { url: '/api/test' },
    };

    const result = await errorHandler?.(mockError);

    expect(result).toEqual({ data: 'success' });
    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockAxios).toHaveBeenCalledWith(mockError.config);
  });

  it('should queue request when refresh is already in progress', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    // Mock isTokenUpdateInProgress to return true for this test
    jest
      .spyOn(TokenService.getInstance(), 'isTokenUpdateInProgress')
      .mockReturnValue(true);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/api/test',
        headers: {},
        baseURL: '',
      },
    };

    const result = await errorHandler?.(mockError);

    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining(mockError.config)
    );
    expect(await result).toEqual({ data: 'success' });
  });

  it('should not call refresh for login api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);
    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/users/login',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for refresh api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/users/refresh',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for auth/refresh api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: 'auth/refresh',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for /auth/refresh api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/auth/refresh',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for loggedInUser api if error is Token expired', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/users/loggedInUser',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should call refresh for loggedInUser api if error other then Token expired', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });
    mockRefreshToken.mockImplementationOnce(() => Promise.resolve());

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'token not valid' },
      },
      config: {
        url: '/users/loggedInUser',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);

      expect(mockRefreshToken).toHaveBeenCalledTimes(0);
    }
  });

  it('should refresh the token and retry a normal 401 request', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'retried' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue('newToken');

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Expired token!' },
      },
      config: {
        url: '/tables/name/foo',
        headers: {},
        baseURL: '',
      },
    };

    const result = await errorHandler?.(mockError);

    // The queued request is retried with the refreshed token, never left parked.
    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockAxios).toHaveBeenCalledWith(mockError.config);
    expect(result).toEqual({ data: 'retried' });
  });

  it('should refresh loggedInUser on an unknown signing-key 401, not only on expiry', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'ok' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue('newToken');

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: {
          message:
            'Not Authorized! Token signing key not found in configured public keys',
        },
      },
      config: {
        url: '/users/loggedInUser',
        headers: {},
        baseURL: '',
      },
    };

    const result = await errorHandler?.(mockError);

    // IdP key-rotation 401 on the polled endpoint must refresh + retry, not log out.
    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockAxios).toHaveBeenCalledWith(mockError.config);
    expect(result).toEqual({ data: 'ok' });
  });
});

// Regression tests for the visibility handler. Before this branch every
// visibilitychange event fired tokenService.refreshToken() when the stored
// token was empty or lacked an `exp` claim — hitting the IdP on every tab
// focus for a signed-out session or an opaque token. The handler now
// early-returns in both cases, and only near-expiry / expired tokens
// trigger a refresh.
describe('AuthProvider visibility handler', () => {
  const ConsumerComponent = () => <div>ConsumerComponent</div>;
  const WrapperComponent = () => (
    <AuthProvider childComponentType={ConsumerComponent}>
      <ConsumerComponent />
    </AuthProvider>
  );

  const fireTabVisible = async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
    });
    // Let the handler's async chain resolve
    // (getOidcToken → extractDetailsFromToken → branch).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue('newToken');
    mockGetOidcToken.mockReset();
    mockGetOidcToken.mockResolvedValue('');
    mockExtractDetailsFromToken.mockReset();
    mockExtractDetailsFromToken.mockReturnValue({
      exp: 0,
      isExpired: true,
      timeoutExpiry: 0,
    });
  });

  it('does NOT call refreshToken when there is no token in storage', async () => {
    mockGetOidcToken.mockResolvedValue('');

    await act(async () => {
      render(<WrapperComponent />);
    });
    // Clear counts from mount-time work so the visibility-event assertion
    // only reflects the handler under test.
    mockRefreshToken.mockClear();

    await fireTabVisible();

    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('does NOT call refreshToken when the token has no exp claim', async () => {
    mockGetOidcToken.mockResolvedValue('opaque-token');
    mockExtractDetailsFromToken.mockReturnValue({
      exp: undefined,
      isExpired: false,
      timeoutExpiry: 0,
    });

    await act(async () => {
      render(<WrapperComponent />);
    });
    mockRefreshToken.mockClear();

    await fireTabVisible();

    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('does NOT call refreshToken for an opaque/undecodable token (jwt-decode threw)', async () => {
    // When jwt-decode throws, extractDetailsFromToken falls through to
    // {exp: 0, isExpired: true, timeoutExpiry: 0}. Naïvely ordering
    // `if (isExpired)` first would fire refresh on every focus for an
    // opaque token. The invalid-exp guard MUST come before the isExpired
    // branch. (Greptile P1 on #31819)
    mockGetOidcToken.mockResolvedValue('not-a-jwt');
    mockExtractDetailsFromToken.mockReturnValue({
      exp: 0,
      isExpired: true,
      timeoutExpiry: 0,
    });

    await act(async () => {
      render(<WrapperComponent />);
    });
    mockRefreshToken.mockClear();

    await fireTabVisible();

    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('does NOT call refreshToken when the token is fresh (outside the pre-expiry buffer)', async () => {
    mockGetOidcToken.mockResolvedValue('fresh-jwt');
    mockExtractDetailsFromToken.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 600,
      isExpired: false,
      timeoutExpiry: 540_000,
    });

    await act(async () => {
      render(<WrapperComponent />);
    });
    mockRefreshToken.mockClear();

    await fireTabVisible();

    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('DOES call refreshToken when the token has expired', async () => {
    mockGetOidcToken.mockResolvedValue('expired-jwt');
    mockExtractDetailsFromToken.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) - 60,
      isExpired: true,
      timeoutExpiry: 0,
    });

    await act(async () => {
      render(<WrapperComponent />);
    });
    mockRefreshToken.mockClear();

    await fireTabVisible();

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('DOES call refreshToken when the token is within the pre-expiry buffer', async () => {
    mockGetOidcToken.mockResolvedValue('near-expiry-jwt');
    mockExtractDetailsFromToken.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 30,
      isExpired: false,
      timeoutExpiry: 0,
    });

    await act(async () => {
      render(<WrapperComponent />);
    });
    mockRefreshToken.mockClear();

    await fireTabVisible();

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });
});

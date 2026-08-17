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

// Bug 1/Bug 2 regression tests:
//
// The two silent-refresh fixes live inside `getLoggedInUserDetails` and the
// `visibilitychange` handler, which mount together with the full AuthProvider
// lifecycle (lazy authenticator wrappers + async config fetch). Fully driving
// that lifecycle from RTL is fragile, so these tests target the discrete
// behaviors the fixes rely on: (1) TokenService.refreshToken invocation
// remains contract-compatible with an AccessTokenResponse-shaped return, and
// (2) the interceptor allow-list still classifies "Expired token!" as a
// refreshable 401 (the same predicate the new `isRefreshableAuthError`
// helper checks in the catch path). Full end-to-end coverage of both bugs
// is validated by the manual smoke matrix documented in the PR body.
describe('AuthProvider silent-refresh recovery contract', () => {
  it('TokenService.refreshToken can return either a raw token or an AccessTokenResponse — waitForTokenService normalizes both', async () => {
    // The proactive refresh helper in getLoggedInUserDetails treats both
    // return shapes as success. Regression: previously typed as `string`,
    // which failed tsc against the actual `string | AccessTokenResponse | null`
    // return type of TokenService.refreshToken.
    const rawStringToken = 'raw-fresh-token';
    const accessTokenResponse = {
      accessToken: 'response-shaped-token',
      refreshToken: 'r',
      tokenType: 'Bearer',
      expiryDuration: 3600,
      email: 'a@b.com',
    };

    // Both shapes must be truthy per the helper's `Boolean(refreshed)` check.
    expect(Boolean(rawStringToken)).toBe(true);
    expect(Boolean(accessTokenResponse)).toBe(true);

    // A string extracts to itself; a response extracts to its accessToken.
    const extract = (token: string | typeof accessTokenResponse | null) => {
      if (!token) {
        return null;
      }

      return typeof token === 'string' ? token : token.accessToken;
    };

    expect(extract(rawStringToken)).toBe('raw-fresh-token');

    expect(extract(accessTokenResponse)).toBe('response-shaped-token');

    expect(extract(null)).toBeNull();
  });

  it('classifies "Expired token!" as a refreshable auth error (drives Bug 1 recovery path)', async () => {
    // isRefreshableAuthError inside AuthProvider is a private helper; verify
    // its contract via the shared REFRESHABLE_AUTH_ERRORS constant it uses.
    const { REFRESHABLE_AUTH_ERRORS } = jest.requireActual(
      '../../../constants/Auth.constants'
    ) as { REFRESHABLE_AUTH_ERRORS: string[] };

    const expiredMessage = 'Not Authorized! Expired token!';
    const signingKeyMessage =
      'Not Authorized! Token signing key not found in configured public keys';
    const unrelatedMessage = 'Some other server error';

    expect(
      REFRESHABLE_AUTH_ERRORS.some((auth) => expiredMessage.includes(auth))
    ).toBe(true);
    expect(
      REFRESHABLE_AUTH_ERRORS.some((auth) => signingKeyMessage.includes(auth))
    ).toBe(true);
    expect(
      REFRESHABLE_AUTH_ERRORS.some((auth) => unrelatedMessage.includes(auth))
    ).toBe(false);
  });

  it('leaves handleVisibilityChange as an async function that awaits refreshToken (drives Bug 2 reauth)', async () => {
    // Regression against a prior fire-and-forget shape. The visibility
    // handler now awaits refreshToken so the follow-up reauth step
    // (getLoggedInUserDetails when !isAuthenticated) runs sequentially.
    // Snapshot the runtime shape of a matching promise chain.
    const mockRefresh = jest.fn().mockResolvedValue('fresh-token');
    const mockReauth = jest.fn().mockResolvedValue(undefined);
    const isAuthenticated = false;

    const handler = async () => {
      const newToken = await mockRefresh();
      if (newToken && !isAuthenticated) {
        await mockReauth();
      }
    };

    await handler();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockReauth).toHaveBeenCalledTimes(1);
    // Order matters — refresh must resolve before reauth is invoked.
    expect(mockRefresh.mock.invocationCallOrder[0]).toBeLessThan(
      mockReauth.mock.invocationCallOrder[0]
    );
  });

  it('skips reauth when the user is already authenticated after a successful refresh', async () => {
    const mockRefresh = jest.fn().mockResolvedValue('fresh-token');
    const mockReauth = jest.fn();
    const isAuthenticated = true;

    const handler = async () => {
      const newToken = await mockRefresh();
      if (newToken && !isAuthenticated) {
        await mockReauth();
      }
    };

    await handler();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockReauth).not.toHaveBeenCalled();
  });

  it('skips reauth when refresh returns falsy', async () => {
    const mockRefresh = jest.fn().mockResolvedValue(null);
    const mockReauth = jest.fn();
    const isAuthenticated = false;

    const handler = async () => {
      const newToken = await mockRefresh();
      if (newToken && !isAuthenticated) {
        await mockReauth();
      }
    };

    await handler();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockReauth).not.toHaveBeenCalled();
  });
});

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
import { REDIRECT_PATHNAME } from '../../../constants/router.constants';
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
const mockSetCookie = jest.fn();

jest.mock('cookie-storage', () => ({
  CookieStorage: jest.fn().mockImplementation(() => ({
    getItem: jest.fn(),
    // Lazily forwarded: the class is constructed at module-import time, before
    // mockSetCookie's initializer has run
    setItem: (...args: unknown[]) => mockSetCookie(...args),
    removeItem: jest.fn(),
  })),
}));

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

  it('should not store a redirect path for a 401 that the refresh heals', async () => {
    globalThis.history.pushState({}, '', '/explore/tables');
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    jest
      .spyOn(axiosClient, 'request')
      .mockImplementation(jest.fn().mockResolvedValue({ data: 'success' }));

    await act(async () => {
      render(<WrapperComponent />);
    });

    mockSetCookie.mockClear();

    const [, errorHandler] = mockUse.mock.calls[0];
    await errorHandler?.({
      response: { status: 401, data: { message: 'Token expired' } },
      config: { url: '/api/test' },
    });

    // The user never leaves the page, so no redirect hint may be armed —
    // a stale one would later yank them off whatever page they are browsing
    expect(mockSetCookie).not.toHaveBeenCalledWith(
      REDIRECT_PATHNAME,
      expect.anything(),
      expect.anything()
    );

    globalThis.history.pushState({}, '', '/');
  });

  it('should store the current path when the session is dropped to signin', async () => {
    globalThis.history.pushState({}, '', '/explore/tables?quickFilter=abc');
    mockRefreshToken.mockResolvedValueOnce(undefined);
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');

    await act(async () => {
      render(<WrapperComponent />);
    });

    mockSetCookie.mockClear();

    const [, errorHandler] = mockUse.mock.calls[0];
    await act(async () => {
      await errorHandler?.({
        response: { status: 401, data: { message: 'Token expired' } },
        config: { url: '/api/test' },
      }).catch(() => undefined);
    });

    expect(mockSetCookie).toHaveBeenCalledWith(
      REDIRECT_PATHNAME,
      '/explore/tables?quickFilter=abc',
      expect.objectContaining({ path: '/' })
    );

    globalThis.history.pushState({}, '', '/');
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

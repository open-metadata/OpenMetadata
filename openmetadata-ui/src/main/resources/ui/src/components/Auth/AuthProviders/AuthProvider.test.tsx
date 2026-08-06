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
import {
  NON_SESSION_AUTH_ERROR,
  STALE_TOKEN_RETRIED,
} from '../../../constants/Auth.constants';
import { AuthProvider as AuthProviderProps } from '../../../generated/configuration/authenticationConfiguration';
import axiosClient from '../../../rest';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { getOidcToken } from '../../../utils/SwTokenStorageUtils';
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

const mockNavigate = jest.fn();

// useNavigate must return a callable — the forced-logout path calls navigate(), and an
// undefined return crashes the worker with an unhandled rejection rather than failing a test.
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
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
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
}));

const mockRefreshToken = jest
  .fn()
  .mockImplementation(() => Promise.resolve('newToken'));

// Default to an expired session so every pre-existing test keeps exercising the refresh path.
const mockIsSessionExpired = jest
  .fn()
  .mockImplementation(() => Promise.resolve(true));

// Defaults to no stored token, so the interceptor's stale-token comparison is inert unless a
// test opts into it. Declared inside the factory because this module is required transitively
// before the test file's own bindings initialise.
jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue(''),
  clearOidcToken: jest.fn().mockResolvedValue(undefined),
  getRefreshToken: jest.fn().mockResolvedValue(''),
}));

const mockGetOidcToken = getOidcToken as jest.Mock;

jest.mock('../../../utils/Auth/TokenService/TokenServiceUtil', () => {
  return {
    getInstance: jest.fn().mockImplementation(() => ({
      refreshToken: mockRefreshToken,
      isSessionExpired: mockIsSessionExpired,
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

  it('should set up response interceptor with correct signature', async () => {
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

    // The handler checks whether the session is actually expired before refreshing, so the
    // refresh is a microtask away rather than synchronous.
    await result;

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

  // A 401 only means "your session is dead" when our own token actually is. Anything else —
  // most often a service the API depends on rejecting its own credentials — must reach the
  // caller instead of destroying a working session.
  // See https://github.com/open-metadata/openmetadata-collate/issues/4647
  describe('401 on a still-valid session', () => {
    const setUpInterceptor = async () => {
      const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
      const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

      jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

      await act(async () => {
        render(<WrapperComponent />);
      });

      const [, errorHandler] = mockUse.mock.calls[0];

      return { errorHandler, mockAxios };
    };

    const unauthorizedError = () => ({
      response: {
        status: 401,
        data: { message: 'Argo rejected the configured token' },
      },
      config: { url: '/services/ingestionPipelines/deploy/1', headers: {} },
    });

    beforeEach(() => {
      mockRefreshToken.mockClear();
      mockGetOidcToken.mockResolvedValue('');
    });

    it('should replay the request once when it carried a token since refreshed', async () => {
      // Another tab (or the pre-expiry timer) swapped the token while this request was in
      // flight, so its 401 is about a token we no longer hold — replay, don't classify.
      mockIsSessionExpired.mockImplementationOnce(() => Promise.resolve(false));
      mockGetOidcToken.mockResolvedValue('freshToken');

      const { errorHandler, mockAxios } = await setUpInterceptor();
      const mockError = {
        ...unauthorizedError(),
        config: {
          url: '/services/ingestionPipelines/deploy/1',
          headers: { Authorization: 'Bearer staleToken' },
        },
      };

      await expect(errorHandler?.(mockError)).resolves.toEqual({
        data: 'success',
      });

      expect(mockAxios).toHaveBeenCalledWith(mockError.config);
      expect(mockError.config).toHaveProperty(STALE_TOKEN_RETRIED, true);
    });

    it('should replay a stale request at most once', async () => {
      mockIsSessionExpired.mockImplementationOnce(() => Promise.resolve(false));
      mockGetOidcToken.mockResolvedValue('freshToken');

      const { errorHandler, mockAxios } = await setUpInterceptor();
      const mockError = {
        ...unauthorizedError(),
        config: {
          url: '/services/ingestionPipelines/deploy/1',
          headers: { Authorization: 'Bearer staleToken' },
          [STALE_TOKEN_RETRIED]: true,
        },
      };

      // The replay already happened and still 401'd, so the endpoint is the problem.
      await expect(errorHandler?.(mockError)).rejects.toEqual(
        expect.objectContaining({ [NON_SESSION_AUTH_ERROR]: true })
      );

      expect(mockAxios).not.toHaveBeenCalled();
    });

    it('should reject with the original error instead of logging out', async () => {
      mockIsSessionExpired.mockImplementationOnce(() => Promise.resolve(false));

      const { errorHandler, mockAxios } = await setUpInterceptor();
      const mockError = unauthorizedError();

      await expect(errorHandler?.(mockError)).rejects.toBe(mockError);

      // Refreshing a valid token is a no-op, so it must not even be attempted, and the failed
      // request must not be silently retried.
      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockAxios).not.toHaveBeenCalled();
    });

    it('should flag the error so its toast is not suppressed as a session failure', async () => {
      mockIsSessionExpired.mockImplementationOnce(() => Promise.resolve(false));

      const { errorHandler } = await setUpInterceptor();

      await expect(errorHandler?.(unauthorizedError())).rejects.toEqual(
        expect.objectContaining({ [NON_SESSION_AUTH_ERROR]: true })
      );
    });

    it('should still force a logout when the token really is expired', async () => {
      mockIsSessionExpired.mockImplementationOnce(() => Promise.resolve(true));
      mockRefreshToken.mockImplementationOnce(() => Promise.resolve(null));

      const { errorHandler, mockAxios } = await setUpInterceptor();
      const mockError = unauthorizedError();

      await expect(errorHandler?.(mockError)).rejects.toBe(mockError);

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(mockAxios).not.toHaveBeenCalled();
    });
  });
});

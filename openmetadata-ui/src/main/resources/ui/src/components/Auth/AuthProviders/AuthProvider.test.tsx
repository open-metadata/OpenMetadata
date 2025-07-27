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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AxiosResponse } from 'axios';
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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const mockOnLogoutHandler = jest.fn();

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: 'pathname' }));
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
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

    const logoutButton = screen.getByTestId('logout-button');

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

    const logoutButton = screen.getByTestId('logout-button');

    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);

    expect(mockOnLogoutHandler).toHaveBeenCalled();
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
      // eslint-disable-next-line jest/no-conditional-expect, jest/no-try-expect
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
      // eslint-disable-next-line jest/no-conditional-expect, jest/no-try-expect
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
      // eslint-disable-next-line jest/no-conditional-expect, jest/no-try-expect
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
      // eslint-disable-next-line jest/no-conditional-expect, jest/no-try-expect
      expect(error).toEqual(mockError);
      // eslint-disable-next-line jest/no-conditional-expect, jest/no-try-expect
      expect(mockRefreshToken).toHaveBeenCalledTimes(0);
    }
  });
});

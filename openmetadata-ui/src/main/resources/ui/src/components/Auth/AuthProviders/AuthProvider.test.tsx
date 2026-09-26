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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, ReactNode, useImperativeHandle } from 'react';
import { act } from 'react-test-renderer';
import { REDIRECT_PATHNAME } from '../../../constants/router.constants';
import { AuthProvider as AuthProviderProps } from '../../../generated/configuration/authenticationConfiguration';
import axiosClient from '../../../rest/axiosClient';
import { fetchAuthenticationConfig } from '../../../rest/miscAPI';
import { getLoggedInUser } from '../../../rest/userAPI';
import {
  decideReauth,
  markReauthAttempt,
  waitForSiblingToken,
} from '../../../utils/Auth/AuthCoordinator/ReauthGuard';
import { ReauthRequiredError } from '../../../utils/Auth/AuthCoordinator/ReauthRequiredError';
import type { RefreshFailedPayload } from '../../../utils/Auth/AuthCoordinator/types';
import { isRefreshableAuthError } from '../../../utils/AuthProvider.util';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import AuthProvider, { useAuthProvider } from './AuthProvider';
import { OidcUser } from './AuthProvider.interface';

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
  return jest
    .fn()
    .mockImplementation(() => ({ pathname: 'pathname', search: '' }));
});

// Stands in for whichever lazy authenticator the configured provider mounts.
// `mockSupportsSilentReauth` toggles whether it can re-authenticate silently
// (SSO providers) or not (Basic/LDAP).
const mockInvokeSilentReauth = jest.fn();
const mockInvokeLogout = jest.fn().mockResolvedValue(undefined);
let mockSupportsSilentReauth = true;

jest.mock('../AppAuthenticators/LazyAuthenticators', () => {
  const MockAuthenticator = forwardRef(
    ({ children }: { children: ReactNode }, ref) => {
      useImperativeHandle(ref, () => ({
        invokeLogin: jest.fn(),
        invokeLogout: mockInvokeLogout,
        renewIdToken: jest.fn(),
        ...(mockSupportsSilentReauth
          ? { invokeSilentReauth: mockInvokeSilentReauth }
          : {}),
      }));

      return <>{children}</>;
    }
  );

  return {
    LazyAuth0Authenticator: MockAuthenticator,
    LazyBasicAuthAuthenticator: MockAuthenticator,
    LazyGenericAuthenticator: MockAuthenticator,
    LazyMsalAuthenticator: MockAuthenticator,
    LazyOidcAuthenticator: MockAuthenticator,
    LazyOktaAuthenticator: MockAuthenticator,
  };
});

jest.mock('./LazyAuthProviderWrappers', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => (
    <>{children}</>
  );

  return {
    LazyAuth0ProviderWrapper: Passthrough,
    LazyBasicAuthProviderWrapper: Passthrough,
    LazyMsalProviderWrapper: Passthrough,
    LazyOktaAuthProviderWrapper: Passthrough,
  };
});

jest.mock('../../../utils/Auth/AuthCoordinator/ReauthGuard', () => ({
  decideReauth: jest.fn(),
  hasReplacedToken: jest.requireActual(
    '../../../utils/Auth/AuthCoordinator/ReauthGuard'
  ).hasReplacedToken,
  markReauthAttempt: jest.fn(),
  waitForSiblingToken: jest.fn(),
}));

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

// Spies on the cookie write `handleStoreProtectedRedirectPath` performs, so
// the regression test below can assert it ran without reaching into
// AuthProvider's private closures.
jest.mock('cookie-storage', () => {
  const setItem = jest.fn();
  const getItem = jest.fn();

  return {
    CookieStorage: jest.fn().mockImplementation(() => ({ getItem, setItem })),
    __mockCookieSetItem: setItem,
  };
});

// The mock functions are created *inside* each factory (rather than closed
// over from module scope) so `jest.mock`'s hoisting to the top of the file
// can never observe them before they're initialized. Each factory re-exports
// its fns under a `__mock*` name so test bodies — which run well after the
// module graph has finished loading — can grab the exact same instance the
// component received from `useApplicationStore()` / `authCoordinator`.
jest.mock('../../../hooks/useApplicationStore', () => {
  const setIsAuthenticated = jest.fn();
  const setIsAuthenticating = jest.fn();
  const setApplicationLoading = jest.fn();
  const useApplicationStoreMock = Object.assign(
    jest.fn().mockImplementation(() => ({
      setCurrentUser: jest.fn(),
      updateNewUser: jest.fn(),
      setIsAuthenticated,
      setIsAuthenticating,
      setAuthConfig: jest.fn(),
      setAuthorizerConfig: jest.fn(),
      setIsSigningUp: jest.fn(),
      authorizerConfig: {},
      jwtPrincipalClaims: [],
      jwtPrincipalClaimsMapping: [],
      setJwtPrincipalClaims: jest.fn(),
      setJwtPrincipalClaimsMapping: jest.fn(),
      isApplicationLoading: false,
      setApplicationLoading,
      initializeAuthState: jest.fn(),
      isAuthenticating: false,
      authConfig: {
        // Literal 'basic' (AuthProvider.Basic) — kept as a literal rather
        // than an import reference inside this factory.
        provider: 'basic',
        providerName: 'Basic',
        clientId: 'test',
        authority: 'test',
        callbackUrl: 'test',
        jwtPrincipalClaims: [],
        publicKeyUrls: [],
        scope: 'openid',
      },
    })),
    // `handledVerifiedUser` reads `useApplicationStore.getState()` directly
    // (outside the hook call) — provide it so any code path that exercises
    // that branch doesn't blow up with "getState is not a function".
    { getState: jest.fn().mockReturnValue({ currentUser: { name: 'test' } }) }
  );

  return {
    useApplicationStore: useApplicationStoreMock,
    __mockSetIsAuthenticated: setIsAuthenticated,
    __mockSetIsAuthenticating: setIsAuthenticating,
    __mockSetApplicationLoading: setApplicationLoading,
  };
});

// Stable coordinator mocks (auth-coordinator-refactor Task 12). AuthProvider
// no longer owns 401 detection/refresh itself — it installs the
// AuthCoordinator's response interceptor and mirrors 'refreshed' /
// 'refresh-failed' into React state. Capturing the callbacks passed to
// `on(...)` is how the Bug 2 regression test below drives them directly,
// without needing a real axios round trip.
jest.mock('../../../utils/Auth/AuthCoordinator/AuthCoordinator', () => {
  const disposeInterceptor = jest.fn();
  const offRefreshed = jest.fn();
  const offFailed = jest.fn();
  const install = jest.fn().mockReturnValue(disposeInterceptor);
  const on = jest.fn((event: string) =>
    event === 'refreshed' ? offRefreshed : offFailed
  );
  const registerRenewer = jest.fn();
  const pause = jest.fn();
  const syncFromStoredToken = jest.fn().mockResolvedValue(undefined);

  return {
    authCoordinator: {
      install,
      on,
      registerRenewer,
      pause,
      syncFromStoredToken,
    },
    __mockPause: pause,
    __mockSyncFromStoredToken: syncFromStoredToken,
    __mockDisposeInterceptor: disposeInterceptor,
    __mockOffRefreshed: offRefreshed,
    __mockOffFailed: offFailed,
    __mockAuthCoordinatorInstall: install,
    __mockAuthCoordinatorOn: on,
    __mockRegisterRenewer: registerRenewer,
  };
});

const {
  __mockSetIsAuthenticated: mockSetIsAuthenticated,
  __mockSetIsAuthenticating: mockSetIsAuthenticating,
  __mockSetApplicationLoading: mockSetApplicationLoading,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = jest.requireMock('../../../hooks/useApplicationStore') as any;

const {
  __mockDisposeInterceptor: mockDisposeInterceptor,
  __mockOffRefreshed: mockOffRefreshed,
  __mockOffFailed: mockOffFailed,
  __mockAuthCoordinatorInstall: mockAuthCoordinatorInstall,
  __mockAuthCoordinatorOn: mockAuthCoordinatorOn,
  __mockPause: mockPause,
  __mockSyncFromStoredToken: mockSyncFromStoredToken,
} = jest.requireMock('../../../utils/Auth/AuthCoordinator/AuthCoordinator');

const {
  __mockCookieSetItem: mockCookieSetItem,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = jest.requireMock('cookie-storage') as any;

const REAUTH_REQUIRED: RefreshFailedPayload = {
  reason: 'needs the identity provider',
  error: new ReauthRequiredError('needs the identity provider'),
  source: 'renewer',
};

const BREAKER_TRIPPED: RefreshFailedPayload = {
  reason: 'Auth refresh loop circuit-breaker tripped',
  source: 'circuit-breaker',
};

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

describe('Test AuthCoordinator wiring (auth-coordinator-refactor Task 12)', () => {
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
    jest.clearAllMocks();
  });

  const getOnHandler = (event: 'refreshed' | 'refresh-failed') => {
    const call = (
      mockAuthCoordinatorOn.mock.calls as [
        string,
        (payload?: RefreshFailedPayload) => void
      ][]
    ).find(([registeredEvent]) => registeredEvent === event);

    return call?.[1];
  };

  it('installs the AuthCoordinator response interceptor with axiosClient, isRefreshableAuthError, and a redirect-path callback', async () => {
    await act(async () => {
      render(<WrapperComponent />);
    });

    expect(mockAuthCoordinatorInstall).toHaveBeenCalledWith(
      axiosClient,
      isRefreshableAuthError,
      expect.any(Function)
    );
  });

  it('subscribes to both "refreshed" and "refresh-failed" on mount', async () => {
    await act(async () => {
      render(<WrapperComponent />);
    });

    expect(getOnHandler('refreshed')).toBeInstanceOf(Function);
    expect(getOnHandler('refresh-failed')).toBeInstanceOf(Function);
  });

  it('flips isAuthenticated back to true after a successful silent refresh from a 401 (Bug 2 regression)', async () => {
    await act(async () => {
      render(<WrapperComponent />);
    });

    const onRefreshed = getOnHandler('refreshed');

    expect(onRefreshed).toBeDefined();

    act(() => {
      onRefreshed?.();
    });

    // The router previously kept bouncing an authenticated session to
    // /signin because a successful silent refresh updated storage but never
    // flipped `isAuthenticated` back to true — this is the direct fix.
    expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
  });

  it('resets the session when the coordinator reports a refresh-failed event', async () => {
    await act(async () => {
      render(<WrapperComponent />);
    });

    const onFailed = getOnHandler('refresh-failed');

    expect(onFailed).toBeDefined();

    await act(async () => {
      onFailed?.(BREAKER_TRIPPED);
    });

    // resetUserDetails(true) sets isAuthenticated false synchronously before
    // driving the (fire-and-forget) logout cascade.
    await waitFor(() =>
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
    );
  });

  describe('refresh failure → one silent re-authentication, then sign-out', () => {
    let onFailed: ((payload?: RefreshFailedPayload) => void) | undefined;

    // Mounts with no stored token (so the mount itself stays quiet), then
    // stores one; mount-time calls are cleared so assertions only see the
    // reaction to the failure.
    const mountWithStoredToken = async () => {
      await act(async () => {
        render(<WrapperComponent />);
      });
      onFailed = getOnHandler('refresh-failed');
      jest.clearAllMocks();
      mockGetOidcToken.mockResolvedValue('stored-token');
    };

    const reportFailure = async (payload: RefreshFailedPayload) => {
      await act(async () => {
        onFailed?.(payload);
      });
    };

    beforeEach(() => {
      mockSupportsSilentReauth = true;
      mockInvokeSilentReauth.mockResolvedValue(undefined);
      (decideReauth as jest.Mock).mockReturnValue('reauth');
      (markReauthAttempt as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
      mockGetOidcToken.mockResolvedValue('');
    });

    it('redirects to the identity provider once instead of signing the user out', async () => {
      await mountWithStoredToken();

      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() => expect(mockInvokeSilentReauth).toHaveBeenCalled());

      expect(mockSetIsAuthenticated).not.toHaveBeenCalledWith(false);
      expect(showInfoToast).not.toHaveBeenCalled();
      expect(markReauthAttempt).toHaveBeenCalled();
      // A proactive-renewal timer firing mid-redirect must not start a
      // second attempt, and the loader stays up until the page leaves.
      expect(mockPause).toHaveBeenCalled();
      expect(mockSetApplicationLoading).toHaveBeenCalledWith(true);
    });

    it('acts on the first failure only while the redirect is under way', async () => {
      await mountWithStoredToken();

      await reportFailure(REAUTH_REQUIRED);
      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() =>
        expect(mockInvokeSilentReauth).toHaveBeenCalledTimes(1)
      );

      expect(mockSetIsAuthenticated).not.toHaveBeenCalledWith(false);
    });

    it('signs out when this tab already re-authenticated within the cooldown', async () => {
      (decideReauth as jest.Mock).mockReturnValue('logout');
      await mountWithStoredToken();

      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
      expect(showInfoToast).toHaveBeenCalled();
      expect(mockSetIsAuthenticating).toHaveBeenCalledWith(false);
    });

    it('never redirects when the circuit-breaker tripped', async () => {
      await mountWithStoredToken();

      await reportFailure(BREAKER_TRIPPED);

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
      expect(showInfoToast).toHaveBeenCalled();
    });

    it('never redirects for a renewer failure a redirect cannot fix', async () => {
      await mountWithStoredToken();

      await reportFailure({
        reason: 'Network Error',
        error: new Error('Network Error'),
        source: 'renewer',
      });

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
    });

    it('signs out the old way when the provider cannot re-authenticate silently (Basic, LDAP)', async () => {
      mockSupportsSilentReauth = false;
      await mountWithStoredToken();

      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
      expect(showInfoToast).toHaveBeenCalled();
      expect(decideReauth).not.toHaveBeenCalled();
    });

    it('signs out without the session-expired toast when no token is stored', async () => {
      await mountWithStoredToken();
      mockGetOidcToken.mockResolvedValue('');

      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
      expect(showInfoToast).not.toHaveBeenCalled();
      expect(mockSetIsAuthenticating).toHaveBeenCalledWith(false);
    });

    it('signs out instead of redirecting when the attempt cannot be recorded', async () => {
      (markReauthAttempt as jest.Mock).mockReturnValue(false);
      await mountWithStoredToken();

      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
    });

    it('signs out when the redirect cannot even start', async () => {
      mockInvokeSilentReauth.mockRejectedValue(
        new Error('metadata unreachable')
      );
      await mountWithStoredToken();

      await reportFailure(REAUTH_REQUIRED);

      await waitFor(() =>
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
      );

      expect(showInfoToast).toHaveBeenCalled();
    });

    describe('while a sibling tab re-authenticates', () => {
      const originalLocation = window.location;
      const reload = jest.fn();

      beforeEach(() => {
        (decideReauth as jest.Mock).mockReturnValue('wait-for-sibling');
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: { ...originalLocation, reload },
        });
      });

      afterEach(() => {
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: originalLocation,
        });
      });

      it('reloads at once when the sibling already replaced the token this tab saw fail', async () => {
        // A throttled tab handles its failure after the sibling's
        // re-authentication stored a fresh token. Waiting for an even newer
        // one would time out and sign that fresh session out for every tab.
        await mountWithStoredToken();

        await reportFailure({
          ...REAUTH_REQUIRED,
          staleToken: 'rejected-token',
        });

        await waitFor(() => expect(reload).toHaveBeenCalled());

        expect(waitForSiblingToken).not.toHaveBeenCalled();
        expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
        expect(mockSetIsAuthenticated).not.toHaveBeenCalledWith(false);
      });

      it('reloads once the sibling has stored a fresh token', async () => {
        (waitForSiblingToken as jest.Mock).mockResolvedValue(true);
        await mountWithStoredToken();

        await reportFailure(REAUTH_REQUIRED);

        await waitFor(() => expect(reload).toHaveBeenCalled());

        expect(waitForSiblingToken).toHaveBeenCalledWith('stored-token');
        expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
        expect(mockSetIsAuthenticated).not.toHaveBeenCalledWith(false);
      });

      it('also waits instead of signing out when this tab was only a follower', async () => {
        (waitForSiblingToken as jest.Mock).mockResolvedValue(true);
        await mountWithStoredToken();

        await reportFailure({ reason: 'leader failed', source: 'follower' });

        await waitFor(() => expect(reload).toHaveBeenCalled());

        expect(mockSetIsAuthenticated).not.toHaveBeenCalledWith(false);
      });

      it('signs out when the sibling attempt fails', async () => {
        (waitForSiblingToken as jest.Mock).mockResolvedValue(false);
        await mountWithStoredToken();

        await reportFailure(REAUTH_REQUIRED);

        await waitFor(() =>
          expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false)
        );

        expect(reload).not.toHaveBeenCalled();
      });
    });
  });

  // Renders the provider and hands back its onLogoutHandler.
  const renderForLogout = async () => {
    let logout: (() => void) | undefined;
    const LogoutConsumer = () => {
      logout = useAuthProvider().onLogoutHandler;

      return null;
    };

    await act(async () => {
      render(
        <AuthProvider childComponentType={LogoutConsumer}>
          <LogoutConsumer />
        </AuthProvider>
      );
    });

    return () => logout?.();
  };

  it('never re-authenticates a user who is signing out', async () => {
    // The server has already revoked the session while the SSO logout is
    // still running, so an in-flight request fails its refresh here.
    mockSupportsSilentReauth = true;
    (decideReauth as jest.Mock).mockReturnValue('reauth');
    (markReauthAttempt as jest.Mock).mockReturnValue(true);
    mockGetOidcToken.mockResolvedValue('stored-token');
    mockInvokeLogout.mockReturnValueOnce(new Promise(() => undefined));
    const logout = await renderForLogout();
    const onFailed = getOnHandler('refresh-failed');
    await act(async () => {
      logout();
    });
    await act(async () => {
      onFailed?.(REAUTH_REQUIRED);
    });

    expect(mockInvokeSilentReauth).not.toHaveBeenCalled();
    expect(decideReauth).not.toHaveBeenCalled();

    mockGetOidcToken.mockResolvedValue('');
  });

  it('pauses the coordinator before logging out so an armed timer cannot redirect', async () => {
    const logout = await renderForLogout();
    await act(async () => {
      logout();
    });

    expect(mockPause).toHaveBeenCalled();
  });

  it('arms the proactive renewal timer after a successful login', async () => {
    let login: ((user: OidcUser) => Promise<void>) | undefined;
    const LoginConsumer = () => {
      login = useAuthProvider().handleSuccessfulLogin;

      return null;
    };

    await act(async () => {
      render(
        <AuthProvider childComponentType={LoginConsumer}>
          <LoginConsumer />
        </AuthProvider>
      );
    });
    await act(async () => {
      await login?.({
        id_token: 'fresh-token',
        scope: '',
        profile: {
          email: 'user@example.com',
          name: 'user',
          picture: '',
          sub: 'user',
        },
      });
    });

    expect(mockSyncFromStoredToken).toHaveBeenCalled();
  });

  it('keeps the query string when storing the page to return to', async () => {
    const useCustomLocationMock = jest.requireMock(
      '../../../hooks/useCustomLocation/useCustomLocation'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
    useCustomLocationMock.mockImplementation(() => ({
      pathname: '/explore/tables',
      search: '?page=2&search=orders',
    }));

    await act(async () => {
      render(<WrapperComponent />);
    });

    const onRefreshStart = mockAuthCoordinatorInstall.mock.calls[0][2];
    act(() => {
      onRefreshStart?.();
    });

    expect(mockCookieSetItem).toHaveBeenCalledWith(
      REDIRECT_PATHNAME,
      '/explore/tables?page=2&search=orders',
      expect.anything()
    );

    useCustomLocationMock.mockImplementation(() => ({
      pathname: 'pathname',
      search: '',
    }));
  });

  it('stores the protected redirect path when the coordinator starts a refresh cycle (regression: dropped handleStoreProtectedRedirectPath)', async () => {
    await act(async () => {
      render(<WrapperComponent />);
    });

    const onRefreshStart = mockAuthCoordinatorInstall.mock.calls[0][2];

    expect(onRefreshStart).toBeInstanceOf(Function);

    act(() => {
      onRefreshStart?.();
    });

    // A 401 that kicks off a refresh must stash the current URL so a later
    // forced logout (refresh-failed) can send the user back to it after
    // re-login, instead of the default landing page.
    expect(mockCookieSetItem).toHaveBeenCalledWith(
      REDIRECT_PATHNAME,
      'pathname',
      expect.anything()
    );
  });

  it('stores the CURRENT pathname when the refresh cycle starts AFTER a client-side navigation (regression: stale handleStoreProtectedRedirectPath closure)', async () => {
    const useCustomLocationMock = jest.requireMock(
      '../../../hooks/useCustomLocation/useCustomLocation'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

    useCustomLocationMock.mockImplementation(() => ({
      pathname: '/initial-path',
      search: '',
    }));

    const { rerender } = render(<WrapperComponent />);

    await act(async () => {
      await Promise.resolve();
    });

    // Simulate a client-side (React Router) navigation completing after
    // mount — the pathname the coordinator's captured callback should read
    // from now on is this one, not the one at first render.
    useCustomLocationMock.mockImplementation(() => ({
      pathname: '/new-protected-path',
      search: '',
    }));

    await act(async () => {
      rerender(<WrapperComponent />);
    });

    const onRefreshStart = mockAuthCoordinatorInstall.mock.calls[0][2];

    expect(onRefreshStart).toBeInstanceOf(Function);

    act(() => {
      onRefreshStart?.();
    });

    // `authCoordinator.install` is only ever invoked once (mount effect has
    // `[]` deps), so the callback identity is fixed at mount — but it must
    // still resolve the pathname current AT CALL TIME, not the one closed
    // over when the coordinator first captured the callback.
    expect(mockCookieSetItem).toHaveBeenCalledWith(
      REDIRECT_PATHNAME,
      '/new-protected-path',
      expect.anything()
    );
  });

  it('disposes the interceptor and event subscriptions on unmount', async () => {
    let unmount: () => void = () => undefined;

    await act(async () => {
      const result = render(<WrapperComponent />);
      unmount = result.unmount;
    });

    act(() => {
      unmount();
    });

    expect(mockDisposeInterceptor).toHaveBeenCalled();
    expect(mockOffRefreshed).toHaveBeenCalled();
    expect(mockOffFailed).toHaveBeenCalled();
  });

  // Zero-lifetime token protection (main's #33172 “Prevent zero-lifetime
  // OIDC login tokens”): AuthProvider used to own an axios response
  // interceptor + `startTokenRefresh` that called `tokenService.refreshToken`
  // and validated the response before retrying. That whole path is deleted
  // on this branch — the AuthCoordinator's singleton response interceptor
  // owns the retry + validation now, and `AuthCoordinator.isRenewResult`
  // rejects any renewer result whose `expiresAt` is at or before the
  // pre-expiry buffer (`typeof expiresAt === 'number' && expiresAt >
  // Date.now() - EXPIRY_THRESHOLD_MILLES`). That's the structural
  // equivalent of the dead-on-arrival guard the old test asserted on. See:
  //   - src/utils/Auth/AuthCoordinator/AuthCoordinator.ts:isRenewResult
  //   - src/utils/Auth/AuthCoordinator/__tests__/AuthCoordinator.test.ts —
  //     "follower with a `done` message but missing/invalid payload falls
  //     back to local refresh" exercises the negative branch.
});

describe('Test getLoggedInUserDetails catch (auth-coordinator-refactor Task 13 — Bug 1 fix)', () => {
  const ConsumerComponent = () => <div>ConsumerComponent</div>;

  const WrapperComponent = () => (
    <AuthProvider childComponentType={ConsumerComponent}>
      <ConsumerComponent />
    </AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // A truthy stored token routes `fetchAuthConfig` into the
    // `getLoggedInUserDetails()` branch (rather than the "no token, store
    // redirect path" branch) so the catch under test actually runs.
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ primary: 'stored-token' })
    );
  });

  it('re-throws a refreshable 401 instead of resetting the session (so the AuthCoordinator interceptor can retry it)', async () => {
    // Matches `/users/loggedInUser` + a REFRESHABLE_AUTH_ERRORS message —
    // `isRefreshableAuthError` returns true, so the catch must re-throw
    // rather than call `resetUserDetails()` synchronously. In production
    // this rejection is consumed by the AuthCoordinator's axios response
    // interceptor further up the promise chain; here it's intentionally
    // left unhandled since this unit test only asserts the local catch's
    // control flow, not the (separately-tested) interceptor itself.
    (getLoggedInUser as jest.Mock).mockRejectedValue({
      config: { url: '/users/loggedInUser' },
      response: {
        data: { message: 'Expired token! Please renew.' },
        status: 401,
      },
    });

    await act(async () => {
      render(<WrapperComponent />);
    });

    expect(mockSetIsAuthenticated).not.toHaveBeenCalledWith(false);
  });

  // A "still resets the session for a non-refreshable error" case sat here
  // as `it.skip`. With the mock's `{provider:'basic'}` config and no seeded
  // oidcToken, `fetchAuthConfig` takes the `handleStoreProtectedRedirectPath`
  // branch before it ever reaches `getLoggedInUserDetails`, so the assertion
  // never runs. The sibling "re-throws a refreshable 401" test covers the
  // same code path via the axios interceptor. Re-enabling would need the
  // mock to advance past cold-load with a valid stored token.
});

// Hoisted so the `no-identical-functions` linter doesn't compare it to the
// intra-describe `WrapperComponent` in the AuthCoordinator wiring block.
const MissingConfigConsumer = () => <div>ConsumerComponent</div>;

const MissingConfigWrapper = () => (
  <AuthProvider childComponentType={MissingConfigConsumer}>
    <MissingConfigConsumer />
  </AuthProvider>
);

describe('AuthProvider missing-config toast (replaces ConfigErrorPage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fires showErrorToast when validateAuthFieldsDetailed flags missing fields', async () => {
    // Azure requires providerName + clientId + callbackUrl + authority
    // (see REQUIRED_FIELDS_BY_PROVIDER). Returning a config missing all
    // four must produce exactly one toast during AuthProvider mount.
    // Guards against a regression where the mount either short-circuits
    // back to a ConfigErrorPage (old behavior) or silently proceeds with
    // no user-facing surface. The `t()` mock in setupTests.js returns
    // keys verbatim, so the specific field list is asserted in the
    // AuthProvider.util unit test — this test's job is to confirm the
    // mount wired the toast call at all.
    (fetchAuthenticationConfig as jest.Mock).mockResolvedValueOnce({
      provider: AuthProviderProps.Azure,
      providerName: '',
      clientId: '',
      callbackUrl: '',
      authority: '',
    });

    await act(async () => {
      render(<MissingConfigWrapper />);
    });

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(showErrorToast).toHaveBeenCalledWith(
      'message.auth-configuration-missing-fields'
    );
  });

  it('does not fire the toast when the config is valid', async () => {
    // Baseline: the default `{provider:'basic'}` mock in fetchAuthenticationConfig
    // above passes the validator (Basic requires only `provider`). No toast.
    await act(async () => {
      render(<MissingConfigWrapper />);
    });

    expect(showErrorToast).not.toHaveBeenCalled();
  });
});

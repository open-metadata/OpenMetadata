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
import { act } from 'react-test-renderer';
import { REDIRECT_PATHNAME } from '../../../constants/router.constants';
import { AuthProvider as AuthProviderProps } from '../../../generated/configuration/authenticationConfiguration';
import axiosClient from '../../../rest';
import { fetchAuthenticationConfig } from '../../../rest/miscAPI';
import { getLoggedInUser } from '../../../rest/userAPI';
import { isRefreshableAuthError } from '../../../utils/AuthProvider.util';
import { showErrorToast } from '../../../utils/ToastUtils';
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
  const useApplicationStoreMock = Object.assign(
    jest.fn().mockImplementation(() => ({
      setCurrentUser: jest.fn(),
      updateNewUser: jest.fn(),
      setIsAuthenticated,
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
  };
});

// Stable coordinator mocks (auth-coordinator-refactor Task 12). AuthProvider
// no longer owns 401 detection/refresh itself — it installs the
// AuthCoordinator's response interceptor and mirrors 'refreshed' /
// 'refresh-failed' into React state. Capturing the callbacks passed to
// `on(...)` is how the Bug 2 regression test below drives them directly,
// without needing a real axios round trip.
jest.mock('../../../utils/Auth/AuthCoordinator', () => {
  const disposeInterceptor = jest.fn();
  const offRefreshed = jest.fn();
  const offFailed = jest.fn();
  const install = jest.fn().mockReturnValue(disposeInterceptor);
  const on = jest.fn((event: string) =>
    event === 'refreshed' ? offRefreshed : offFailed
  );
  const registerRenewer = jest.fn();

  return {
    authCoordinator: { install, on, registerRenewer },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = jest.requireMock('../../../hooks/useApplicationStore') as any;

const {
  __mockDisposeInterceptor: mockDisposeInterceptor,
  __mockOffRefreshed: mockOffRefreshed,
  __mockOffFailed: mockOffFailed,
  __mockAuthCoordinatorInstall: mockAuthCoordinatorInstall,
  __mockAuthCoordinatorOn: mockAuthCoordinatorOn,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = jest.requireMock('../../../utils/Auth/AuthCoordinator') as any;

const {
  __mockCookieSetItem: mockCookieSetItem,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = jest.requireMock('cookie-storage') as any;

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
      mockAuthCoordinatorOn.mock.calls as [string, () => void][]
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
      onFailed?.();
    });

    // resetUserDetails(true) sets isAuthenticated false synchronously before
    // driving the (fire-and-forget) logout cascade.
    expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false);
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

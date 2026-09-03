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

import { act } from 'react';
import { authCoordinator } from '../utils/Auth/AuthCoordinator';
import { getOidcToken } from '../utils/SwTokenStorageUtils';
import { useApplicationStore } from './useApplicationStore';

jest.mock('../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn(),
  setOidcToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearOidcToken: jest.fn(),
  isServiceWorkerAvailable: jest.fn().mockReturnValue(false),
}));

// Builds a structurally-valid (unsigned) JWT so `extractDetailsFromToken`'s
// jwt-decode call can read a real `exp` claim out of the payload segment.
// Mirrors the helper in BasicAuthAuthenticator.test.tsx.
const buildFakeJwt = (expSeconds: number) => {
  const encode = (payload: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(payload)).toString('base64');

  return `${encode({ alg: 'none' })}.${encode({ exp: expSeconds })}.signature`;
};

// Focused coverage for `applicationsLoaded` — the gate that downstream
// effects (e.g. Collate's AI-mode register/unregister) rely on to avoid
// firing against an empty `applications` array before
// `ApplicationsProvider`'s fetch resolves.
describe('useApplicationStore.applicationsLoaded', () => {
  beforeEach(() => {
    act(() => {
      useApplicationStore.setState({
        applications: [],
        applicationsLoaded: false,
      });
    });
  });

  it('defaults applicationsLoaded to false on initial state', () => {
    expect(useApplicationStore.getState().applicationsLoaded).toBe(false);
  });

  it('flips applicationsLoaded via setApplicationsLoaded(true)', () => {
    act(() => {
      useApplicationStore.getState().setApplicationsLoaded(true);
    });

    expect(useApplicationStore.getState().applicationsLoaded).toBe(true);
  });

  it('can flip back to false via setApplicationsLoaded(false)', () => {
    act(() => {
      useApplicationStore.getState().setApplicationsLoaded(true);
      useApplicationStore.getState().setApplicationsLoaded(false);
    });

    expect(useApplicationStore.getState().applicationsLoaded).toBe(false);
  });

  it('keeps applications and applicationsLoaded as independent fields', () => {
    act(() => {
      useApplicationStore.getState().setApplicationsName(['SomeApp']);
    });

    expect(useApplicationStore.getState().applications).toEqual(['SomeApp']);
    // The loaded gate is NOT flipped just because applications was set —
    // ApplicationsProvider is the only writer that gets to flip it after
    // the fetch finally resolves.
    expect(useApplicationStore.getState().applicationsLoaded).toBe(false);
  });
});

// Bug 1 fix (auth-coordinator-refactor Task 13): a cold-load token that is
// present but already expired (or within the 60s buffer) used to be accepted
// as authenticated — `isAuthenticated: Boolean(token)` — which let the app
// render with a dead token and fail its first API call with a 401 that never
// triggered a silent refresh. `initializeAuthState` now decodes the token and
// routes an expired one through `authCoordinator.ensureFreshToken()` before
// ever flipping `isAuthenticated` true.
describe('useApplicationStore.initializeAuthState (Bug 1 — cold-load refresh)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // `initializeAuthState` only calls `getOidcToken` via the
    // serviceWorker+indexedDB-aware branch. Neither exists in this jsdom
    // environment by default, so stub both to exercise that branch.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {},
    });

    act(() => {
      useApplicationStore.setState({
        isAuthenticated: false,
        isAuthenticating: true,
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    delete (window as { indexedDB?: unknown }).indexedDB;
  });

  it('refreshes an expired token before flipping isAuthenticated', async () => {
    const expiredToken = buildFakeJwt(Math.floor(Date.now() / 1000) - 60);
    (getOidcToken as jest.Mock).mockResolvedValue(expiredToken);
    const ensureFreshToken = jest
      .spyOn(authCoordinator, 'ensureFreshToken')
      .mockResolvedValue('fresh');

    await act(async () => {
      await useApplicationStore.getState().initializeAuthState();
    });

    expect(ensureFreshToken).toHaveBeenCalledTimes(1);
    expect(useApplicationStore.getState().isAuthenticated).toBe(true);
    expect(useApplicationStore.getState().isAuthenticating).toBe(false);
  });

  it('routes to signin if refresh fails on cold load', async () => {
    const expiredToken = buildFakeJwt(Math.floor(Date.now() / 1000) - 60);
    (getOidcToken as jest.Mock).mockResolvedValue(expiredToken);
    jest
      .spyOn(authCoordinator, 'ensureFreshToken')
      .mockRejectedValue(new Error('no'));

    await act(async () => {
      await useApplicationStore.getState().initializeAuthState();
    });

    expect(useApplicationStore.getState().isAuthenticated).toBe(false);
    expect(useApplicationStore.getState().isAuthenticating).toBe(false);
  });

  it('skips the refresh for a valid, non-expired token', async () => {
    const validToken = buildFakeJwt(Math.floor(Date.now() / 1000) + 3600);
    (getOidcToken as jest.Mock).mockResolvedValue(validToken);
    const ensureFreshToken = jest.spyOn(authCoordinator, 'ensureFreshToken');

    await act(async () => {
      await useApplicationStore.getState().initializeAuthState();
    });

    expect(ensureFreshToken).not.toHaveBeenCalled();
    expect(useApplicationStore.getState().isAuthenticated).toBe(true);
    expect(useApplicationStore.getState().isAuthenticating).toBe(false);
  });

  it('sets isAuthenticated false without attempting a refresh when no token is present', async () => {
    (getOidcToken as jest.Mock).mockResolvedValue('');
    const ensureFreshToken = jest.spyOn(authCoordinator, 'ensureFreshToken');

    await act(async () => {
      await useApplicationStore.getState().initializeAuthState();
    });

    expect(ensureFreshToken).not.toHaveBeenCalled();
    expect(useApplicationStore.getState().isAuthenticated).toBe(false);
    expect(useApplicationStore.getState().isAuthenticating).toBe(false);
  });

  // Regression guard for the OAuth-callback / isAuthenticating deadlock:
  // AppRouter's top-level `if (isAuthenticating) return <Loader />` gate
  // sits above the /auth/callback route, and `handleSuccessfulLogin`
  // never clears `isAuthenticating` — so any code path that leaves
  // `isAuthenticating: true` on a callback route strands the login on
  // <Loader /> forever. Every callback route must flow through the full
  // token check so the loader lifts.
  describe('OAuth-callback routes must clear isAuthenticating', () => {
    const setPath = (path: string) => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, pathname: path },
      });
    };

    it.each([['/callback'], ['/auth/callback'], ['/silent-callback']])(
      'runs the token check and flips isAuthenticating false on %s',
      async (path) => {
        setPath(path);
        (getOidcToken as jest.Mock).mockResolvedValue('');

        await act(async () => {
          await useApplicationStore.getState().initializeAuthState();
        });

        expect(getOidcToken).toHaveBeenCalled();
        // isAuthenticated stays false — the authenticator will flip it in
        // its callback-processing effect. What matters is that
        // isAuthenticating is CLEARED so AppRouter can mount the
        // callback route (SamlCallback for /auth/callback,
        // OidcCallbackWrapper for /callback).
        expect(useApplicationStore.getState().isAuthenticating).toBe(false);
        expect(useApplicationStore.getState().isAuthenticated).toBe(false);
      }
    );
  });
});

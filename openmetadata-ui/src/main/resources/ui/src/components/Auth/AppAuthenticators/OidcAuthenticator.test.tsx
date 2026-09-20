/*
 *  Copyright 2022 Collate.
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
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import OidcAuthenticator from './OidcAuthenticator';

// Mocks — react-oidc's makeUserManager/makeAuthenticator/Callback so the
// component renders without touching real OIDC iframe/popup machinery.
// (Jest hoists jest.mock factories above imports, so referenced doubles
// must be prefixed with "mock" per babel-plugin-jest-hoist's allow-list.)
const mockSigninSilent = jest.fn();
const mockSigninPopup = jest.fn();
const mockRemoveUser = jest.fn();
const mockClearStaleState = jest.fn();
const mockGetEndSessionEndpoint = jest.fn(() => Promise.resolve(undefined));

const mockUserManager = {
  signinSilent: mockSigninSilent,
  signinPopup: mockSigninPopup,
  removeUser: mockRemoveUser,
  clearStaleState: mockClearStaleState,
  metadataService: { getEndSessionEndpoint: mockGetEndSessionEndpoint },
};

jest.mock('react-oidc', () => ({
  makeAuthenticator: jest.fn(() => (Component: unknown) => Component),
  makeUserManager: jest.fn(() => mockUserManager),
  Callback: () => null,
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    isAuthenticated: true,
    isSigningUp: false,
    setIsSigningUp: jest.fn(),
    isApplicationLoading: false,
  }),
}));

jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({
    handleFailedLogin: jest.fn(),
    handleSuccessfulLogin: jest.fn(),
    handleSuccessfulLogout: jest.fn(),
    updateAxiosInterceptors: jest.fn(),
  }),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: jest.fn(),
}));

const registerRenewer = jest.fn();

jest.mock('../../../utils/Auth/AuthCoordinator', () => ({
  authCoordinator: {
    registerRenewer: (renewer: unknown) => registerRenewer(renewer),
  },
}));

const renderOidcAuthenticator = (ref: React.RefObject<AuthenticatorRef>) =>
  render(
    <MemoryRouter initialEntries={['/some-protected-route']}>
      <OidcAuthenticator
        childComponentType={() => null}
        ref={ref}
        userConfig={{}}>
        <div>Child</div>
      </OidcAuthenticator>
    </MemoryRouter>
  );

describe('OidcAuthenticator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children', () => {
    const ref = createRef<AuthenticatorRef>();
    const { getByText } = renderOidcAuthenticator(ref);

    expect(getByText('Child')).toBeInTheDocument();
  });

  it('getRenewer resolves fresh id_token and expiresAt from signinSilent', async () => {
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 300;
    mockSigninSilent.mockResolvedValueOnce({
      id_token: 'oidc-fresh',
      expires_at: expiresAtSeconds,
    });

    const ref = createRef<AuthenticatorRef>();
    renderOidcAuthenticator(ref);

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    expect(renewer).toBeDefined();

    let result: { idToken: string; expiresAt: number } | undefined;
    await act(async () => {
      result = await renewer?.();
    });

    expect(mockSigninSilent).toHaveBeenCalled();
    expect(mockSigninPopup).not.toHaveBeenCalled();
    expect(result).toEqual({
      idToken: 'oidc-fresh',
      expiresAt: expiresAtSeconds * 1000,
    });
    expect(result?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('falls back to signinPopup when signinSilent fails with a frame error (Safari ITP)', async () => {
    mockSigninSilent.mockRejectedValueOnce(new Error('Frame window timed out'));
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 300;
    mockSigninPopup.mockResolvedValueOnce({
      id_token: 'popup-fresh',
      expires_at: expiresAtSeconds,
    });

    const ref = createRef<AuthenticatorRef>();
    renderOidcAuthenticator(ref);

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    let result: { idToken: string; expiresAt: number } | undefined;
    await act(async () => {
      result = await renewer?.();
    });

    expect(mockSigninSilent).toHaveBeenCalled();
    expect(mockSigninPopup).toHaveBeenCalled();
    expect(result).toEqual({
      idToken: 'popup-fresh',
      expiresAt: expiresAtSeconds * 1000,
    });
  });

  it('rethrows non-frame signinSilent errors without falling back to popup', async () => {
    mockSigninSilent.mockRejectedValueOnce(new Error('login_required'));

    const ref = createRef<AuthenticatorRef>();
    renderOidcAuthenticator(ref);

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    await expect(renewer?.()).rejects.toThrow('login_required');
    expect(mockSigninPopup).not.toHaveBeenCalled();
  });

  it('throws when neither signinSilent nor the popup fallback produce an id_token', async () => {
    mockSigninSilent.mockResolvedValueOnce({ id_token: '', expires_at: 0 });

    const ref = createRef<AuthenticatorRef>();
    renderOidcAuthenticator(ref);

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    await expect(renewer?.()).rejects.toThrow(
      'signinSilent returned no id_token'
    );
  });
});

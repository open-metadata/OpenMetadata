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
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mocks
const setIsAuthenticated = jest.fn();
const setIsSigningUp = jest.fn();
const handleSuccessfulLogout = jest.fn();
const logoutUser = jest.fn().mockResolvedValue(undefined);
const renewToken = jest.fn();
const setOidcToken = jest.fn();
const registerRenewer = jest.fn();

jest.mock('../../../utils/Auth/AuthCoordinator', () => ({
  authCoordinator: {
    registerRenewer: (renewer: unknown) => registerRenewer(renewer),
  },
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ setIsAuthenticated, setIsSigningUp }),
}));

jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ handleSuccessfulLogout }),
}));

jest.mock('../../../rest/LoginAPI', () => ({
  logoutUser: () => logoutUser(),
  renewToken: () => renewToken(),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: (token: string) => setOidcToken(token),
}));

import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import { GenericAuthenticator } from './GenericAuthenticator';

// Builds a structurally-valid (unsigned) JWT so extractDetailsFromToken's
// jwt-decode call can read a real `exp` claim out of the payload segment.
const buildFakeJwt = (expSeconds: number) => {
  const encode = (payload: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(payload)).toString('base64');

  return `${encode({ alg: 'none' })}.${encode({ exp: expSeconds })}.signature`;
};

describe('GenericAuthenticator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children', () => {
    const { getByText } = render(
      <MemoryRouter>
        <GenericAuthenticator ref={null}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );

    expect(getByText('Child')).toBeInTheDocument();
  });

  it('should call setIsAuthenticated(false), setIsSigningUp(true), and redirect on invokeLogin', () => {
    const ref = createRef<AuthenticatorRef>();
    const locationAssign = jest.fn();
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = { assign: locationAssign } as unknown as Location;
    render(
      <MemoryRouter>
        <GenericAuthenticator ref={ref}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );
    act(() => {
      ref.current?.invokeLogin();
    });

    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setIsSigningUp).toHaveBeenCalledWith(true);
    expect(locationAssign).toHaveBeenCalledWith(
      expect.stringContaining('api/v1/auth/login?redirectUri=')
    );
  });

  it('should call logoutUser and handleSuccessfulLogout on invokeLogout', async () => {
    const ref = createRef<AuthenticatorRef>();
    render(
      <MemoryRouter>
        <GenericAuthenticator ref={ref}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );
    await act(async () => {
      await ref.current?.invokeLogout();
    });

    expect(logoutUser).toHaveBeenCalled();
    expect(handleSuccessfulLogout).toHaveBeenCalled();
  });

  it('should call renewToken, setOidcToken, and return response on renewIdToken', async () => {
    const ref = createRef<AuthenticatorRef>();
    const mockResp = { accessToken: 'token', foo: 'bar' };
    renewToken.mockResolvedValueOnce(mockResp);
    render(
      <MemoryRouter>
        <GenericAuthenticator ref={ref}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );
    let result;
    await act(async () => {
      result = await ref.current?.renewIdToken();
    });

    expect(renewToken).toHaveBeenCalled();
    expect(setOidcToken).toHaveBeenCalledWith('token');
    expect(result).toEqual(mockResp);
  });

  it('registers a renewer with AuthCoordinator that resolves {idToken, expiresAt} from renewToken', async () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = buildFakeJwt(expSeconds);
    renewToken.mockResolvedValueOnce({ accessToken });
    render(
      <MemoryRouter>
        <GenericAuthenticator ref={null}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );

    expect(registerRenewer).toHaveBeenCalled();

    const registered = registerRenewer.mock.calls[0][0];

    expect(typeof registered).toBe('function');

    let result: { idToken: string; expiresAt: number } | undefined;
    await act(async () => {
      result = await registered();
    });

    expect(renewToken).toHaveBeenCalled();
    expect(result).toEqual({
      idToken: accessToken,
      expiresAt: expSeconds * 1000,
    });
    expect(result?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('registered renewer throws when renewToken returns no accessToken', async () => {
    renewToken.mockResolvedValueOnce({});
    render(
      <MemoryRouter>
        <GenericAuthenticator ref={null}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );

    const registered = registerRenewer.mock.calls[0][0];

    await expect(registered()).rejects.toThrow(
      'Renew endpoint returned no accessToken'
    );
  });

  it('unregisters the renewer on unmount', () => {
    const { unmount } = render(
      <MemoryRouter>
        <GenericAuthenticator ref={null}>
          <div>Child</div>
        </GenericAuthenticator>
      </MemoryRouter>
    );
    unmount();

    expect(registerRenewer).toHaveBeenCalledWith(null);
  });
});

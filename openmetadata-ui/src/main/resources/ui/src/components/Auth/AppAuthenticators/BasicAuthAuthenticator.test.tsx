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
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { AuthProvider } from '../../../generated/settings/settings';
import { AccessTokenResponse } from '../../../rest/auth-API';

// Mocks
const handleLogout = jest.fn();
const getAccessTokenOnExpiry = jest.fn();
const getRefreshToken = jest.fn();
const setOidcToken = jest.fn();
const setRefreshToken = jest.fn();
const registerRenewer = jest.fn();

jest.mock('../../../utils/Auth/AuthCoordinator', () => ({
  authCoordinator: {
    registerRenewer: (renewer: unknown) => registerRenewer(renewer),
  },
}));

jest.mock('../AuthProviders/BasicAuthContext', () => ({
  useBasicAuth: () => ({ handleLogout }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getRefreshToken: () => getRefreshToken(),
  setOidcToken: (token: string) => setOidcToken(token),
  setRefreshToken: (token: string) => setRefreshToken(token),
}));

jest.mock('../../../rest/auth-API', () => ({
  getAccessTokenOnExpiry: () => getAccessTokenOnExpiry(),
}));

jest.mock('../../common/Loader/Loader', () => () => (
  <div data-testid="loader">Loader</div>
));

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import BasicAuthenticator from './BasicAuthAuthenticator';

// Builds a structurally-valid (unsigned) JWT so extractDetailsFromToken's
// jwt-decode call can read a real `exp` claim out of the payload segment.
const buildFakeJwt = (expSeconds: number) => {
  const encode = (payload: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(payload)).toString('base64');

  return `${encode({ alg: 'none' })}.${encode({ exp: expSeconds })}.signature`;
};

describe('BasicAuthenticator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Loader if isApplicationLoading is true', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: true,
    });
    const { getByTestId } = render(
      <BasicAuthenticator ref={null}>
        <div>Child</div>
      </BasicAuthenticator>
    );

    expect(getByTestId('loader')).toBeInTheDocument();
  });

  it('should render children if isApplicationLoading is false', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
    });
    const { getByText } = render(
      <BasicAuthenticator ref={null}>
        <div>Child</div>
      </BasicAuthenticator>
    );

    expect(getByText('Child')).toBeInTheDocument();
  });

  it('should call handleLogout on invokeLogout', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
    });
    const ref = createRef<AuthenticatorRef>();
    render(
      <BasicAuthenticator ref={ref}>
        <div>Child</div>
      </BasicAuthenticator>
    );
    act(() => {
      ref.current?.invokeLogout();
    });

    expect(handleLogout).toHaveBeenCalled();
  });

  it('should reject renewIdToken if provider is not Basic or LDAP', async () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
      authConfig: { provider: 'other' },
    });
    const ref = createRef<AuthenticatorRef>();
    render(
      <BasicAuthenticator ref={ref}>
        <div>Child</div>
      </BasicAuthenticator>
    );

    await expect(ref.current?.renewIdToken()).rejects.toThrow(
      'message.authProvider-is-not-basic'
    );
  });

  it('should reject renewIdToken if getAccessTokenOnExpiry fails', async () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
      authConfig: { provider: AuthProvider.Basic },
    });
    getAccessTokenOnExpiry.mockRejectedValue(
      new Error('message.no-token-available')
    );
    const ref = createRef<AuthenticatorRef>();
    render(
      <BasicAuthenticator ref={ref}>
        <div>Child</div>
      </BasicAuthenticator>
    );

    await expect(ref.current?.renewIdToken()).rejects.toThrow(
      'message.no-token-available'
    );
  });

  it('should call getAccessTokenOnExpiry, set tokens, and resolve on renewIdToken', async () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
      authConfig: { provider: AuthProvider.Basic },
    });
    const response: AccessTokenResponse = {
      accessToken: 'access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiryDuration: 3600,
      email: 'test@example.com',
    };
    getAccessTokenOnExpiry.mockResolvedValue(response);
    const ref = createRef<AuthenticatorRef>();
    render(
      <BasicAuthenticator ref={ref}>
        <div>Child</div>
      </BasicAuthenticator>
    );
    let result;
    await act(async () => {
      result = await ref.current?.renewIdToken();
    });

    expect(getAccessTokenOnExpiry).toHaveBeenCalled();

    expect(setOidcToken).toHaveBeenCalledWith('access-token');
    expect(result).toEqual(response);
  });

  it('registers a renewer with AuthCoordinator on mount that resolves {idToken, expiresAt} from getAccessTokenOnExpiry', async () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
      authConfig: { provider: AuthProvider.Basic },
    });
    const expSeconds = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = buildFakeJwt(expSeconds);
    const response: AccessTokenResponse = {
      accessToken,
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiryDuration: 3600,
      email: 'test@example.com',
    };
    getAccessTokenOnExpiry.mockResolvedValue(response);
    render(
      <BasicAuthenticator ref={null}>
        <div>Child</div>
      </BasicAuthenticator>
    );

    // The authenticator's mount effect must have registered a Renewer
    // function (not undefined, not null) with the coordinator.
    expect(registerRenewer).toHaveBeenCalled();

    const registered = registerRenewer.mock.calls[0][0];

    expect(typeof registered).toBe('function');

    let result: { idToken: string; expiresAt: number } | undefined;
    await act(async () => {
      result = await registered();
    });

    expect(getAccessTokenOnExpiry).toHaveBeenCalled();
    expect(result).toEqual({
      idToken: accessToken,
      expiresAt: expSeconds * 1000,
    });
    expect(result?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('unregisters the renewer on unmount', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
      authConfig: { provider: AuthProvider.Basic },
    });
    const { unmount } = render(
      <BasicAuthenticator ref={null}>
        <div>Child</div>
      </BasicAuthenticator>
    );

    unmount();

    // The cleanup path calls registerRenewer(null) so a later authenticator
    // (or the coordinator's own "no renewer" state) is not shadowed by a
    // stale one after this component is torn down.
    expect(registerRenewer).toHaveBeenCalledWith(null);
  });
});

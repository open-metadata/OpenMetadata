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

jest.mock('../AuthProviders/BasicAuthProvider', () => ({
  useBasicAuth: () => ({ handleLogout }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../utils/LocalStorageUtils', () => ({
  getRefreshToken: () => getRefreshToken(),
  setOidcToken: (token: string) => setOidcToken(token),
  setRefreshToken: (token: string) => setRefreshToken(token),
}));

jest.mock('../../../rest/auth-API', () => ({
  getAccessTokenOnExpiry: (params: { refreshToken: string }) =>
    getAccessTokenOnExpiry(params),
}));

jest.mock('../../common/Loader/Loader', () => () => (
  <div data-testid="loader">Loader</div>
));

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import BasicAuthenticator from './BasicAuthAuthenticator';

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

  it('should reject renewIdToken if no refresh token', async () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      isApplicationLoading: false,
      authConfig: { provider: AuthProvider.Basic },
    });
    getRefreshToken.mockReturnValue(undefined);
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
    getRefreshToken.mockReturnValue('refresh-token');
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

    expect(getAccessTokenOnExpiry).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
    });
    expect(setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
    expect(setOidcToken).toHaveBeenCalledWith('access-token');
    expect(result).toEqual(response);
  });
});

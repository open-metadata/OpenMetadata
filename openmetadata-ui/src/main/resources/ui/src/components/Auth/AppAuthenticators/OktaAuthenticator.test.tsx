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
import { useOktaAuth } from '@okta/okta-react';
import { act, render, screen } from '@testing-library/react';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import OktaAuthenticator from './OktaAuthenticator';

jest.mock('@okta/okta-react', () => ({
  useOktaAuth: jest.fn(),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: jest.fn(),
}));

const mockHandleSuccessfulLogout = jest.fn();

jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn().mockImplementation(() => ({
    handleSuccessfulLogout: mockHandleSuccessfulLogout,
  })),
}));

const mockOktaAuth = {
  signInWithRedirect: jest.fn(),
  tokenManager: {
    clear: jest.fn(),
    get: jest.fn(),
    setTokens: jest.fn(),
  },
  token: {
    renewTokens: jest.fn(),
  },
  getIdToken: jest.fn(),
};

const mockProps = {
  children: <div>Test Children</div>,
};

describe('OktaAuthenticator', () => {
  let authenticatorRef: AuthenticatorRef | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    (useOktaAuth as jest.Mock).mockReturnValue({
      oktaAuth: mockOktaAuth,
    });
  });

  it('should render children', () => {
    render(
      <OktaAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  describe('login', () => {
    it('should call signInWithRedirect on login', async () => {
      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      await act(async () => {
        authenticatorRef?.invokeLogin();
      });

      expect(mockOktaAuth.signInWithRedirect).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('should clear token manager and call handleSuccessfulLogout', async () => {
      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      await act(async () => {
        await authenticatorRef?.invokeLogout();
      });

      expect(mockOktaAuth.tokenManager.clear).toHaveBeenCalledTimes(1);
      expect(mockHandleSuccessfulLogout).toHaveBeenCalledTimes(1);
    });

    it('should call handleSuccessfulLogout even if tokenManager.clear throws error', async () => {
      mockOktaAuth.tokenManager.clear.mockImplementationOnce(() => {
        throw new Error('Clear failed');
      });

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      await act(async () => {
        await expect(authenticatorRef?.invokeLogout()).rejects.toThrow(
          'Clear failed'
        );
      });

      expect(mockHandleSuccessfulLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('renewToken', () => {
    it('should renew tokens successfully and return new token', async () => {
      const mockIdToken = { idToken: 'new-id-token' };
      const mockAccessToken = { accessToken: 'access-token' };
      const mockRenewedTokens = {
        idToken: mockIdToken,
        accessToken: mockAccessToken,
      };

      mockOktaAuth.tokenManager.get
        .mockResolvedValueOnce(mockIdToken)
        .mockResolvedValueOnce(mockAccessToken);
      mockOktaAuth.token.renewTokens.mockResolvedValueOnce(mockRenewedTokens);

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(mockOktaAuth.tokenManager.get).toHaveBeenCalledWith('idToken');
      expect(mockOktaAuth.tokenManager.get).toHaveBeenCalledWith('accessToken');
      expect(mockOktaAuth.token.renewTokens).toHaveBeenCalledTimes(1);
      expect(mockOktaAuth.tokenManager.setTokens).toHaveBeenCalledWith(
        mockRenewedTokens
      );
      expect(setOidcToken).toHaveBeenCalledWith('new-id-token');
      expect(result).toBe('new-id-token');
    });

    it('should use fallback getIdToken if renewed token is not available', async () => {
      const mockIdToken = { idToken: 'existing-id-token' };
      const mockAccessToken = { accessToken: 'access-token' };
      const mockRenewedTokens = {
        idToken: undefined,
        accessToken: mockAccessToken,
      };

      mockOktaAuth.tokenManager.get
        .mockResolvedValueOnce(mockIdToken)
        .mockResolvedValueOnce(mockAccessToken);
      mockOktaAuth.token.renewTokens.mockResolvedValueOnce(mockRenewedTokens);
      mockOktaAuth.getIdToken.mockReturnValueOnce('fallback-id-token');

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(mockOktaAuth.getIdToken).toHaveBeenCalledTimes(1);
      expect(setOidcToken).toHaveBeenCalledWith('fallback-id-token');
      expect(result).toBe('fallback-id-token');
    });

    it('should redirect to sign-in if no existing tokens', async () => {
      mockOktaAuth.tokenManager.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(mockOktaAuth.tokenManager.get).toHaveBeenCalledWith('idToken');
      expect(mockOktaAuth.tokenManager.get).toHaveBeenCalledWith('accessToken');
      expect(mockOktaAuth.signInWithRedirect).toHaveBeenCalledTimes(1);
      expect(mockOktaAuth.token.renewTokens).not.toHaveBeenCalled();
      expect(result).toBe('');
    });

    it('should redirect to sign-in when token renewal fails', async () => {
      const mockIdToken = { idToken: 'existing-id-token' };
      const mockAccessToken = { accessToken: 'access-token' };

      mockOktaAuth.tokenManager.get
        .mockResolvedValueOnce(mockIdToken)
        .mockResolvedValueOnce(mockAccessToken);
      mockOktaAuth.token.renewTokens.mockRejectedValueOnce(
        new Error('Token renewal failed')
      );

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error renewing Okta token:',
        expect.any(Error)
      );
      expect(mockOktaAuth.signInWithRedirect).toHaveBeenCalledTimes(1);
      expect(result).toBe('');

      consoleErrorSpy.mockRestore();
    });

    it('should return empty string if all token sources fail', async () => {
      const mockIdToken = { idToken: 'existing-id-token' };
      const mockAccessToken = { accessToken: 'access-token' };
      const mockRenewedTokens = {
        idToken: undefined,
        accessToken: mockAccessToken,
      };

      mockOktaAuth.tokenManager.get
        .mockResolvedValueOnce(mockIdToken)
        .mockResolvedValueOnce(mockAccessToken);
      mockOktaAuth.token.renewTokens.mockResolvedValueOnce(mockRenewedTokens);
      mockOktaAuth.getIdToken.mockReturnValueOnce(undefined);

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(setOidcToken).toHaveBeenCalledWith('');
      expect(result).toBe('');
    });
  });
});

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
import { getOidcToken } from '../../../utils/SwTokenStorageUtils';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import OktaAuthenticator from './OktaAuthenticator';

jest.mock('@okta/okta-react', () => ({
  useOktaAuth: jest.fn(),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn(),
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
  },
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
    it('should return token from storage', async () => {
      (getOidcToken as jest.Mock).mockResolvedValueOnce('stored-token');

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(getOidcToken).toHaveBeenCalledTimes(1);
      expect(result).toBe('stored-token');
    });

    it('should return empty string if no token in storage', async () => {
      (getOidcToken as jest.Mock).mockResolvedValueOnce('');

      render(
        <OktaAuthenticator
          {...mockProps}
          ref={(ref) => (authenticatorRef = ref)}
        />
      );

      const result = await authenticatorRef?.renewIdToken();

      expect(getOidcToken).toHaveBeenCalledTimes(1);
      expect(result).toBe('');
    });
  });
});

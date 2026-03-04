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

import { IDToken } from '@okta/okta-auth-js';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import * as SwTokenStorageUtils from '../../../utils/SwTokenStorageUtils';
import { OktaAuthProvider } from './OktaAuthProvider';

const mockOktaAuth = {
  tokenManager: {
    isStarted: jest.fn(),
    start: jest.fn(),
    getTokens: jest.fn(),
    renew: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    clear: jest.fn(),
  },
  getIdToken: jest.fn(),
  getUser: jest.fn(),
  signInWithRedirect: jest.fn(),
  authStateManager: {
    getAuthState: jest.fn(),
  },
};

const mockCustomStorage = {
  waitForInit: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  getStorage: jest.fn().mockReturnValue({}),
};

jest.mock('@okta/okta-auth-js', () => ({
  OktaAuth: jest.fn(() => mockOktaAuth),
  EVENT_RENEWED: 'renewed',
  isIDToken: jest.fn(
    (token) => token && typeof token === 'object' && 'idToken' in token
  ),
}));

jest.mock('@okta/okta-react', () => ({
  Security: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    authConfig: {
      clientId: 'test-client-id',
      issuer: 'https://test.okta.com',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['openid', 'profile', 'email'],
      pkce: true,
    },
  }),
}));

jest.mock('../../../utils/OktaCustomStorage', () => ({
  OktaCustomStorage: jest.fn(() => mockCustomStorage),
}));

jest.mock('../../../utils/SwTokenStorageUtils');

const mockSetOidcToken = jest.fn();

jest.mock('./AuthProvider', () => ({
  useAuthProvider: () => ({
    handleSuccessfulLogin: jest.fn(),
  }),
}));

describe('OktaAuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOktaAuth.tokenManager.isStarted.mockReturnValue(false);
    mockOktaAuth.tokenManager.getTokens.mockResolvedValue({});
    mockOktaAuth.tokenManager.start.mockResolvedValue(undefined);
    mockCustomStorage.waitForInit.mockResolvedValue(undefined);
    (SwTokenStorageUtils.setOidcToken as jest.Mock) = mockSetOidcToken;
    mockSetOidcToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should wait for custom storage init before starting token manager', async () => {
      let resolveWaitForInit: () => void;
      const waitPromise = new Promise<void>((resolve) => {
        resolveWaitForInit = resolve;
      });
      mockCustomStorage.waitForInit.mockReturnValue(waitPromise);

      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockCustomStorage.waitForInit).toHaveBeenCalled();
      });

      expect(mockOktaAuth.tokenManager.start).not.toHaveBeenCalled();

      resolveWaitForInit!();

      await waitFor(() => {
        expect(mockOktaAuth.tokenManager.start).toHaveBeenCalled();
      });
    });

    it('should initialize token manager on mount', async () => {
      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockCustomStorage.waitForInit).toHaveBeenCalled();
        expect(mockOktaAuth.tokenManager.start).toHaveBeenCalled();
      });
    });

    it('should handle initialization errors gracefully', async () => {
      mockCustomStorage.waitForInit.mockRejectedValue(new Error('Init failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to initialize Okta token manager:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  it('should not start token manager if already started', async () => {
    mockOktaAuth.tokenManager.isStarted.mockReturnValue(true);

    render(
      <MemoryRouter>
        <OktaAuthProvider>
          <div>Test</div>
        </OktaAuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockOktaAuth.tokenManager.start).not.toHaveBeenCalled();
    });
  });

  describe('EVENT_RENEWED sync to app storage', () => {
    it('should register token renewed event listener', async () => {
      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockOktaAuth.tokenManager.on).toHaveBeenCalledWith(
          'renewed',
          expect.any(Function)
        );
      });
    });

    it('should call setOidcToken when idToken is renewed', async () => {
      let renewedHandler: (key: string, token: IDToken) => void;

      mockOktaAuth.tokenManager.on.mockImplementation((event, handler) => {
        if (event === 'renewed') {
          renewedHandler = handler;
        }
      });

      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockOktaAuth.tokenManager.on).toHaveBeenCalledWith(
          'renewed',
          expect.any(Function)
        );
      });

      const renewedToken = {
        idToken: 'new-renewed-token',
        claims: { sub: 'user123' },
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      } as IDToken;

      await renewedHandler!('idToken', renewedToken);

      await waitFor(() => {
        expect(mockSetOidcToken).toHaveBeenCalledWith('new-renewed-token');
      });
    });

    it('should not call setOidcToken when accessToken is renewed', async () => {
      let renewedHandler: (key: string, token: IDToken) => void;

      mockOktaAuth.tokenManager.on.mockImplementation((event, handler) => {
        if (event === 'renewed') {
          renewedHandler = handler;
        }
      });

      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockOktaAuth.tokenManager.on).toHaveBeenCalled();
      });

      const renewedToken = {
        accessToken: 'new-access-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      } as unknown as IDToken;

      await renewedHandler!('accessToken', renewedToken);

      await waitFor(() => {
        expect(mockSetOidcToken).not.toHaveBeenCalled();
      });
    });

    it('should handle missing idToken in renewed event', async () => {
      let renewedHandler: (key: string, token: IDToken) => void;

      mockOktaAuth.tokenManager.on.mockImplementation((event, handler) => {
        if (event === 'renewed') {
          renewedHandler = handler;
        }
      });

      render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockOktaAuth.tokenManager.on).toHaveBeenCalled();
      });

      const renewedToken = {
        claims: { sub: 'user123' },
      } as IDToken;

      await renewedHandler!('idToken', renewedToken);

      await waitFor(() => {
        expect(mockSetOidcToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const { unmount } = render(
        <MemoryRouter>
          <OktaAuthProvider>
            <div>Test</div>
          </OktaAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockOktaAuth.tokenManager.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockOktaAuth.tokenManager.off).toHaveBeenCalledWith(
        'renewed',
        expect.any(Function)
      );
    });
  });
});

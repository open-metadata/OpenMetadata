/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import { extractDetailsFromToken } from '../../AuthProvider.util';
import { getOidcToken } from '../../SwTokenStorageUtils';
import TokenService from './TokenServiceUtil';

jest.mock('../../AuthProvider.util', () => ({
  extractDetailsFromToken: jest.fn(),
}));

jest.mock('../../SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn(),
}));

describe('TokenService', () => {
  let tokenService: TokenService;
  const mockRenewToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
    // Reset the singleton instance for each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TokenService as any)._instance = undefined;

    // Mock indexedDB
    Object.defineProperty(window, 'indexedDB', {
      value: {},
      writable: true,
      configurable: true,
    });

    tokenService = TokenService.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = TokenService.getInstance();
      const instance2 = TokenService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Worker Listener', () => {
    let addEventListenerSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock navigator.serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          addEventListener: jest.fn(),
        },
        configurable: true,
      });
      addEventListenerSpy = jest.spyOn(
        navigator.serviceWorker,
        'addEventListener'
      );
    });

    it('should setup service worker listener if available', () => {
      // Reset instance to trigger constructor again
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TokenService as any)._instance = undefined;
      TokenService.getInstance();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should handle TOKEN_UPDATE message', () => {
      const refreshSuccessCallback = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TokenService as any)._instance = undefined;
      const service = TokenService.getInstance();
      service.refreshSuccessCallback = refreshSuccessCallback;

      // Get the message handler from the mock call
      const messageHandler = addEventListenerSpy.mock.calls[0][1];

      // Simulate event
      messageHandler({ data: { type: 'TOKEN_UPDATE' } });

      expect(refreshSuccessCallback).toHaveBeenCalled();
    });

    it('should not trigger callback for TOKEN_CLEARED message', () => {
      const refreshSuccessCallback = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TokenService as any)._instance = undefined;
      const service = TokenService.getInstance();
      service.refreshSuccessCallback = refreshSuccessCallback;

      const messageHandler = addEventListenerSpy.mock.calls[0][1];

      messageHandler({ data: { type: 'TOKEN_CLEARED' } });

      expect(refreshSuccessCallback).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should wait for a sibling tab refresh and return the new token', async () => {
      jest.useRealTimers();
      localStorage.setItem('refreshInProgress', 'true');
      (getOidcToken as jest.Mock)
        .mockResolvedValueOnce('old-token')
        .mockResolvedValue('new-token');

      const result = await tokenService.refreshToken();

      // Must resolve to the sibling's token, never `undefined` (the value that
      // made the 401 interceptor treat an in-progress refresh as a failure).
      expect(result).toBe('new-token');

      jest.useFakeTimers();
    });

    it('should coalesce concurrent refresh calls into a single refresh', async () => {
      jest.useRealTimers();
      (getOidcToken as jest.Mock)
        .mockResolvedValueOnce('old-token')
        .mockResolvedValue('new-token');
      (extractDetailsFromToken as jest.Mock).mockReturnValue({
        isExpired: true,
        timeoutExpiry: -1,
      });
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockResolvedValue('new-token');

      const [first, second] = await Promise.all([
        tokenService.refreshToken(),
        tokenService.refreshToken(),
      ]);

      expect(mockRenewToken).toHaveBeenCalledTimes(1);
      expect(first).toBe('new-token');
      expect(second).toBe('new-token');

      jest.useFakeTimers();
    });

    it('should treat a void-returning silent renew as success when the token is persisted', async () => {
      jest.useRealTimers();
      (getOidcToken as jest.Mock)
        .mockResolvedValueOnce('old-token')
        .mockResolvedValue('renewed-token');
      (extractDetailsFromToken as jest.Mock).mockReturnValue({
        isExpired: true,
        timeoutExpiry: -1,
      });
      tokenService.updateRenewToken(mockRenewToken);
      // OIDC silent renew resolves void and writes the token via a side effect.
      mockRenewToken.mockResolvedValue(undefined);

      const result = await tokenService.refreshToken();

      // A void return with a changed stored token is a success, not a logout.
      expect(result).toBe('renewed-token');

      jest.useFakeTimers();
    });

    it('should refresh even when the token still looks valid locally', async () => {
      // A 401 can arrive on a token that is not yet expired locally (clock skew /
      // server-side revocation); there is no "skip if valid" fast path to block it.
      jest.useRealTimers();
      (getOidcToken as jest.Mock)
        .mockResolvedValueOnce('old-token')
        .mockResolvedValue('new-token');
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockResolvedValue('new-token');

      const result = await tokenService.refreshToken();

      expect(mockRenewToken).toHaveBeenCalledTimes(1);
      expect(result).toBe('new-token');

      jest.useFakeTimers();
    });

    it('should treat a re-issued identical token as success, not a logout', async () => {
      // MSAL/Okta/Auth0 silent renew can return the same id_token (forceRefresh
      // only refreshes the access token); storage is unchanged but the renewer
      // resolving is still success — must NOT return null (which logs the user out).
      jest.useRealTimers();
      (getOidcToken as jest.Mock).mockResolvedValue('same-token');
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockResolvedValue('same-token');

      const result = await tokenService.refreshToken();

      expect(result).toBe('same-token');

      jest.useFakeTimers();
    });

    it('should refresh token if expired', async () => {
      jest.useRealTimers();
      (getOidcToken as jest.Mock)
        .mockResolvedValueOnce('old-token')
        .mockResolvedValue('new-token');
      (extractDetailsFromToken as jest.Mock).mockReturnValue({
        isExpired: true,
        timeoutExpiry: -1,
      });
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockResolvedValue('new-token');

      const result = await tokenService.refreshToken();

      expect(mockRenewToken).toHaveBeenCalled();
      expect(result).toBe('new-token');
      expect(localStorage.getItem('tokenRefreshed')).toBe('true');

      jest.useFakeTimers();
    });

    it('should return null and clear the flag when no renewer is configured', async () => {
      (getOidcToken as jest.Mock).mockResolvedValue('valid-token');

      const result = await tokenService.refreshToken();

      expect(mockRenewToken).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(localStorage.getItem('refreshInProgress')).toBeNull();
    });

    it('should log a warning and resolve to null on renewal failure', async () => {
      (getOidcToken as jest.Mock).mockResolvedValue('token');
      (extractDetailsFromToken as jest.Mock).mockReturnValue({
        isExpired: true,
      });
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockRejectedValue(new Error('Refresh failed'));
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      const result = await tokenService.refreshToken();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to refresh token: Refresh failed'
      );
      expect(localStorage.getItem('refreshInProgress')).toBeNull();

      warnSpy.mockRestore();
    });
  });

  describe('fetchNewToken', () => {
    it('should return null if renewToken is not a function', async () => {
      tokenService.renewToken = null;
      const result = await tokenService.fetchNewToken();

      expect(result).toBeNull();
    });

    it('should call renewToken and return result', async () => {
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockResolvedValue('new-token-123');

      const result = await tokenService.fetchNewToken();

      expect(result).toBe('new-token-123');
    });

    it('should handle "Frame window timed out" error silently', async () => {
      tokenService.updateRenewToken(mockRenewToken);
      const error = new AxiosError('Frame window timed out');
      mockRenewToken.mockRejectedValue(error);

      // Should not throw
      const result = await tokenService.fetchNewToken();

      expect(result).toBeNull();
    });

    it('should log a warning and return null for other errors', async () => {
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockRejectedValue(new Error('Network error'));
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      const result = await tokenService.fetchNewToken();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to refresh token: Network error'
      );

      warnSpy.mockRestore();
    });

    it('should clear refreshInProgress on success', async () => {
      localStorage.setItem('refreshInProgress', 'true');
      tokenService.updateRenewToken(mockRenewToken);
      mockRenewToken.mockResolvedValue('token');

      await tokenService.fetchNewToken();

      expect(localStorage.getItem('refreshInProgress')).toBeNull();
    });
  });

  describe('updateRefreshSuccessCallback', () => {
    it('should setup storage listener', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const callback = jest.fn();

      tokenService.updateRefreshSuccessCallback(callback);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );

      // Test the listener
      const handler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'storage'
      )?.[1];

      // Simulate valid event
      const validEvent = new StorageEvent('storage', {
        key: 'tokenRefreshed',
        newValue: 'true',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any)(validEvent);

      expect(callback).toHaveBeenCalled();
      expect(localStorage.getItem('tokenRefreshed')).toBeNull(); // Should be removed
    });

    it('should ignore irrelevant storage events', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const callback = jest.fn();

      tokenService.updateRefreshSuccessCallback(callback);

      const handler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'storage'
      )?.[1];

      const invalidEvent = new StorageEvent('storage', {
        key: 'otherKey',
        newValue: 'true',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any)(invalidEvent);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

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

import {
  getOidcToken,
  getRefreshToken,
  isServiceWorkerAvailable,
  setOidcToken,
  setRefreshToken,
} from './SwTokenStorageUtils';

// Mock SwTokenStorage
const mockSetItem = jest.fn();
const mockGetItem = jest.fn();

jest.mock('./SwTokenStorage', () => ({
  swTokenStorage: {
    setItem: (key: string, value: string) => mockSetItem(key, value),
    getItem: (key: string) => mockGetItem(key),
  },
}));

// Mock navigator and localStorage for browser environment simulation
interface MockNavigator {
  serviceWorker?: Record<string, unknown>;
}

interface MockWindow {
  indexedDB?: Record<string, unknown>;
}

const mockNavigator: MockNavigator = {
  serviceWorker: {},
};

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    indexedDB: {},
  } as MockWindow,
  writable: true,
});

describe('SwTokenStorageUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isServiceWorkerAvailable', () => {
    it('should return true when both serviceWorker and indexedDB are available', () => {
      mockNavigator.serviceWorker = {};
      (global.window as unknown as MockWindow).indexedDB = {};

      const result = isServiceWorkerAvailable();

      expect(result).toBe(true);
    });

    it('should return false when serviceWorker is not available', () => {
      delete mockNavigator.serviceWorker;
      (global.window as unknown as MockWindow).indexedDB = {};

      const result = isServiceWorkerAvailable();

      expect(result).toBe(false);
    });

    it('should return false when indexedDB is not available', () => {
      mockNavigator.serviceWorker = {};
      delete (global.window as unknown as MockWindow).indexedDB;

      const result = isServiceWorkerAvailable();

      expect(result).toBe(false);
    });

    it('should return false when neither serviceWorker nor indexedDB are available', () => {
      delete mockNavigator.serviceWorker;
      delete (global.window as unknown as MockWindow).indexedDB;

      const result = isServiceWorkerAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getOidcToken', () => {
    beforeEach(() => {
      // Reset environment for each test
      mockNavigator.serviceWorker = {};
      (global.window as unknown as MockWindow).indexedDB = {};
    });

    it('should return token from service worker when available', async () => {
      const mockToken = 'test-oidc-token';
      const mockAppState = JSON.stringify({ primary: mockToken });
      mockGetItem.mockResolvedValue(mockAppState);

      const result = await getOidcToken();

      expect(mockGetItem).toHaveBeenCalledWith('app_state');
      expect(result).toBe(mockToken);
    });

    it('should return empty string when no token exists in service worker', async () => {
      const mockAppState = JSON.stringify({});
      mockGetItem.mockResolvedValue(mockAppState);

      const result = await getOidcToken();

      expect(result).toBe('');
    });

    it('should return empty string when app state is null', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await getOidcToken();

      expect(result).toBe('');
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      delete mockNavigator.serviceWorker;
      const mockToken = 'test-oidc-token';
      const mockAppState = JSON.stringify({ primary: mockToken });
      mockLocalStorage.getItem.mockReturnValue(mockAppState);

      const result = await getOidcToken();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('app_state');
      expect(result).toBe(mockToken);
    });

    it('should return empty string when service worker throws error', async () => {
      mockGetItem.mockRejectedValue(new Error('Service worker error'));

      const result = await getOidcToken();

      expect(result).toBe('');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockGetItem.mockResolvedValue('invalid-json');

      const result = await getOidcToken();

      expect(result).toBe('');
    });
  });

  describe('setOidcToken', () => {
    beforeEach(() => {
      mockNavigator.serviceWorker = {};
      (global.window as unknown as MockWindow).indexedDB = {};
    });

    it('should set token in service worker when available', async () => {
      const mockToken = 'new-oidc-token';
      const existingState = JSON.stringify({ secondary: 'refresh-token' });
      const expectedState = JSON.stringify({
        secondary: 'refresh-token',
        primary: mockToken,
      });

      mockGetItem.mockResolvedValue(existingState);
      mockSetItem.mockResolvedValue(undefined);

      await setOidcToken(mockToken);

      expect(mockGetItem).toHaveBeenCalledWith('app_state');
      expect(mockSetItem).toHaveBeenCalledWith('app_state', expectedState);
    });

    it('should create new state when no existing state exists', async () => {
      const mockToken = 'new-oidc-token';
      const expectedState = JSON.stringify({ primary: mockToken });

      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      await setOidcToken(mockToken);

      expect(mockSetItem).toHaveBeenCalledWith('app_state', expectedState);
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      delete mockNavigator.serviceWorker;
      const mockToken = 'new-oidc-token';
      const expectedState = JSON.stringify({ primary: mockToken });

      mockLocalStorage.getItem.mockReturnValue(null);

      await setOidcToken(mockToken);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'app_state',
        expectedState
      );
    });

    it('should handle errors gracefully without throwing', async () => {
      mockGetItem.mockRejectedValue(new Error('Service worker error'));

      await expect(setOidcToken('test-token')).resolves.toBeUndefined();
    });
  });

  describe('getRefreshToken', () => {
    beforeEach(() => {
      mockNavigator.serviceWorker = {};
      (global.window as unknown as MockWindow).indexedDB = {};
    });

    it('should return refresh token from service worker when available', async () => {
      const mockToken = 'test-refresh-token';
      const mockAppState = JSON.stringify({ secondary: mockToken });
      mockGetItem.mockResolvedValue(mockAppState);

      const result = await getRefreshToken();

      expect(mockGetItem).toHaveBeenCalledWith('app_state');
      expect(result).toBe(mockToken);
    });

    it('should return empty string when no refresh token exists', async () => {
      const mockAppState = JSON.stringify({ primary: 'oidc-token' });
      mockGetItem.mockResolvedValue(mockAppState);

      const result = await getRefreshToken();

      expect(result).toBe('');
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      delete mockNavigator.serviceWorker;
      const mockToken = 'test-refresh-token';
      const mockAppState = JSON.stringify({ secondary: mockToken });
      mockLocalStorage.getItem.mockReturnValue(mockAppState);

      const result = await getRefreshToken();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('app_state');
      expect(result).toBe(mockToken);
    });

    it('should return empty string on error', async () => {
      mockGetItem.mockRejectedValue(new Error('Service worker error'));

      const result = await getRefreshToken();

      expect(result).toBe('');
    });
  });

  describe('setRefreshToken', () => {
    beforeEach(() => {
      mockNavigator.serviceWorker = {};
      (global.window as unknown as MockWindow).indexedDB = {};
    });

    it('should set refresh token in service worker when available', async () => {
      const mockToken = 'new-refresh-token';
      const existingState = JSON.stringify({ primary: 'oidc-token' });
      const expectedState = JSON.stringify({
        primary: 'oidc-token',
        secondary: mockToken,
      });

      mockGetItem.mockResolvedValue(existingState);
      mockSetItem.mockResolvedValue(undefined);

      await setRefreshToken(mockToken);

      expect(mockGetItem).toHaveBeenCalledWith('app_state');
      expect(mockSetItem).toHaveBeenCalledWith('app_state', expectedState);
    });

    it('should create new state when no existing state exists', async () => {
      const mockToken = 'new-refresh-token';
      const expectedState = JSON.stringify({ secondary: mockToken });

      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      await setRefreshToken(mockToken);

      expect(mockSetItem).toHaveBeenCalledWith('app_state', expectedState);
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      delete mockNavigator.serviceWorker;
      const mockToken = 'new-refresh-token';
      const expectedState = JSON.stringify({ secondary: mockToken });

      mockLocalStorage.getItem.mockReturnValue(null);

      await setRefreshToken(mockToken);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'app_state',
        expectedState
      );
    });

    it('should handle errors gracefully without throwing', async () => {
      mockGetItem.mockRejectedValue(new Error('Service worker error'));

      await expect(setRefreshToken('test-token')).resolves.toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      mockNavigator.serviceWorker = {};
      (global.window as unknown as MockWindow).indexedDB = {};
    });

    it('should maintain both tokens when updating one', async () => {
      const oidcToken = 'oidc-token';
      const refreshToken = 'refresh-token';

      // Start with empty state
      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      // Set OIDC token first
      await setOidcToken(oidcToken);

      // Mock the state after setting OIDC token
      mockGetItem.mockResolvedValue(JSON.stringify({ primary: oidcToken }));

      // Set refresh token
      await setRefreshToken(refreshToken);

      // Verify both tokens are maintained
      const expectedFinalState = JSON.stringify({
        primary: oidcToken,
        secondary: refreshToken,
      });

      expect(mockSetItem).toHaveBeenLastCalledWith(
        'app_state',
        expectedFinalState
      );
    });

    it('should handle mixed environment gracefully (some features available)', async () => {
      // Simulate environment where serviceWorker exists but indexedDB doesn't
      mockNavigator.serviceWorker = {};
      delete (global.window as unknown as MockWindow).indexedDB;

      const result = await getOidcToken();

      // Should fallback to localStorage
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('app_state');
      expect(result).toBe('');
    });
  });
});

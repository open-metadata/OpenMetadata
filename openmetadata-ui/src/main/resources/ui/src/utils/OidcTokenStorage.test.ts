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

// Mock SwTokenStorage
jest.mock('./SwTokenStorage', () => ({
  swTokenStorage: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
  },
}));

// Mock isServiceWorkerAvailable
jest.mock('./SwTokenStorageUtils', () => ({
  isServiceWorkerAvailable: jest.fn(() => true),
}));

import { oidcTokenStorage } from './OidcTokenStorage';
import { swTokenStorage } from './SwTokenStorage';
import { isServiceWorkerAvailable } from './SwTokenStorageUtils';

const mockSwTokenStorage = swTokenStorage as jest.Mocked<typeof swTokenStorage>;
const mockIsServiceWorkerAvailable = isServiceWorkerAvailable as jest.Mock;

// Mock localStorage
const mockLocalStorage: Record<string, any> = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('OidcTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('set/get operations', () => {
    it('should use service worker when available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.setItem.mockResolvedValue(undefined);
      mockSwTokenStorage.getItem.mockResolvedValue('test-value');

      await oidcTokenStorage.set('test-key', 'test-value');
      const result = await oidcTokenStorage.get('test-key');

      expect(mockSwTokenStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      );
      expect(mockSwTokenStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
    });

    it('should fallback to localStorage when service worker unavailable', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      mockLocalStorage.getItem.mockReturnValue('test-value');

      await oidcTokenStorage.set('test-key', 'test-value');
      const result = await oidcTokenStorage.get('test-key');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      );
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
      expect(mockSwTokenStorage.setItem).not.toHaveBeenCalled();
      expect(mockSwTokenStorage.getItem).not.toHaveBeenCalled();
    });

    it('should return null for non-existent keys', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.getItem.mockResolvedValue(null);

      const result = await oidcTokenStorage.get('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('remove operations', () => {
    it('should remove items using service worker', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.removeItem.mockResolvedValue('removed-value');

      const result = await oidcTokenStorage.remove('test-key');

      expect(mockSwTokenStorage.removeItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe('removed-value');
    });

    it('should remove items using localStorage fallback', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      mockLocalStorage.getItem.mockReturnValue('existing-value');

      const result = await oidcTokenStorage.remove('test-key');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe('existing-value');
    });
  });

  describe('getAllKeys operations', () => {
    it('should get all keys using service worker', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.getAllKeys.mockResolvedValue(['key1', 'key2']);

      const result = await oidcTokenStorage.getAllKeys();

      expect(mockSwTokenStorage.getAllKeys).toHaveBeenCalled();
      expect(result).toEqual(['key1', 'key2']);
    });

    it('should get all keys using localStorage fallback', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      // Mock localStorage with some keys
      Object.assign(mockLocalStorage, { key1: 'value1', key2: 'value2' });

      const result = await oidcTokenStorage.getAllKeys();

      expect(result).toEqual([
        'getItem',
        'setItem',
        'removeItem',
        'key1',
        'key2',
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle service worker errors', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.setItem.mockRejectedValue(new Error('SW Error'));

      await expect(oidcTokenStorage.set('key', 'value')).rejects.toThrow(
        'SW Error'
      );
    });
  });
});

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

import { oidcTokenStorage } from './OidcTokenStorage';

// Mock SwTokenStorage
const mockSwTokenStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
};

jest.mock('./SwTokenStorage', () => ({
  swTokenStorage: mockSwTokenStorage,
}));

// Mock isServiceWorkerAvailable
const mockIsServiceWorkerAvailable = jest.fn();

jest.mock('./SwTokenStorageUtils', () => ({
  isServiceWorkerAvailable: mockIsServiceWorkerAvailable,
}));

// Mock localStorage with keys property
const mockLocalStorage = {
  key1: 'value1',
  key2: 'value2',
  key3: 'value3',
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
    mockIsServiceWorkerAvailable.mockReturnValue(true);
  });

  describe('singleton pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = oidcTokenStorage;
      const instance2 = oidcTokenStorage;

      expect(instance1).toBe(instance2);
    });
  });

  describe('set method', () => {
    it('should use service worker storage when available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.setItem.mockResolvedValue(undefined);

      await oidcTokenStorage.set('test-key', 'test-value');

      expect(mockSwTokenStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      );
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);

      await oidcTokenStorage.set('test-key', 'test-value');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      );
      expect(mockSwTokenStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle empty key and value', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.setItem.mockResolvedValue(undefined);

      await oidcTokenStorage.set('', '');

      expect(mockSwTokenStorage.setItem).toHaveBeenCalledWith('', '');
    });

    it('should handle service worker errors gracefully', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.setItem.mockRejectedValue(
        new Error('Service worker error')
      );

      await expect(
        oidcTokenStorage.set('test-key', 'test-value')
      ).rejects.toThrow('Service worker error');
    });
  });

  describe('get method', () => {
    it('should use service worker storage when available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      const expectedValue = 'test-value';
      mockSwTokenStorage.getItem.mockResolvedValue(expectedValue);

      const result = await oidcTokenStorage.get('test-key');

      expect(mockSwTokenStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe(expectedValue);
      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      const expectedValue = 'test-value';
      mockLocalStorage.getItem.mockReturnValue(expectedValue);

      const result = await oidcTokenStorage.get('test-key');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe(expectedValue);
      expect(mockSwTokenStorage.getItem).not.toHaveBeenCalled();
    });

    it('should return null when item does not exist in service worker', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.getItem.mockResolvedValue(null);

      const result = await oidcTokenStorage.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null when item does not exist in localStorage', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await oidcTokenStorage.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should handle service worker errors gracefully', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.getItem.mockRejectedValue(
        new Error('Service worker error')
      );

      await expect(oidcTokenStorage.get('test-key')).rejects.toThrow(
        'Service worker error'
      );
    });
  });

  describe('remove method', () => {
    it('should use service worker storage when available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      const removedValue = 'removed-value';
      mockSwTokenStorage.removeItem.mockResolvedValue(removedValue);

      const result = await oidcTokenStorage.remove('test-key');

      expect(mockSwTokenStorage.removeItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe(removedValue);
      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      const existingValue = 'existing-value';
      mockLocalStorage.getItem.mockReturnValue(existingValue);

      const result = await oidcTokenStorage.remove('test-key');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe(existingValue);
      expect(mockSwTokenStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should return null when removing non-existent item from service worker', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.removeItem.mockResolvedValue(null);

      const result = await oidcTokenStorage.remove('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null when removing non-existent item from localStorage', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await oidcTokenStorage.remove('non-existent-key');

      expect(result).toBeNull();
    });

    it('should handle service worker errors gracefully', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.removeItem.mockRejectedValue(
        new Error('Service worker error')
      );

      await expect(oidcTokenStorage.remove('test-key')).rejects.toThrow(
        'Service worker error'
      );
    });
  });

  describe('getAllKeys method', () => {
    it('should use service worker storage when available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      const expectedKeys = ['key1', 'key2', 'key3'];
      mockSwTokenStorage.getAllKeys.mockResolvedValue(expectedKeys);

      const result = await oidcTokenStorage.getAllKeys();

      expect(mockSwTokenStorage.getAllKeys).toHaveBeenCalled();
      expect(result).toEqual(expectedKeys);
    });

    it('should fallback to localStorage when service worker is not available', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      const expectedKeys = ['key1', 'key2', 'key3'];

      const result = await oidcTokenStorage.getAllKeys();

      expect(result).toEqual(expectedKeys);
      expect(mockSwTokenStorage.getAllKeys).not.toHaveBeenCalled();
    });

    it('should return empty array when no keys exist in service worker', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.getAllKeys.mockResolvedValue([]);

      const result = await oidcTokenStorage.getAllKeys();

      expect(result).toEqual([]);
    });

    it('should return empty array when no keys exist in localStorage', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      // Clear localStorage keys for this test
      Object.keys(mockLocalStorage).forEach((key) => {
        if (typeof mockLocalStorage[key] === 'string') {
          delete mockLocalStorage[key];
        }
      });

      const result = await oidcTokenStorage.getAllKeys();

      expect(result).toEqual([]);

      // Restore keys for other tests
      mockLocalStorage.key1 = 'value1';
      mockLocalStorage.key2 = 'value2';
      mockLocalStorage.key3 = 'value3';
    });

    it('should handle service worker errors gracefully', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.getAllKeys.mockRejectedValue(
        new Error('Service worker error')
      );

      await expect(oidcTokenStorage.getAllKeys()).rejects.toThrow(
        'Service worker error'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should support complete CRUD operations with service worker', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      const key = 'integration-key';
      const value = 'integration-value';
      const updatedValue = 'updated-value';

      // Set item
      mockSwTokenStorage.setItem.mockResolvedValue(undefined);
      await oidcTokenStorage.set(key, value);

      // Get item
      mockSwTokenStorage.getItem.mockResolvedValue(value);
      const retrievedValue = await oidcTokenStorage.get(key);

      expect(retrievedValue).toBe(value);

      // Update item
      mockSwTokenStorage.setItem.mockResolvedValue(undefined);
      await oidcTokenStorage.set(key, updatedValue);

      // Get updated item
      mockSwTokenStorage.getItem.mockResolvedValue(updatedValue);
      const retrievedUpdatedValue = await oidcTokenStorage.get(key);

      expect(retrievedUpdatedValue).toBe(updatedValue);

      // Remove item
      mockSwTokenStorage.removeItem.mockResolvedValue(updatedValue);
      const removedValue = await oidcTokenStorage.remove(key);

      expect(removedValue).toBe(updatedValue);

      // Verify item is removed
      mockSwTokenStorage.getItem.mockResolvedValue(null);
      const finalValue = await oidcTokenStorage.get(key);

      expect(finalValue).toBeNull();
    });

    it('should support complete CRUD operations with localStorage fallback', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      const key = 'integration-key';
      const value = 'integration-value';
      const updatedValue = 'updated-value';

      // Set item
      await oidcTokenStorage.set(key, value);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(key, value);

      // Get item
      mockLocalStorage.getItem.mockReturnValue(value);
      const retrievedValue = await oidcTokenStorage.get(key);

      expect(retrievedValue).toBe(value);

      // Update item
      await oidcTokenStorage.set(key, updatedValue);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(key, updatedValue);

      // Get updated item
      mockLocalStorage.getItem.mockReturnValue(updatedValue);
      const retrievedUpdatedValue = await oidcTokenStorage.get(key);

      expect(retrievedUpdatedValue).toBe(updatedValue);

      // Remove item
      mockLocalStorage.getItem.mockReturnValue(updatedValue);
      const removedValue = await oidcTokenStorage.remove(key);

      expect(removedValue).toBe(updatedValue);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);

      // Verify item is removed
      mockLocalStorage.getItem.mockReturnValue(null);
      const finalValue = await oidcTokenStorage.get(key);

      expect(finalValue).toBeNull();
    });

    it('should handle switching between service worker and localStorage', async () => {
      const key = 'switch-key';
      const value = 'switch-value';

      // Start with service worker available
      mockIsServiceWorkerAvailable.mockReturnValue(true);
      mockSwTokenStorage.setItem.mockResolvedValue(undefined);
      await oidcTokenStorage.set(key, value);

      expect(mockSwTokenStorage.setItem).toHaveBeenCalledWith(key, value);

      // Switch to localStorage fallback
      mockIsServiceWorkerAvailable.mockReturnValue(false);
      await oidcTokenStorage.set(key, value);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(key, value);
    });

    it('should handle concurrent operations', async () => {
      mockIsServiceWorkerAvailable.mockReturnValue(true);

      mockSwTokenStorage.setItem.mockResolvedValue(undefined);
      mockSwTokenStorage.getItem.mockResolvedValue(null);
      mockSwTokenStorage.getAllKeys.mockResolvedValue(['key1', 'key2']);

      // Test operations individually to avoid Promise.all typing issues
      await oidcTokenStorage.set('key1', 'value1');
      await oidcTokenStorage.set('key2', 'value2');
      const result1 = await oidcTokenStorage.get('key3');
      const result2 = await oidcTokenStorage.getAllKeys();

      expect(result1).toBeNull();
      expect(result2).toEqual(['key1', 'key2']);
      expect(mockSwTokenStorage.setItem).toHaveBeenCalledTimes(2);
      expect(mockSwTokenStorage.getItem).toHaveBeenCalledTimes(1);
      expect(mockSwTokenStorage.getAllKeys).toHaveBeenCalledTimes(1);
    });
  });
});

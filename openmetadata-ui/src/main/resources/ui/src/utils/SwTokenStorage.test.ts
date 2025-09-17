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

import { swTokenStorage } from './SwTokenStorage';

// Mock SwMessenger
const mockSendMessageToServiceWorker = jest.fn();

jest.mock('./SwMessenger', () => ({
  sendMessageToServiceWorker: (message: unknown) =>
    mockSendMessageToServiceWorker(message),
}));

describe('SwTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = swTokenStorage;
      const instance2 = swTokenStorage;

      expect(instance1).toBe(instance2);
    });
  });

  describe('setItem', () => {
    it('should call sendMessageToServiceWorker with correct parameters', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockSendMessageToServiceWorker.mockResolvedValue(undefined);

      await swTokenStorage.setItem(key, value);

      expect(mockSendMessageToServiceWorker).toHaveBeenCalledWith({
        type: 'set',
        key,
        value,
      });
    });

    it('should handle service worker errors', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const error = new Error('Service worker unavailable');
      mockSendMessageToServiceWorker.mockRejectedValue(error);

      await expect(swTokenStorage.setItem(key, value)).rejects.toThrow(
        'Service worker unavailable'
      );
    });

    it('should handle empty key and value', async () => {
      mockSendMessageToServiceWorker.mockResolvedValue(undefined);

      await swTokenStorage.setItem('', '');

      expect(mockSendMessageToServiceWorker).toHaveBeenCalledWith({
        type: 'set',
        key: '',
        value: '',
      });
    });
  });

  describe('getItem', () => {
    it('should call sendMessageToServiceWorker with correct parameters and return value', async () => {
      const key = 'test-key';
      const expectedValue = 'test-value';
      mockSendMessageToServiceWorker.mockResolvedValue(expectedValue);

      const result = await swTokenStorage.getItem(key);

      expect(mockSendMessageToServiceWorker).toHaveBeenCalledWith({
        type: 'get',
        key,
      });
      expect(result).toBe(expectedValue);
    });

    it('should return null when item does not exist', async () => {
      const key = 'non-existent-key';
      mockSendMessageToServiceWorker.mockResolvedValue(null);

      const result = await swTokenStorage.getItem(key);

      expect(result).toBeNull();
    });

    it('should handle service worker errors', async () => {
      const key = 'test-key';
      const error = new Error('Service worker unavailable');
      mockSendMessageToServiceWorker.mockRejectedValue(error);

      await expect(swTokenStorage.getItem(key)).rejects.toThrow(
        'Service worker unavailable'
      );
    });

    it('should handle undefined return value', async () => {
      const key = 'test-key';
      mockSendMessageToServiceWorker.mockResolvedValue(undefined);

      const result = await swTokenStorage.getItem(key);

      expect(result).toBeUndefined();
    });
  });

  describe('removeItem', () => {
    it('should call sendMessageToServiceWorker with correct parameters', async () => {
      const key = 'test-key';
      const removedValue = 'removed-value';
      mockSendMessageToServiceWorker.mockResolvedValue(removedValue);

      const result = await swTokenStorage.removeItem(key);

      expect(mockSendMessageToServiceWorker).toHaveBeenCalledWith({
        type: 'remove',
        key,
      });
      expect(result).toBe(removedValue);
    });

    it('should return null when item does not exist', async () => {
      const key = 'non-existent-key';
      mockSendMessageToServiceWorker.mockResolvedValue(null);

      const result = await swTokenStorage.removeItem(key);

      expect(result).toBeNull();
    });

    it('should handle service worker errors', async () => {
      const key = 'test-key';
      const error = new Error('Service worker unavailable');
      mockSendMessageToServiceWorker.mockRejectedValue(error);

      await expect(swTokenStorage.removeItem(key)).rejects.toThrow(
        'Service worker unavailable'
      );
    });
  });

  describe('getAllKeys', () => {
    it('should call sendMessageToServiceWorker with correct parameters and return keys array', async () => {
      const expectedKeys = ['key1', 'key2', 'key3'];
      mockSendMessageToServiceWorker.mockResolvedValue(expectedKeys);

      const result = await swTokenStorage.getAllKeys();

      expect(mockSendMessageToServiceWorker).toHaveBeenCalledWith({
        type: 'getAllKeys',
      });
      expect(result).toEqual(expectedKeys);
    });

    it('should return empty array when no keys exist', async () => {
      mockSendMessageToServiceWorker.mockResolvedValue([]);

      const result = await swTokenStorage.getAllKeys();

      expect(result).toEqual([]);
    });

    it('should handle service worker errors', async () => {
      const error = new Error('Service worker unavailable');
      mockSendMessageToServiceWorker.mockRejectedValue(error);

      await expect(swTokenStorage.getAllKeys()).rejects.toThrow(
        'Service worker unavailable'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should support complete CRUD operations', async () => {
      const key = 'integration-key';
      const value = 'integration-value';
      const updatedValue = 'updated-value';

      // Set item
      mockSendMessageToServiceWorker.mockResolvedValueOnce(undefined);
      await swTokenStorage.setItem(key, value);

      // Get item
      mockSendMessageToServiceWorker.mockResolvedValueOnce(value);
      const retrievedValue = await swTokenStorage.getItem(key);

      expect(retrievedValue).toBe(value);

      // Update item
      mockSendMessageToServiceWorker.mockResolvedValueOnce(undefined);
      await swTokenStorage.setItem(key, updatedValue);

      // Get updated item
      mockSendMessageToServiceWorker.mockResolvedValueOnce(updatedValue);
      const retrievedUpdatedValue = await swTokenStorage.getItem(key);

      expect(retrievedUpdatedValue).toBe(updatedValue);

      // Remove item
      mockSendMessageToServiceWorker.mockResolvedValueOnce(updatedValue);
      const removedValue = await swTokenStorage.removeItem(key);

      expect(removedValue).toBe(updatedValue);

      // Verify item is removed
      mockSendMessageToServiceWorker.mockResolvedValueOnce(null);
      const finalValue = await swTokenStorage.getItem(key);

      expect(finalValue).toBeNull();
    });

    it('should handle concurrent operations', async () => {
      mockSendMessageToServiceWorker
        .mockResolvedValueOnce(undefined) // setItem key1
        .mockResolvedValueOnce(undefined) // setItem key2
        .mockResolvedValueOnce(null) // getItem key3
        .mockResolvedValueOnce(['key1', 'key2']); // getAllKeys

      // Test concurrent operations
      await swTokenStorage.setItem('key1', 'value1');
      await swTokenStorage.setItem('key2', 'value2');
      const result1 = await swTokenStorage.getItem('key3');
      const result2 = await swTokenStorage.getAllKeys();

      expect(result1).toBeNull();
      expect(result2).toEqual(['key1', 'key2']);
      expect(mockSendMessageToServiceWorker).toHaveBeenCalledTimes(4);
    });
  });
});

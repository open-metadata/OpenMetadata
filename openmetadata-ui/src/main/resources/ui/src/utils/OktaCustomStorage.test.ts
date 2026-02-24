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

import { OktaCustomStorage } from './OktaCustomStorage';
import { swTokenStorage } from './SwTokenStorage';

jest.mock('./SwTokenStorage', () => ({
  swTokenStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('./SwTokenStorageUtils', () => ({
  isServiceWorkerAvailable: jest.fn(() => true),
}));

const mockGetItem = swTokenStorage.getItem as jest.Mock;
const mockSetItem = swTokenStorage.setItem as jest.Mock;

describe('OktaCustomStorage', () => {
  let storage: OktaCustomStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should initialize with empty cache when no stored data', async () => {
      storage = new OktaCustomStorage();
      await storage.waitForInit();

      expect(storage.getItem('test')).toBeNull();
    });

    it('should load stored tokens from IndexedDB on initialization', async () => {
      const storedData = { idToken: 'stored-token' };
      mockGetItem.mockResolvedValue(JSON.stringify(storedData));

      storage = new OktaCustomStorage();
      await storage.waitForInit();

      expect(mockGetItem).toHaveBeenCalledWith('okta_tokens');
      expect(storage.getItem('idToken')).toBe('stored-token');
    });

    it('should handle initialization errors gracefully', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      storage = new OktaCustomStorage();
      await storage.waitForInit();

      expect(storage.getItem('test')).toBeNull();
    });
  });

  describe('setItem', () => {
    beforeEach(async () => {
      storage = new OktaCustomStorage();
      await storage.waitForInit();
    });

    it('should store item in memory cache', async () => {
      await storage.setItem('idToken', 'test-token');

      expect(storage.getItem('idToken')).toBe('test-token');
    });

    it('should persist item to IndexedDB', async () => {
      await storage.setItem('idToken', 'test-token');

      expect(mockSetItem).toHaveBeenCalledWith(
        'okta_tokens',
        JSON.stringify({ idToken: 'test-token' })
      );
    });

    it('should handle multiple items', async () => {
      await storage.setItem('idToken', 'id-token');
      await storage.setItem('accessToken', 'access-token');

      expect(storage.getItem('idToken')).toBe('id-token');
      expect(storage.getItem('accessToken')).toBe('access-token');
    });
  });

  describe('getItem', () => {
    beforeEach(async () => {
      storage = new OktaCustomStorage();
      await storage.waitForInit();
    });

    it('should return null for non-existent item', () => {
      expect(storage.getItem('nonexistent')).toBeNull();
    });

    it('should return stored item', async () => {
      await storage.setItem('test', 'value');

      expect(storage.getItem('test')).toBe('value');
    });
  });

  describe('removeItem', () => {
    beforeEach(async () => {
      storage = new OktaCustomStorage();
      await storage.waitForInit();
    });

    it('should remove item from memory cache', async () => {
      await storage.setItem('test', 'value');
      storage.removeItem('test');

      expect(storage.getItem('test')).toBeNull();
    });

    it('should persist removal to IndexedDB', async () => {
      await storage.setItem('test', 'value');

      jest.clearAllMocks();

      storage.removeItem('test');

      await Promise.resolve();

      expect(mockSetItem).toHaveBeenCalledWith(
        'okta_tokens',
        JSON.stringify({})
      );
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      storage = new OktaCustomStorage();
      await storage.waitForInit();
    });

    it('should clear all items from memory cache', async () => {
      await storage.setItem('token1', 'value1');
      await storage.setItem('token2', 'value2');
      storage.clear();

      expect(storage.getItem('token1')).toBeNull();
      expect(storage.getItem('token2')).toBeNull();
    });

    it('should persist clear to IndexedDB', async () => {
      await storage.setItem('test', 'value');

      jest.clearAllMocks();

      storage.clear();

      await Promise.resolve();

      expect(mockSetItem).toHaveBeenCalledWith(
        'okta_tokens',
        JSON.stringify({})
      );
    });
  });

  describe('getStorage', () => {
    beforeEach(async () => {
      storage = new OktaCustomStorage();
      await storage.waitForInit();
    });

    it('should return copy of all stored items', async () => {
      await storage.setItem('token1', 'value1');
      await storage.setItem('token2', 'value2');

      const allItems = storage.getStorage();

      expect(allItems).toEqual({ token1: 'value1', token2: 'value2' });
    });

    it('should return empty object when no items stored', () => {
      const allItems = storage.getStorage();

      expect(allItems).toEqual({});
    });

    it('should return a copy, not reference', async () => {
      await storage.setItem('test', 'value');
      const allItems = storage.getStorage();
      allItems.test = 'modified';

      expect(storage.getItem('test')).toBe('value');
    });
  });

  describe('fallback to localStorage', () => {
    it('should use localStorage when ServiceWorker not available', async () => {
      const { isServiceWorkerAvailable } = require('./SwTokenStorageUtils');
      isServiceWorkerAvailable.mockReturnValue(false);

      const localStorageGetSpy = jest.spyOn(Storage.prototype, 'getItem');
      const localStorageSetSpy = jest.spyOn(Storage.prototype, 'setItem');

      localStorageGetSpy.mockReturnValue(null);
      localStorageSetSpy.mockReturnValue();

      storage = new OktaCustomStorage();
      await storage.waitForInit();
      await storage.setItem('test', 'value');

      expect(localStorageGetSpy).toHaveBeenCalledWith('okta_tokens');
      expect(localStorageSetSpy).toHaveBeenCalled();

      localStorageGetSpy.mockRestore();
      localStorageSetSpy.mockRestore();
      isServiceWorkerAvailable.mockReturnValue(true);
    });
  });
});

/*
 *  Copyright 2023 Collate.
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
  hasNotificationPermission,
  shouldRequestPermission,
} from './BrowserNotificationUtils';

// Mock the Notification object
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: jest.fn(),
  },
  writable: true,
});

describe('BrowserNotificationUtils', () => {
  describe('shouldRequestPermission', () => {
    it('should return false if Notification API is not available', () => {
      jest
        .spyOn(global, 'window', 'get')
        .mockReturnValueOnce({} as Window & typeof globalThis);

      const result = shouldRequestPermission();

      expect(result).toBe(false);
    });

    it('should return false if permission is already granted or denied', () => {
      Object.defineProperty(Notification, 'permission', {
        get: () => 'granted',
      });

      const result1 = shouldRequestPermission();

      expect(result1).toBe(false);

      Object.defineProperty(Notification, 'permission', {
        get: () => 'denied',
      });

      const result2 = shouldRequestPermission();

      expect(result2).toBe(false);
    });
  });

  describe('hasNotificationPermission', () => {
    it('should return false if Notification API is not available', () => {
      jest
        .spyOn(global, 'window', 'get')
        .mockReturnValueOnce({} as Window & typeof globalThis);

      const result = hasNotificationPermission();

      expect(result).toBe(false);
    });

    it('should return false if permission is not granted', () => {
      Object.defineProperty(Notification, 'permission', {
        get: () => 'default',
      });

      const result1 = hasNotificationPermission();

      expect(result1).toBe(false);

      Object.defineProperty(Notification, 'permission', {
        get: () => 'denied',
      });

      const result2 = hasNotificationPermission();

      expect(result2).toBe(false);
    });
  });
});

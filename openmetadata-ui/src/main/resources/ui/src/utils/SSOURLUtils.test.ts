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
import { getAuthorityUrl, getCallbackUrl, getServerUrl } from './SSOURLUtils';

// Mock EnvironmentUtils
jest.mock('./EnvironmentUtils', () => ({
  isDev: jest.fn().mockReturnValue(false),
}));

/**
 * Test suite for environment-based URL getters
 * Tests getCallbackUrl, getServerUrl, getDomainUrl, getAuthorityUrl
 */
describe('Environment-based URL functions', () => {
  beforeEach(() => {
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://production.example.com',
      },
      writable: true,
    });
  });

  describe('getCallbackUrl', () => {
    it('should return production callback URL', () => {
      const result = getCallbackUrl();

      expect(result).toBe('https://production.example.com/callback');
    });
  });

  describe('getServerUrl', () => {
    it('should return production server URL', () => {
      const result = getServerUrl();

      expect(result).toBe('https://production.example.com');
    });
  });

  describe('getAuthorityUrl', () => {
    it('should return production authority URL', () => {
      const result = getAuthorityUrl();

      expect(result).toBe('https://production.example.com/api/v1/auth/login');
    });
  });
});

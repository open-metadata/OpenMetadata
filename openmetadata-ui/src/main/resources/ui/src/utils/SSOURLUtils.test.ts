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
import { isDev } from './EnvironmentUtils';
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

describe('development SSO URLs', () => {
  const originalTarget = process.env.DEV_SERVER_TARGET;
  const originalSsoUrl = process.env.SSO_SERVER_URL;

  beforeEach(() => {
    jest.mocked(isDev).mockReturnValue(true);
    delete process.env.SSO_SERVER_URL;
  });

  afterEach(() => {
    jest.mocked(isDev).mockReturnValue(false);
    if (originalSsoUrl === undefined) {
      delete process.env.SSO_SERVER_URL;
    } else {
      process.env.SSO_SERVER_URL = originalSsoUrl;
    }
    if (originalTarget === undefined) {
      delete process.env.DEV_SERVER_TARGET;
    } else {
      process.env.DEV_SERVER_TARGET = originalTarget;
    }
  });

  it('uses the configured API target for every SSO URL', () => {
    process.env.DEV_SERVER_TARGET = 'http://localhost:8587/';

    expect(getServerUrl()).toBe('http://localhost:8587');
    expect(getCallbackUrl()).toBe('http://localhost:8587/callback');
    expect(getAuthorityUrl()).toBe('http://localhost:8587/api/v1/auth/login');
  });

  it('allows the registered SSO origin to differ from the API target', () => {
    process.env.DEV_SERVER_TARGET = 'http://localhost:8587/';
    process.env.SSO_SERVER_URL = 'http://localhost:3002/';

    expect(getServerUrl()).toBe('http://localhost:3002');
    expect(getCallbackUrl()).toBe('http://localhost:3002/callback');
    expect(getAuthorityUrl()).toBe('http://localhost:3002/api/v1/auth/login');
  });

  it('defaults to the standard backend port', () => {
    delete process.env.DEV_SERVER_TARGET;

    expect(getServerUrl()).toBe('http://localhost:8585');
    expect(getCallbackUrl()).toBe('http://localhost:8585/callback');
  });
});

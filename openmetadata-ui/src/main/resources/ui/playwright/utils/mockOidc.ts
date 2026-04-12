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

import { APIRequestContext } from '@playwright/test';

const MOCK_OIDC_BASE_URL = process.env.MOCK_OIDC_URL || 'http://localhost:9090';

export interface MockOidcConfig {
  accessTokenTTL?: number;
  idTokenTTL?: number;
  refreshTokenEnabled?: boolean;
  forceInteractionRequired?: boolean;
  tokenEndpointError?: { errorCode: string; httpStatus: number } | null;
}

export interface MockOidcState {
  accessTokenTTL: number;
  idTokenTTL: number;
  forceInteractionRequired: boolean;
  refreshTokenEnabled: boolean;
  tokenEndpointError: { errorCode: string; httpStatus: number } | null;
}

export interface MockOidcMetrics {
  tokenRequests: number;
  authRequests: number;
  refreshAttempts: number;
}

export const configureMockOidc = async (
  request: APIRequestContext,
  config: MockOidcConfig
): Promise<MockOidcState> => {
  const response = await request.post(`${MOCK_OIDC_BASE_URL}/test/configure`, {
    data: config,
  });
  const body = await response.json();

  return body.state;
};

export const setTokenExpiry = async (
  request: APIRequestContext,
  seconds: number
): Promise<MockOidcState> => {
  return configureMockOidc(request, {
    accessTokenTTL: seconds,
    idTokenTTL: seconds,
  });
};

export const forceInteractionRequired = async (
  request: APIRequestContext
): Promise<void> => {
  await request.post(`${MOCK_OIDC_BASE_URL}/test/force-interaction-required`);
};

export const resetMockOidc = async (
  request: APIRequestContext
): Promise<void> => {
  await request.post(`${MOCK_OIDC_BASE_URL}/test/reset`);
};

export const getMockOidcState = async (
  request: APIRequestContext
): Promise<MockOidcState> => {
  const response = await request.get(`${MOCK_OIDC_BASE_URL}/test/state`);

  return response.json();
};

export const waitForMockOidcReady = async (
  request: APIRequestContext,
  timeoutMs = 30000
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await request.get(`${MOCK_OIDC_BASE_URL}/health`);
      if (response.ok()) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Mock OIDC provider not ready after ${timeoutMs}ms at ${MOCK_OIDC_BASE_URL}`
  );
};

export const setTokenEndpointError = async (
  request: APIRequestContext,
  errorCode: string,
  httpStatus: number
): Promise<MockOidcState> => {
  return configureMockOidc(request, {
    tokenEndpointError: { errorCode, httpStatus },
  });
};

export const getMetrics = async (
  request: APIRequestContext
): Promise<MockOidcMetrics> => {
  const response = await request.get(`${MOCK_OIDC_BASE_URL}/test/metrics`);

  return response.json();
};

export const resetMetrics = async (
  request: APIRequestContext
): Promise<void> => {
  await request.post(`${MOCK_OIDC_BASE_URL}/test/metrics/reset`);
};

export const MOCK_OIDC_CLIENT_ID = 'openmetadata-test';
export const MOCK_OIDC_CLIENT_SECRET = 'openmetadata-test-secret';
export const MOCK_OIDC_PUBLIC_CLIENT_ID = 'openmetadata-test-public';
export const MOCK_OIDC_DISCOVERY_URL = `${MOCK_OIDC_BASE_URL}/.well-known/openid-configuration`;
